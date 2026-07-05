// G003 red-team probe (M2b-f buyer feature APIs): policy sync, offboarding
// webhook, CVE enrichment, MCP catalog, wire-version skew. Not part of the
// `test/*.test.ts` glob run by `npm test` — invoked directly via tsx.
// Boots real in-process control-plane servers (MemoryStorage), never touches
// the network (osv.dev fetch is always injected/fake), and hammers every
// contract with hostile inputs. Writes:
//   ../../artifacts/g003-adversarial.txt      human-readable transcript + SUMMARY
//   ../../artifacts/g003-api-responses.json   [{name,method,path,status,note}]
// Exits 0 iff every scenario passed.

import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createControlPlane } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { StaticViewerAuth } from '../src/verify/viewer.js'
import { riskScore as cpRiskScore, summarize } from '../src/aggregate.js'
import { finding, payload, deviceHeaders } from './helpers.js'

import { scanMcpConfig } from '../../src/scanner.js'
import { riskScore as cliRiskScore } from '../../src/report.js'
import { buildReportPayload } from '../../src/report-push.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ARTIFACTS_DIR = path.resolve(__dirname, '../../artifacts')
mkdirSync(ARTIFACTS_DIR, { recursive: true })

// ── logging plumbing ────────────────────────────────────────────────────────

const apiLog = [] // {name, method, path, status, note}
const transcript = [] // human-readable lines
const results = [] // {area, name, pass, error}

function logLine(line) {
  transcript.push(line)
}

function record(name, method, pathname, status, note = '') {
  apiLog.push({ name, method, path: pathname, status, note })
  logLine(`  [${method} ${pathname}] -> ${status}${note ? ` (${note})` : ''} :: ${name}`)
}

async function scenario(area, name, fn) {
  logLine(`\n=== [${area}] ${name} ===`)
  try {
    await fn()
    results.push({ area, name, pass: true })
    logLine(`--- PASS: ${name}`)
  } catch (error) {
    results.push({ area, name, pass: false, error: error instanceof Error ? error.stack ?? error.message : String(error) })
    logLine(`--- FAIL: ${name}\n${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  }
}

// ── HTTP helpers (mirrors test/policy.test.ts / offboarding.test.ts style) ──

async function req(base, method, pathname, body, headers = {}, label) {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  const etag = res.headers.get('etag')
  const setCookie = res.headers.getSetCookie?.() ?? []
  if (label) record(label, method, pathname, res.status, jsonNote(json))
  return { status: res.status, json, etag, setCookie }
}

async function reqRaw(base, method, pathname, rawBody, headers = {}, label) {
  const res = await fetch(`${base}${pathname}`, { method, headers, body: rawBody })
  const json = await res.json().catch(() => ({}))
  if (label) record(label, method, pathname, res.status, jsonNote(json))
  return { status: res.status, json }
}

function jsonNote(json) {
  if (!json || typeof json !== 'object') return ''
  if (typeof json.error === 'string') return `error: ${json.error}`
  if (typeof json.id === 'string') return `id: ${json.id}`
  return ''
}

async function withServer(deps, fn) {
  const server = createControlPlane(deps)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  try {
    return await fn(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

function baseDeps(overrides = {}) {
  const storage = new MemoryStorage()
  return {
    storage,
    notifier: new RecordingNotifier(),
    oidcVerifier: new StaticOidcVerifier(),
    viewerAuth: new StaticViewerAuth(),
    now: () => Date.now(),
    ...overrides,
  }
}

async function registerAdmin(base, email, orgName = 'Acme') {
  const reg = await req(base, 'POST', '/v1/auth/register', { orgName, email, password: 'adminpass1' }, {}, `register admin ${email}`)
  return { sessionToken: reg.json.sessionToken, orgId: reg.json.orgId }
}

function webhookHeaders(secret, tsSeconds, rawBody) {
  return {
    'content-type': 'application/json',
    'x-agentguard-webhook-timestamp': String(tsSeconds),
    'x-agentguard-webhook-signature': `v1=${createHmac('sha256', secret).update(`${tsSeconds}.${rawBody}`).digest('hex')}`,
  }
}

// ── mock osv.dev fetch (never hits the real network) ────────────────────────

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

function mockFetch(opts) {
  const calls = []
  const fetchFn = async (url, init) => {
    calls.push({ url, body: init?.body })
    if (opts.hang) return new Promise(() => {}) // never resolves
    if (url === 'https://api.osv.dev/v1/querybatch') {
      if (opts.querybatchFails) throw new Error('simulated network failure')
      if (opts.querybatchStatus && opts.querybatchStatus >= 300) return jsonResponse({}, false, opts.querybatchStatus)
      return jsonResponse({ results: opts.vulnsByPackageIndex.map((ids) => ({ vulns: ids.map((id) => ({ id })) })) })
    }
    const m = /\/v1\/vulns\/(.+)$/.exec(url)
    const id = m?.[1]
    if (id && opts.vulnDetails[id]) return jsonResponse(opts.vulnDetails[id])
    return jsonResponse({}, false, 404)
  }
  return { fetch: fetchFn, calls }
}

// ═══════════════════════════════════════════════════════════════════════════
// AREA 1: POLICY — ETag dual-version bust, non-admin 403, cross-org isolation
// ═══════════════════════════════════════════════════════════════════════════

await scenario(
  'policy',
  'ETag busts on BOTH rules PUT and exception approve; non-admin PUT 403; cross-org isolation',
  async () => {
    const deps = baseDeps()
    await withServer(deps, async (base) => {
      const { sessionToken } = await registerAdmin(base, 'admin@acme.test', 'OrgA')
      const auth = { authorization: `Bearer ${sessionToken}` }

      const before = await req(base, 'GET', '/v1/policy', undefined, auth, 'policy: initial GET (empty policy)')
      assert.equal(before.status, 200)
      assert.ok(before.etag)

      const putRes = await req(base, 'PUT', '/v1/policy', { rules: 'denyRead:\n  - "**/.env"\n' }, auth, 'policy: admin PUT rules')
      assert.equal(putRes.status, 200)

      const afterPut = await req(base, 'GET', '/v1/policy', undefined, auth, 'policy: GET after rules PUT')
      assert.notEqual(afterPut.etag, before.etag, 'ADVERSARIAL: rules PUT must bust the ETag')

      const cached = await req(
        base,
        'GET',
        '/v1/policy',
        undefined,
        { ...auth, 'if-none-match': afterPut.etag },
        'policy: If-None-Match matches current ETag -> 304',
      )
      assert.equal(cached.status, 304)

      const created = await req(base, 'POST', '/v1/policy/exceptions', { ruleId: 'mcp-unapproved', reason: 'rollout' }, auth, 'policy: create pending exception')
      assert.equal(created.status, 200)

      const stillPending = await req(
        base,
        'GET',
        '/v1/policy',
        undefined,
        { ...auth, 'if-none-match': afterPut.etag },
        'policy: pending exception must NOT bust ETag -> 304 still',
      )
      assert.equal(stillPending.status, 304, 'ADVERSARIAL: a merely-pending exception must not bust the ETag')

      const approve = await req(base, 'POST', `/v1/policy/exceptions/${created.json.id}/approve`, {}, auth, 'policy: admin approves exception')
      assert.equal(approve.status, 200)

      const afterApprove = await req(
        base,
        'GET',
        '/v1/policy',
        undefined,
        { ...auth, 'if-none-match': afterPut.etag },
        'policy: stale If-None-Match after approve -> 200 with a NEW ETag',
      )
      assert.equal(afterApprove.status, 200, 'ADVERSARIAL: exception approve must bust the ETag too — a stale conditional GET must not 304')
      assert.notEqual(afterApprove.etag, afterPut.etag, 'ETag after approve must differ from the ETag after the rules PUT')

      // non-admin (member) PUT -> 403
      const invite = await req(base, 'POST', '/v1/orgs/invites', { role: 'member' }, auth, 'policy: create member invite')
      const accepted = await req(base, 'POST', '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'memberpass1' }, {}, 'policy: accept invite')
      const memberAuth = { authorization: `Bearer ${accepted.json.sessionToken}` }
      const memberPut = await req(base, 'PUT', '/v1/policy', { rules: 'denyRead: []' }, memberAuth, 'policy: ADVERSARIAL non-admin PUT -> 403 expected')
      assert.equal(memberPut.status, 403)
      const memberApprove = await req(base, 'POST', `/v1/policy/exceptions/${created.json.id}/approve`, {}, memberAuth, 'policy: ADVERSARIAL non-admin re-approve -> 403 expected')
      assert.equal(memberApprove.status, 403)

      // cross-org isolation: org B must never observe org A's rules/exceptions
      const orgB = await registerAdmin(base, 'admin@b.test', 'OrgB')
      const bAuth = { authorization: `Bearer ${orgB.sessionToken}` }
      const bView = await req(base, 'GET', '/v1/policy', undefined, bAuth, 'policy: ADVERSARIAL org B GET -> must be empty, never org A data')
      assert.equal(bView.status, 200)
      assert.equal(bView.json.rulesVersion, 0, 'org B must never observe org A rulesVersion')
      assert.equal(bView.json.rules, '', 'org B must never observe org A rules text')
      assert.deepEqual(bView.json.exceptions, [], 'org B must never observe org A exceptions')
      assert.notEqual(bView.etag, afterApprove.etag, 'org B ETag must differ from org A ETag (isolated derivation)')
    })
  },
)

// ═══════════════════════════════════════════════════════════════════════════
// AREA 2: OFFBOARDING — HMAC freshness/replay/wrong-secret/tamper, 409 FSM
// ═══════════════════════════════════════════════════════════════════════════

await scenario(
  'offboarding',
  'valid signed webhook 201; tampered/stale/wrong-org-secret 401; exact replay idempotent; illegal transition 409',
  async () => {
    const deps = baseDeps()
    await withServer(deps, async (base) => {
      const reg = await req(base, 'POST', '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' }, {}, 'offboarding: register org A')
      const orgId = reg.json.orgId
      const secret = deps.storage.getOrg(orgId).webhookSecret

      const bodyObj = { orgId, employee: { id: 'emp-1', email: 'leaver@acme.test', name: 'Leaver One' }, effectiveAt: '2026-08-01T00:00:00.000Z' }
      const rawBody = JSON.stringify(bodyObj)
      const ts = Math.floor(Date.now() / 1000)
      const headers = webhookHeaders(secret, ts, rawBody)

      const ok = await reqRaw(base, 'POST', '/v1/workflows/offboarding', rawBody, headers, 'offboarding: valid signed webhook -> 201 expected')
      assert.equal(ok.status, 201)
      assert.equal(ok.json.status, 'open')

      // flip one body byte, keeping the ORIGINAL signature/timestamp
      const tamperedBody = JSON.stringify({ ...bodyObj, employee: { ...bodyObj.employee, name: 'TAMPERED' } })
      const tampered = await reqRaw(base, 'POST', '/v1/workflows/offboarding', tamperedBody, headers, 'offboarding: ADVERSARIAL flipped byte, same signature -> 401 expected')
      assert.equal(tampered.status, 401)

      // timestamp -400s (outside the +/-300s freshness window)
      const staleBodyObj = { orgId, employee: { id: 'emp-2', email: 'stale@acme.test', name: 'Stale' }, effectiveAt: '2026-08-01T00:00:00.000Z' }
      const staleRaw = JSON.stringify(staleBodyObj)
      const staleTs = Math.floor(Date.now() / 1000) - 400
      const stale = await reqRaw(base, 'POST', '/v1/workflows/offboarding', staleRaw, webhookHeaders(secret, staleTs, staleRaw), 'offboarding: ADVERSARIAL timestamp -400s -> 401 expected')
      assert.equal(stale.status, 401)

      // wrong-org secret: valid HMAC, but computed with a DIFFERENT org's secret
      const regB = await req(base, 'POST', '/v1/auth/register', { orgName: 'Other', email: 'admin-b@other.test', password: 'adminpass1' }, {}, 'offboarding: register org B (for wrong-secret probe)')
      const secretB = deps.storage.getOrg(regB.json.orgId).webhookSecret
      const wrongBodyObj = { orgId, employee: { id: 'emp-3', email: 'wrong@acme.test', name: 'Wrong' }, effectiveAt: '2026-08-01T00:00:00.000Z' }
      const wrongRaw = JSON.stringify(wrongBodyObj)
      const wrong = await reqRaw(
        base,
        'POST',
        '/v1/workflows/offboarding',
        wrongRaw,
        webhookHeaders(secretB, Math.floor(Date.now() / 1000), wrongRaw),
        'offboarding: ADVERSARIAL wrong-org secret (claims org A, signed by org B) -> 401 expected',
      )
      assert.equal(wrong.status, 401)

      // exact replay of the ORIGINAL (orgId, employee, effectiveAt) -> idempotent, same id
      const replay = await reqRaw(base, 'POST', '/v1/workflows/offboarding', rawBody, headers, 'offboarding: exact replay of valid webhook -> 200 idempotent, same id expected')
      assert.equal(replay.status, 200)
      assert.equal(replay.json.id, ok.json.id, 'ADVERSARIAL: replay must not fork a duplicate task')

      const list = await req(base, 'GET', '/v1/workflows/offboarding', undefined, { authorization: `Bearer ${reg.json.sessionToken}` }, 'offboarding: list tasks -> must still be exactly 1 (no dup from replay)')
      assert.equal(list.json.tasks.length, 1)

      // illegal transition open -> done (skip sweeping) -> 409
      const authAdmin = { authorization: `Bearer ${reg.json.sessionToken}` }
      const illegal = await req(base, 'POST', `/v1/workflows/offboarding/${ok.json.id}/transition`, { to: 'done' }, authAdmin, 'offboarding: ADVERSARIAL illegal open->done transition -> 409 expected')
      assert.equal(illegal.status, 409)

      // legal transition then illegal backwards
      const toSweeping = await req(base, 'POST', `/v1/workflows/offboarding/${ok.json.id}/transition`, { to: 'sweeping' }, authAdmin, 'offboarding: legal open->sweeping transition -> 200')
      assert.equal(toSweeping.status, 200)
      const backwards = await req(base, 'POST', `/v1/workflows/offboarding/${ok.json.id}/transition`, { to: 'open' }, authAdmin, 'offboarding: ADVERSARIAL illegal backwards sweeping->open -> 409 expected')
      assert.equal(backwards.status, 409)
    })
  },
)

// ═══════════════════════════════════════════════════════════════════════════
// AREA 3: CVE — 202 despite osv 500/throw/hang, cveIds enrichment, global cache
// ═══════════════════════════════════════════════════════════════════════════

await scenario('cve', 'ingest returns 202 in ALL of osv-500 / osv-throw / osv-hang (enrichment never awaited)', async () => {
  for (const mode of ['500', 'throw', 'hang']) {
    const storage = new MemoryStorage()
    storage.createAsset({ orgId: 'orgA', assetId: 'pc1', label: 'pc1', kind: 'pc', authKind: 'device-token', secret: 'dev-secret-xyz', lastSeenAt: null, createdAt: 0 })
    const opts =
      mode === '500'
        ? { vulnsByPackageIndex: [], vulnDetails: {}, querybatchStatus: 503 }
        : mode === 'throw'
          ? { vulnsByPackageIndex: [], vulnDetails: {}, querybatchFails: true }
          : { vulnsByPackageIndex: [], vulnDetails: {}, hang: true }
    const { fetch } = mockFetch(opts)
    const deps = {
      storage,
      notifier: new RecordingNotifier(),
      oidcVerifier: new StaticOidcVerifier(),
      viewerAuth: new StaticViewerAuth(),
      now: () => Date.now(),
      enrich: { deps: { storage, fetch, now: () => Date.now() }, enqueue: (fn) => fn() },
    }
    await withServer(deps, async (base) => {
      const ts = Math.floor(Date.now() / 1000)
      const npmFinding = finding({
        surface: 'npm-global',
        ruleId: 'npm-global-ai-cli',
        location: 'npm-global:leftpad',
        evidenceRedacted: 'Global AI CLI installed: leftpad@1.0.0',
        fingerprint: { '500': 'a5'.repeat(16), throw: '7e'.repeat(16), hang: '8a'.repeat(16) }[mode],
      })
      const rawBody = JSON.stringify(payload('orgA', 'pc1', [npmFinding]))
      const timeoutMs = 1500
      const t0 = Date.now()
      const res = await Promise.race([
        reqRaw(base, 'POST', '/v1/reports', rawBody, deviceHeaders('pc1', 'dev-secret-xyz', rawBody, ts), `cve: osv ${mode} -> POST /v1/reports must still 202`),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`ingest did not return within ${timeoutMs}ms — osv fetch may be (wrongly) awaited on the ingest path`)), timeoutMs)),
      ])
      const elapsed = Date.now() - t0
      assert.equal(res.status, 202, `ADVERSARIAL: osv ${mode} must not block/fail ingest`)
      assert.ok(elapsed < timeoutMs, `ingest took ${elapsed}ms under osv ${mode} — must return fast`)
      logLine(`  (osv ${mode}: ingest returned in ${elapsed}ms)`)
    })
  }
})

await scenario('cve', 'healthy osv enrichment adds cveIds[]; cve_cache is GLOBAL (org B: 0 new fetches) while findings stay org-scoped', async () => {
  const storage = new MemoryStorage()
  const { fetch, calls } = mockFetch({ vulnsByPackageIndex: [['GHSA-1']], vulnDetails: { 'GHSA-1': { severity: [{ type: 'CVSS_V3', score: '9.8' }] } } })
  const cveDeps = { storage, fetch, now: () => Date.now() }
  const deps = { storage, notifier: new RecordingNotifier(), oidcVerifier: new StaticOidcVerifier(), viewerAuth: new StaticViewerAuth(), now: () => Date.now(), cve: cveDeps }
  await withServer(deps, async (base) => {
    const regA = await registerAdmin(base, 'a@a.test', 'OrgA')
    const regB = await registerAdmin(base, 'b@b.test', 'OrgB')
    storage.upsertFinding(regA.orgId, 'a1', finding({ surface: 'npm-global', evidenceRedacted: 'Global AI CLI installed: leftpad@1.0.0', fingerprint: 'a'.repeat(32) }), Date.now())
    storage.upsertFinding(regB.orgId, 'b1', finding({ surface: 'npm-global', evidenceRedacted: 'Global AI CLI installed: leftpad@1.0.0', fingerprint: 'b'.repeat(32) }), Date.now())

    const refreshA = await req(base, 'POST', '/v1/cve/refresh', {}, { authorization: `Bearer ${regA.sessionToken}` }, 'cve: admin refresh org A (primes GLOBAL cache)')
    assert.equal(refreshA.status, 202)
    assert.deepEqual(storage.listFindings(regA.orgId)[0]?.cveIds, ['GHSA-1'])
    assert.ok(calls.some((c) => c.url === 'https://api.osv.dev/v1/querybatch'), 'org A refresh must hit osv')

    calls.length = 0
    const refreshB = await req(base, 'POST', '/v1/cve/refresh', {}, { authorization: `Bearer ${regB.sessionToken}` }, 'cve: admin refresh org B -> must reuse global cache, 0 new fetches')
    assert.equal(refreshB.status, 202)
    assert.equal(calls.length, 0, 'ADVERSARIAL: org B refresh must do ZERO network calls (global cache primed by org A)')
    assert.deepEqual(storage.listFindings(regB.orgId)[0]?.cveIds, ['GHSA-1'], "org B's finding IS enriched from the shared global cache")

    const bFindings = await req(base, 'GET', '/v1/findings', undefined, { authorization: `Bearer ${regB.sessionToken}` }, 'cve: org B lists findings -> must never see org A finding')
    assert.equal(bFindings.json.findings.length, 1)
    assert.equal(bFindings.json.findings[0].fingerprint, 'b'.repeat(32), 'ADVERSARIAL: org B must only ever see its own finding despite the shared global CVE cache')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// AREA 4: MCP CATALOG — admin-only PUT, seed, advisory severity, exclusion
// ═══════════════════════════════════════════════════════════════════════════

await scenario('mcp-catalog', 'member PUT 403; admin PUT ok; seed present; unapproved/strict/approved/no-catalog scan; advisory excluded from exit code + aggregates', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await req(base, 'POST', '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' }, {}, 'mcp: register admin')
    const adminAuth = { authorization: `Bearer ${reg.json.sessionToken}` }

    const seedGet = await req(base, 'GET', '/v1/mcp/catalog', undefined, adminAuth, 'mcp: GET fresh-org seed catalog')
    assert.equal(seedGet.status, 200)
    assert.ok(seedGet.json.entries.length > 0, 'seed must be non-empty')
    assert.ok(seedGet.json.entries.every((e) => e.approved === false), 'seed must be deny-by-default')

    const invite = await req(base, 'POST', '/v1/orgs/invites', { role: 'member' }, adminAuth, 'mcp: create member invite')
    const accepted = await req(base, 'POST', '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'memberpass1' }, {}, 'mcp: accept invite')
    const memberAuth = { authorization: `Bearer ${accepted.json.sessionToken}` }

    const memberPut = await req(base, 'PUT', '/v1/mcp/catalog', { entries: [{ serverName: 'filesystem', approved: true, riskTags: [] }] }, memberAuth, 'mcp: ADVERSARIAL member PUT -> 403 expected')
    assert.equal(memberPut.status, 403)

    const adminPut = await req(base, 'PUT', '/v1/mcp/catalog', { entries: [{ serverName: 'filesystem', approved: true, riskTags: ['filesystem-access'] }] }, adminAuth, 'mcp: admin PUT -> 200 expected')
    assert.equal(adminPut.status, 200)
    assert.equal(adminPut.json.entries[0].approved, true)

    // malformed entry (adversarial input shapes) -> 400
    const badEntry1 = await req(base, 'PUT', '/v1/mcp/catalog', { entries: [{ approved: true }] }, adminAuth, 'mcp: ADVERSARIAL PUT missing serverName -> 400 expected')
    assert.equal(badEntry1.status, 400)
    const badEntry2 = await req(base, 'PUT', '/v1/mcp/catalog', { entries: [{ serverName: 'x', approved: 'yes' }] }, adminAuth, 'mcp: ADVERSARIAL PUT non-boolean approved -> 400 expected')
    assert.equal(badEntry2.status, 400)
  })

  // scanMcpConfig scenarios (pure functions — no HTTP surface)
  const FS_CONFIG = JSON.stringify({ mcpServers: { filesystem: { command: 'npx', args: ['mcp-server-filesystem'] } } })

  const noCatalog = scanMcpConfig(FS_CONFIG)
  assert.equal(noCatalog.some((f) => f.id === 'mcp-unapproved'), false, 'no catalog provided -> zero mcp-unapproved findings')

  const unapproved = scanMcpConfig(FS_CONFIG, undefined, { entries: [{ serverName: 'filesystem', approved: false }] })
  const u = unapproved.find((f) => f.id === 'mcp-unapproved')
  assert.ok(u, 'unapproved local server must yield an mcp-unapproved finding')
  assert.equal(u.severity, 'low')
  assert.equal(u.advisory, true)

  const strict = scanMcpConfig(FS_CONFIG, undefined, { entries: [{ serverName: 'filesystem', approved: false }], strictMode: true })
  const s = strict.find((f) => f.id === 'mcp-unapproved')
  assert.equal(s.severity, 'medium', 'strict mode must bump severity to medium')
  assert.equal(s.advisory, true, 'strict-mode finding must remain advisory')

  const approved = scanMcpConfig(FS_CONFIG, undefined, { entries: [{ serverName: 'filesystem', approved: true }] })
  assert.equal(approved.some((f) => f.id === 'mcp-unapproved'), false, 'approved server -> no finding')

  // advisory exclusion: CLI exit-code-driving riskScore
  const advisoryCritical = { id: 'mcp-unapproved', title: 'x', severity: 'critical', category: 'mcp-risk', evidence: 'x', recommendation: 'x', advisory: true }
  const normalLow = { id: 'y', title: 'y', severity: 'low', category: 'mcp-risk', evidence: 'y', recommendation: 'y' }
  assert.equal(cliRiskScore([advisoryCritical]), 0, 'ADVERSARIAL: a critical-severity advisory finding must contribute ZERO to the CLI exit-code score')
  assert.equal(cliRiskScore([advisoryCritical, normalLow]), 1, 'only the non-advisory finding may count')

  // advisory exclusion: control-plane summarize()/riskScore() aggregates
  const asset = { orgId: 'o', assetId: 'a1', label: 'a1', kind: 'pc', authKind: 'device-token', lastSeenAt: null, createdAt: 0 }
  const advisoryRec = {
    orgId: 'o', assetId: 'a1', ruleId: 'mcp-unapproved', surface: 'mcp-risk', severity: 'critical', location: 'mcp-config',
    evidenceRedacted: 'filesystem', fingerprint: '1'.repeat(32), firstSeen: 0, lastSeen: 0, status: 'open', advisory: true,
  }
  const normalRec = {
    orgId: 'o', assetId: 'a1', ruleId: 'openai-key', surface: 'secret', severity: 'high', location: '~/.zshrc',
    evidenceRedacted: 'sk-p…0000', fingerprint: '2'.repeat(32), firstSeen: 0, lastSeen: 0, status: 'open',
  }
  const summary = summarize([advisoryRec, normalRec], [asset])
  assert.equal(summary.totalFindings, 1, 'ADVERSARIAL: the critical-severity advisory finding must be excluded from totalFindings')
  assert.equal(summary.bySeverity.critical, 0, 'advisory finding must never inflate a severity bucket')
  assert.equal(summary.riskScore, 3, 'riskScore must reflect only the non-advisory high finding')
  assert.equal(cpRiskScore([advisoryRec, normalRec]), 3)
})

// ═══════════════════════════════════════════════════════════════════════════
// AREA 5: WIRE SKEW — server [1,2]; v1/v2+advisory 202; client vs meta:[1]
// ═══════════════════════════════════════════════════════════════════════════

await scenario('wire-skew', 'server /v1/meta advertises [1,2]; v1 payload 202; v2+advisory 202 stored; client vs forged meta:[1] omits advisory + sends v1', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    // Deliberately NOT a real registered org id here — see the dedicated
    // "redaction false-positive" scenario below for why a genuine minted
    // orgId (org_<24 hex chars>) cannot safely appear in a report payload.
    const orgId = 'org_wire'
    deps.storage.createAsset({ orgId, assetId: 'pc1', label: 'pc1', kind: 'pc', authKind: 'device-token', secret: 'dev-secret-xyz', lastSeenAt: null, createdAt: 0 })

    const meta = await req(base, 'GET', '/v1/meta', undefined, {}, 'wire: GET /v1/meta -> advertises supported schema versions')
    assert.deepEqual(meta.json.schemaVersions, [1, 2])

    // (a) v1 payload -> 202
    const ts = Math.floor(Date.now() / 1000)
    const bodyV1 = JSON.stringify(payload(orgId, 'pc1', [finding({ fingerprint: 'e1'.repeat(16) })], { schemaVersion: 1, actor: { type: 'device-token', subject: 'pc1' } }))
    const resV1 = await reqRaw(base, 'POST', '/v1/reports', bodyV1, deviceHeaders('pc1', 'dev-secret-xyz', bodyV1, ts), 'wire: (a) v1 payload -> 202 expected on v2-capable server')
    assert.equal(resV1.status, 202)

    // (b) v2 payload with an advisory finding -> 202, advisory flag persisted
    const advisoryFinding = finding({ ruleId: 'mcp-unapproved', surface: 'mcp-risk', severity: 'low', evidenceRedacted: 'filesystem', advisory: true, fingerprint: 'e2'.repeat(16) })
    const bodyV2 = JSON.stringify(payload(orgId, 'pc1', [advisoryFinding], { schemaVersion: 2, actor: { type: 'device-token', subject: 'pc1' } }))
    const resV2 = await reqRaw(base, 'POST', '/v1/reports', bodyV2, deviceHeaders('pc1', 'dev-secret-xyz', bodyV2, ts), 'wire: (b) v2 payload with advisory finding -> 202 expected')
    assert.equal(resV2.status, 202)
    const stored = deps.storage.listFindings(orgId).find((f) => f.ruleId === 'mcp-unapproved')
    assert.equal(stored?.advisory, true, 'ADVERSARIAL: the advisory flag must survive persistence at v2')

    // (c) client negotiates against a FORGED /v1/meta that only advertises [1]
    let sentBody
    const identity = { orgId, assetId: 'pc1', actor: { type: 'device-token', subject: 'dana' }, credential: { kind: 'device-token', secret: 'dev-secret-xyz' } }
    const clientPayload = buildReportPayload(
      [
        { id: 'mcp-unapproved', title: 'x', severity: 'low', category: 'mcp-risk', evidence: 'filesystem', recommendation: 'y', advisory: true },
        { id: 'openai-key', title: 'x', severity: 'critical', category: 'secret', evidence: 'sk-p…0000', recommendation: 'rotate' },
      ],
      { orgId, assetId: 'pc1', actor: { type: 'device-token', subject: 'dana' }, home: '/home/dana', username: 'dana' },
    )
    const fetchImpl = async (url, init) => {
      if (url.endsWith('/v1/meta')) {
        // ADVERSARIAL: forge a downgraded meta response even though the real
        // server (queried above) actually advertises [1, 2].
        return { status: 200, text: async () => JSON.stringify({ schemaVersions: [1] }) }
      }
      const res = await fetch(url, init)
      sentBody = init.body
      const text = await res.text()
      return { status: res.status, text: async () => text }
    }
    const { pushReport } = await import('../../src/report-push.js')
    const pushResult = await pushReport(base, clientPayload, identity, { fetchImpl })
    record('wire: (c) client push against forged /v1/meta:[1]', 'POST', '/v1/reports', pushResult.status)
    assert.equal(pushResult.status, 202)
    const sent = JSON.parse(sentBody)
    assert.equal(sent.schemaVersion, 1, 'ADVERSARIAL: client must fall back to schemaVersion 1 when the meta probe excludes v2')
    assert.equal(sent.findings.some((f) => f.ruleId === 'mcp-unapproved'), false, 'advisory finding must be OMITTED, not merely downgraded')
    assert.equal(sent.findings.length, 1, 'the non-advisory finding must still ship')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BONUS FINDING: a genuine minted orgId (org_<24 hex chars>) always trips the
// server's INDEPENDENT redaction heuristic (looksLikeRawSecret), 422-ing every
// real ingest report from a freshly registered org. This is what forced every
// scenario above to use a short literal orgId instead of the real registered
// one. Confirmed reproducible below — reported as a BLOCKER in the matrix.
// ═══════════════════════════════════════════════════════════════════════════

await scenario('wire-skew', 'BUG: a genuine minted orgId (org_<24 hex>) false-positives the independent redaction check, 422-ing every real report', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await req(base, 'POST', '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' }, {}, 'wire-bug: register a REAL org (mints org_<24 hex>)')
    const orgId = reg.json.orgId
    assert.match(orgId, /^org_[0-9a-f]{24}$/, 'sanity: confirm the real minted orgId shape')
    deps.storage.createAsset({ orgId, assetId: 'pc1', label: 'pc1', kind: 'pc', authKind: 'device-token', secret: 'dev-secret-xyz', lastSeenAt: null, createdAt: 0 })

    const ts = Math.floor(Date.now() / 1000)
    const body = JSON.stringify(payload(orgId, 'pc1', [finding({ fingerprint: 'e3'.repeat(16) })], { actor: { type: 'device-token', subject: 'pc1' } }))
    const res = await reqRaw(
      base,
      'POST',
      '/v1/reports',
      body,
      deviceHeaders('pc1', 'dev-secret-xyz', body, ts),
      'wire-bug: ADVERSARIAL genuine orgId in payload -> observed 422 (production bug, NOT contractually correct)',
    )
    assert.equal(res.status, 422, 'CONFIRMED: the independent redaction heuristic flags the orgId field itself as a raw-secret leak')
    assert.equal(res.json.error, 'server redaction check failed')
    assert.equal(res.json.field, 'orgId')
  })
})

// ── write artifacts ─────────────────────────────────────────────────────────

const passCount = results.filter((r) => r.pass).length
const failCount = results.length - passCount

const summaryLines = [
  '',
  '=== SUMMARY ===',
  ...results.map((r) => `[${r.pass ? 'PASS' : 'FAIL'}] (${r.area}) ${r.name}`),
  '',
  `TOTAL: ${results.length}  PASS: ${passCount}  FAIL: ${failCount}`,
]

const fullTranscript = [
  `G003 red-team probe — commit bca618c — run at ${new Date().toISOString()}`,
  ...transcript,
  ...summaryLines,
].join('\n')

writeFileSync(path.join(ARTIFACTS_DIR, 'g003-adversarial.txt'), fullTranscript + '\n', 'utf8')
writeFileSync(path.join(ARTIFACTS_DIR, 'g003-api-responses.json'), JSON.stringify(apiLog, null, 2) + '\n', 'utf8')

const nodeVersion = execFileSync('node', ['--version'], { encoding: 'utf8' })
writeFileSync(
  path.join(ARTIFACTS_DIR, 'g003-cli-replay.json'),
  JSON.stringify({ schemaVersion: 1, kind: 'cli-replay', replaySafe: true, command: ['node', '--version'], recordedStdout: nodeVersion }, null, 2) + '\n',
  'utf8',
)

console.log(fullTranscript)

if (failCount > 0) {
  console.error(`\n${failCount} scenario(s) FAILED`)
  process.exit(1)
}
process.exit(0)
