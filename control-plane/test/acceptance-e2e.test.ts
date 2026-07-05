import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createControlPlane, type ControlPlaneDeps } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { StaticViewerAuth } from '../src/verify/viewer.js'
import { buildFingerprint } from '../src/contract.js'
// Same wire contract the shipped report agent uses (control-plane/src/contract.ts
// re-exports this exact module) — the acceptance test builds its scan-push
// payload through the CLI's own client helpers, not a hand-rolled shape.
import { buildReportPayload, signBody } from '../../src/report-push.js'
import type { Finding } from '../../src/rules.js'

interface RawResponse {
  readonly status: number
  readonly json: any
  readonly setCookie: string[]
}

async function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<RawResponse> {
  const isRaw = typeof body === 'string'
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: isRaw ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : isRaw ? (body as string) : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] }
}
async function get(base: string, path: string, headers: Record<string, string> = {}): Promise<RawResponse> {
  const res = await fetch(`${base}${path}`, { headers })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] }
}

async function withServer<T>(deps: ControlPlaneDeps, fn: (base: string) => Promise<T>): Promise<T> {
  const server = createControlPlane(deps)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = (server.address() as AddressInfo).port
  try {
    return await fn(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

const RAW_SECRET = 'sk-proj-THIS_MUST_NEVER_LEAVE_THE_MACHINE_0000000000'

test('ACCEPTANCE E2E (v0.5/M6): signup -> invite -> enroll -> login -> scan-push(redacted) -> dashboard -> exec-report-data -> offboarding(open->sweeping->done audited) -> wire-skew -> device-approve', async () => {
  const storage = new MemoryStorage()
  const notifier = new RecordingNotifier()
  const deps: ControlPlaneDeps = {
    storage,
    notifier,
    oidcVerifier: new StaticOidcVerifier(),
    viewerAuth: new StaticViewerAuth(),
    now: () => Date.now(),
    freshnessWindowSec: 300,
    staleThresholdHours: 48,
  }

  await withServer(deps, async (base) => {
    // ── STEP 1: ORG SIGNUP ──
    // POST /v1/auth/register (admin) -> 200, first-party session+csrf cookies,
    // sessionToken present in the body (CLI contract).
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme Corp', email: 'admin@acme.test', password: 'admin-pass-1' })
    assert.equal(reg.status, 200, 'step1: signup succeeds')
    assert.equal(reg.json.role, 'admin')
    const orgId: string = reg.json.orgId
    assert.equal(typeof orgId, 'string')
    assert.equal(typeof reg.json.sessionToken, 'string', 'step1: sessionToken present unconditionally (CLI contract)')
    const sessionCookie = reg.setCookie.find((c) => c.startsWith('agentguard_session='))
    const csrfCookie = reg.setCookie.find((c) => c.startsWith('agentguard_csrf='))
    assert.ok(sessionCookie && /HttpOnly/.test(sessionCookie), 'step1: session cookie set, HttpOnly, first-party')
    assert.ok(csrfCookie && !/HttpOnly/.test(csrfCookie), 'step1: csrf cookie set, readable by JS')
    const adminToken: string = reg.json.sessionToken

    // ── STEP 2: INVITE ──
    // Admin issues an invite (bearer, csrf-exempt); accept-invite mints a
    // member session.
    const invite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(invite.status, 200, 'step2: admin issues invite')
    assert.equal(typeof invite.json.code, 'string')
    const accepted = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'member-pass-1' })
    assert.equal(accepted.status, 200, 'step2: invite accepted -> member session')
    assert.equal(accepted.json.role, 'member')
    assert.equal(accepted.json.orgId, orgId)
    const memberToken: string = accepted.json.sessionToken
    assert.equal(typeof memberToken, 'string')

    // ── STEP 3: CLI ENROLL (PC device-token path) ──
    // Seed a one-time enrollment code directly in storage, then redeem it.
    const enrollmentCode = 'ENROLL-ONE-TIME-CODE'
    await storage.putEnrollmentCode(orgId, createHash('sha256').update(enrollmentCode).digest('hex'), Date.now() + 3_600_000)
    const enroll = await post(base, '/v1/enroll', { orgId, enrollmentCode, assetId: 'dana-pc', assetLabel: 'Dana PC' }, {})
    assert.equal(enroll.status, 200, 'step3: PC enrolls via one-time code')
    assert.equal(enroll.json.assetId, 'dana-pc')
    const deviceToken: string = enroll.json.deviceToken
    assert.equal(typeof deviceToken, 'string')

    // ── STEP 4: CLI LOGIN ──
    // Password-grant login with x-agentguard-client: cli mints a 90-day CLI
    // session and returns sessionToken.
    const cliLogin = await post(base, '/v1/auth/login', { email: 'admin@acme.test', password: 'admin-pass-1' }, { 'x-agentguard-client': 'cli' })
    assert.equal(cliLogin.status, 200, 'step4: CLI password-grant login')
    assert.equal(typeof cliLogin.json.sessionToken, 'string')
    const cliSession = await storage.getSession(cliLogin.json.sessionToken)
    assert.equal(cliSession?.kind, 'cli', 'step4: CLI login mints a kind=cli session')

    // ── STEP 5: LOCAL SCAN -> REDACTED PUSH ──
    // Build the payload through the SAME client helpers the shipped report
    // agent uses (buildReportPayload -> mapFinding -> redaction guard), then
    // device-sign and push it. Assert the raw secret never rides the wire.

    // 5a. Prove the pre-egress guard fails CLOSED: a finding whose evidence
    // still carries the raw secret must never even be serialized.
    const leakyFinding: Finding = {
      id: 'openai-key',
      title: 'OpenAI-style API key',
      category: 'secret',
      severity: 'critical',
      file: '/home/dana/.zshrc',
      line: 42,
      evidence: RAW_SECRET,
      recommendation: 'Rotate the key and move it to a secret manager.',
    }
    assert.throws(
      () => buildReportPayload([leakyFinding], { orgId, assetId: 'dana-pc', actor: { type: 'device-token', subject: 'dana-pc' } }),
      /RedactionError|redaction guard tripped/,
      'step5: a raw-secret-bearing finding is rejected before it is ever serialized',
    )

    // 5b. The real scan result: the scanner only ever hands the report agent
    // ALREADY-redacted evidence — this is the payload that actually ships.
    const scanFinding: Finding = {
      id: 'openai-key',
      title: 'OpenAI-style API key',
      category: 'secret',
      severity: 'critical',
      file: '/home/dana/.zshrc',
      line: 42,
      evidence: 'sk-p…0000',
      recommendation: 'Rotate the key and move it to a secret manager.',
    }
    const payload = buildReportPayload([scanFinding], {
      orgId,
      assetId: 'dana-pc',
      actor: { type: 'device-token', subject: 'dana-pc' },
      home: '/home/dana',
      username: 'dana',
    })
    const wireBody = JSON.stringify(payload)
    assert.doesNotMatch(wireBody, new RegExp(RAW_SECRET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'step5: raw secret never appears in the transmitted body')
    assert.match(payload.findings[0]!.evidenceRedacted, /sk-p.*0000/, 'step5: evidence is redacted before it is even built')
    assert.match(payload.findings[0]!.location, /^~\/\.zshrc:42$/, 'step5: home/username are stripped from the location before egress')
    const ts = Math.floor(Date.now() / 1000)
    const signature = `v1=${signBody(wireBody, ts, deviceToken)}`
    assert.equal(signature, `v1=${createHmac('sha256', deviceToken).update(`${ts}.${wireBody}`).digest('hex')}`, 'step5: client signBody matches the canonical HMAC construction')
    const pushed = await post(base, '/v1/reports', wireBody, {
      'content-type': 'application/json',
      'x-agentguard-asset': 'dana-pc',
      'x-agentguard-timestamp': String(ts),
      'x-agentguard-signature': signature,
    })
    assert.equal(pushed.status, 202, 'step5: signed, redacted push is accepted')
    assert.equal(pushed.json.newCriticalCount, 1)

    // ── STEP 6: DASHBOARD AGGREGATION ──
    // Authorized session read reflects the pushed critical finding.
    const summary = await get(base, '/v1/dashboard/summary', { authorization: `Bearer ${memberToken}` })
    assert.equal(summary.status, 200, 'step6: dashboard summary authorized for any org member')
    assert.equal(summary.json.totalFindings, 1)
    assert.equal(summary.json.bySeverity.critical, 1)
    assert.equal(summary.json.byAsset.length, 1)
    assert.equal(summary.json.byAsset[0].assetId, 'dana-pc')
    assert.equal(summary.json.byAsset[0].count, 1)
    assert.equal(notifier.sent.length, 1, 'step6: exactly one alert fired for the new critical finding')

    // ── STEP 7: EXEC REPORT DATA ──
    // /v1/findings + /v1/assets carry the data the web exec report renders.
    // Push a second, ADVISORY finding (schemaVersion 2) and assert it is
    // excluded from headline counts but still visible on /v1/findings.
    const advisoryPayload = {
      ...payload,
      schemaVersion: 2 as const,
      findings: [
        {
          ruleId: 'mcp-unapproved',
          surface: 'mcp-risk',
          severity: 'low' as const,
          location: '~/.mcp/servers.json',
          evidenceRedacted: 'unapproved-server',
          fingerprint: buildFingerprint({ ruleId: 'mcp-unapproved', location: '~/.mcp/servers.json', evidenceRedacted: 'unapproved-server' }),
          advisory: true as const,
        },
      ],
    }
    const advisoryBody = JSON.stringify(advisoryPayload)
    const ts2 = Math.floor(Date.now() / 1000)
    const advisorySig = `v1=${signBody(advisoryBody, ts2, deviceToken)}`
    const advisoryPush = await post(base, '/v1/reports', advisoryBody, {
      'content-type': 'application/json',
      'x-agentguard-asset': 'dana-pc',
      'x-agentguard-timestamp': String(ts2),
      'x-agentguard-signature': advisorySig,
    })
    assert.equal(advisoryPush.status, 202, 'step7: advisory (schemaVersion 2) push accepted')

    const findingsResp = await get(base, '/v1/findings', { authorization: `Bearer ${memberToken}` })
    assert.equal(findingsResp.status, 200, 'step7: findings readable by exec report')
    assert.equal(findingsResp.json.findings.length, 2, 'step7: both critical and advisory findings are listed')
    assert.ok(findingsResp.json.findings.some((f: any) => f.advisory === true), 'step7: advisory flag surfaces to the exec report')

    const assetsResp = await get(base, '/v1/assets', { authorization: `Bearer ${memberToken}` })
    assert.equal(assetsResp.status, 200)
    assert.equal(assetsResp.json.assets.length, 1)
    assert.equal(assetsResp.json.assets[0].assetId, 'dana-pc')

    const summaryAfterAdvisory = await get(base, '/v1/dashboard/summary', { authorization: `Bearer ${memberToken}` })
    assert.equal(summaryAfterAdvisory.json.totalFindings, 1, 'step7: advisory finding excluded from headline totalFindings')
    assert.equal(summaryAfterAdvisory.json.bySeverity.critical, 1, 'step7: advisory finding never touches severity buckets')

    // ── STEP 8: OFFBOARDING WORKFLOW ──
    // Signed HR webhook (hmac-sha256, fresh ts) opens a task; admin session
    // transitions open -> sweeping -> done; every transition is audited.
    const org = await storage.getOrg(orgId)
    assert.ok(org, 'step8: org record fetched for webhook secret (never client-supplied)')
    const webhookSecret = org!.webhookSecret
    const webhookBody = JSON.stringify({
      orgId,
      employee: { id: 'dana', email: 'dana@acme.test', name: 'Dana' },
      assetIds: ['dana-pc'],
      effectiveAt: new Date().toISOString(),
    })
    const webhookTs = String(Math.floor(Date.now() / 1000))
    const webhookSig = `v1=${createHmac('sha256', webhookSecret).update(`${webhookTs}.${webhookBody}`).digest('hex')}`
    const created = await post(base, '/v1/workflows/offboarding', webhookBody, {
      'content-type': 'application/json',
      'x-agentguard-webhook-timestamp': webhookTs,
      'x-agentguard-webhook-signature': webhookSig,
    })
    assert.equal(created.status, 201, 'step8: signed HR webhook opens a new offboarding task')
    assert.equal(created.json.status, 'open')
    const taskId: string = created.json.id

    const toSweeping = await post(
      base,
      `/v1/workflows/offboarding/${taskId}/transition`,
      { to: 'sweeping' },
      { authorization: `Bearer ${adminToken}` },
    )
    assert.equal(toSweeping.status, 200, 'step8: admin transitions open -> sweeping')
    assert.equal(toSweeping.json.status, 'sweeping')

    const toDone = await post(base, `/v1/workflows/offboarding/${taskId}/transition`, { to: 'done' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(toDone.status, 200, 'step8: admin transitions sweeping -> done')
    assert.equal(toDone.json.status, 'done')

    // illegal skip/backwards transition is rejected
    const illegal = await post(base, `/v1/workflows/offboarding/${taskId}/transition`, { to: 'sweeping' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(illegal.status, 409, 'step8: backwards transition is rejected')

    const detail = await get(base, `/v1/workflows/offboarding/${taskId}`, { authorization: `Bearer ${adminToken}` })
    assert.equal(detail.status, 200)
    assert.equal(detail.json.status, 'done')
    assert.equal(detail.json.audit.length, 3, 'step8: audit archive records open, open->sweeping, sweeping->done')
    assert.deepEqual(
      detail.json.audit.map((a: any) => a.to),
      ['open', 'sweeping', 'done'],
    )

    // ── STEP 9: WIRE SKEW ──
    // GET /v1/meta advertises [1,2]; both a v1 payload and a v2+advisory
    // payload were already accepted above (both-direction skew).
    const meta = await get(base, '/v1/meta')
    assert.equal(meta.status, 200)
    assert.deepEqual(meta.json.schemaVersions, [1, 2], 'step9: server advertises both schema versions')
    // v1 payload (no advisory) — already exercised at step5 (schemaVersion 1).
    assert.equal(payload.schemaVersion, 1)
    // v2 payload with an advisory finding — already exercised at step7.
    assert.equal(advisoryPayload.schemaVersion, 2)

    // ── STEP 10: DEVICE APPROVE ──
    // Headless device flow: start -> pending poll (428) -> session-authed
    // approve -> poll succeeds once -> 410 on redemption.
    const start = await post(base, '/v1/auth/device/start', {})
    assert.equal(start.status, 200, 'step10: device flow starts')
    assert.equal(typeof start.json.deviceCode, 'string')
    assert.equal(typeof start.json.userCode, 'string')

    const pendingPoll = await post(base, '/v1/auth/device/poll', { deviceCode: start.json.deviceCode })
    assert.equal(pendingPoll.status, 428, 'step10: poll before approval is pending')

    const approve = await post(base, '/v1/auth/device/approve', { userCode: start.json.userCode }, { authorization: `Bearer ${adminToken}` })
    assert.equal(approve.status, 204, 'step10: session-authed approve succeeds')

    const poll = await post(base, '/v1/auth/device/poll', { deviceCode: start.json.deviceCode })
    assert.equal(poll.status, 200, 'step10: poll succeeds once after approval')
    assert.equal(poll.json.orgId, orgId)
    assert.equal(poll.json.role, 'admin')
    assert.equal(typeof poll.json.sessionToken, 'string')

    const rePoll = await post(base, '/v1/auth/device/poll', { deviceCode: start.json.deviceCode })
    assert.equal(rePoll.status, 410, 'step10: redeemed device code polls 410 thereafter')
  })

  await storage.close()
})
