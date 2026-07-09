import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import {
  assertRedacted,
  buildReportPayload,
  mapFinding,
  pushReport,
  RedactionError,
  ReportPushError,
  signBody,
  type FetchLike,
  type PushIdentity,
} from '../src/report-push.js'
import { reportPayloadSchema } from '../src/contract/report-payload.js'
import { resolveIdentity, EnrollmentError } from '../src/enrollment.js'
import type { Finding } from '../src/rules.js'

const HOME = '/home/dana'
const USER = 'dana'

function finding(over: Partial<Finding> = {}): Finding {
  return {
    id: 'openai-key',
    title: 'OpenAI-style API key',
    severity: 'critical',
    category: 'secret',
    file: 'src/config.ts',
    line: 12,
    evidence: 'sk-p…0000',
    recommendation: 'rotate',
    ...over,
  }
}

const deviceIdentity: PushIdentity = {
  orgId: 'org_acme',
  assetId: 'asset_pc1',
  actor: { type: 'device-token', subject: 'dana@acme' },
  credential: { kind: 'device-token', secret: 'dev-secret-123' },
}

test('mapFinding produces a 32-hex fingerprint and redacted fields', () => {
  const f = mapFinding(finding(), { home: HOME, username: USER })
  assert.equal(f.ruleId, 'openai-key')
  assert.equal(f.surface, 'secret')
  assert.equal(f.severity, 'critical')
  assert.equal(f.location, 'src/config.ts:12')
  assert.equal(f.evidenceRedacted, 'sk-p…0000')
  assert.match(f.fingerprint, /^[0-9a-f]{32}$/)
})

test('mapFinding fingerprint is stable and distinct per finding identity', () => {
  const a = mapFinding(finding(), { home: HOME, username: USER })
  const a2 = mapFinding(finding(), { home: HOME, username: USER })
  const b = mapFinding(finding({ line: 99 }), { home: HOME, username: USER })
  assert.equal(a.fingerprint, a2.fingerprint)
  assert.notEqual(a.fingerprint, b.fingerprint)
})

test('LOCATION PRIVACY: home dir and username never egress in location', () => {
  const f = mapFinding(finding({ file: join(HOME, '.zshrc'), line: 42 }), { home: HOME, username: USER })
  assert.equal(f.location, '~/.zshrc:42')
  assert.doesNotMatch(f.location, /dana/)
  assert.doesNotMatch(f.location, new RegExp(HOME))
})

test('LOCATION PRIVACY: windows user path is collapsed to ~', () => {
  const f = mapFinding(finding({ file: 'C:\\Users\\dana\\.codex\\auth.json', line: undefined }), {
    home: 'C:\\Users\\dana',
    username: 'dana',
  })
  assert.equal(f.location, '~/.codex/auth.json')
  assert.doesNotMatch(f.location, /dana/i)
})

test('buildReportPayload yields a schema-valid payload', () => {
  const payload = buildReportPayload([finding(), finding({ id: 'github-token', evidence: 'ghp_…abcd' })], {
    orgId: 'org_acme',
    assetId: 'asset_pc1',
    actor: { type: 'device-token', subject: 'dana' },
    home: HOME,
    username: USER,
    scannedAt: '2026-07-04T00:00:00.000Z',
  })
  assert.doesNotThrow(() => reportPayloadSchema.parse(payload))
  assert.equal(payload.findings.length, 2)
  assert.equal(payload.orgId, 'org_acme')
})

test('REDACTION INVARIANT: a finding carrying a raw secret is rejected before egress', () => {
  const leaked = finding({ evidence: 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX0123456789' })
  assert.throws(
    () =>
      buildReportPayload([leaked], {
        orgId: 'org_acme',
        assetId: 'asset_pc1',
        actor: { type: 'device-token', subject: 'dana' },
        home: HOME,
        username: USER,
      }),
    (err: unknown) => err instanceof RedactionError,
  )
})

test('REDACTION INVARIANT: pushReport never calls fetch when a raw secret is present', async () => {
  // Bypass buildReportPayload to plant a raw secret directly in a valid-shaped payload.
  const poisoned = reportPayloadSchema.parse({
    schemaVersion: 1,
    orgId: 'org_acme',
    assetId: 'asset_pc1',
    actor: { type: 'device-token', subject: 'dana' },
    scannedAt: '2026-07-04T00:00:00.000Z',
    agentVersion: '0.3.0',
    findings: [
      {
        ruleId: 'github-token',
        surface: 'secret',
        severity: 'critical',
        location: 'src/x.ts:1',
        evidenceRedacted: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
        fingerprint: 'a'.repeat(32),
      },
    ],
  })
  let fetchCalled = false
  const fetchImpl: FetchLike = async () => {
    fetchCalled = true
    return { status: 202, text: async () => '{}' }
  }
  await assert.rejects(() => pushReport('https://cp.example', poisoned, deviceIdentity, { fetchImpl }), RedactionError)
  assert.equal(fetchCalled, false, 'fetch must not be called when redaction guard trips')
})

test('signBody is deterministic HMAC-SHA256 over timestamp.body', () => {
  const sig = signBody('{"a":1}', 1000, 'secret')
  assert.equal(sig, signBody('{"a":1}', 1000, 'secret'))
  assert.notEqual(sig, signBody('{"a":1}', 1001, 'secret'))
  assert.match(sig, /^[0-9a-f]{64}$/)
})

test('pushReport signs the exact body and sends device-token headers', async () => {
  const payload = buildReportPayload([finding()], {
    orgId: 'org_acme',
    assetId: 'asset_pc1',
    actor: { type: 'device-token', subject: 'dana' },
    home: HOME,
    username: USER,
  })
  let seen: { url: string; headers: Record<string, string>; body: string } | undefined
  const fetchImpl: FetchLike = async (url, init) => {
    seen = { url, headers: init.headers, body: init.body }
    return { status: 202, text: async () => '{"accepted":true,"newCriticalCount":1}' }
  }
  const result = await pushReport('https://cp.example/', payload, deviceIdentity, { fetchImpl, now: 1_000_000 })
  assert.equal(result.status, 202)
  assert.ok(seen)
  assert.equal(seen.url, 'https://cp.example/v1/reports')
  assert.equal(seen.headers['x-agentguard-timestamp'], '1000')
  assert.equal(seen.headers['x-agentguard-asset'], 'asset_pc1')
  assert.equal(seen.headers['x-agentguard-signature'], `v1=${signBody(seen.body, 1000, 'dev-secret-123')}`)
})

test('pushReport rejects invalid endpoints before fetch, including advisory capability probe', async () => {
  const payload = buildReportPayload([finding({ advisory: true })], { orgId: 'org_acme', assetId: 'asset_pc1', actor: deviceIdentity.actor, home: HOME, username: USER })
  let fetchCalls = 0
  const fetchImpl: FetchLike = async () => (fetchCalls += 1, { status: 200, text: async () => '{"schemaVersions":[2]}' })

  for (const endpoint of ['', '/v1/reports', 'ftp://cp.example', 'http://', 'notaurl']) {
    await assert.rejects(
      () => pushReport(endpoint, payload, deviceIdentity, { fetchImpl }),
      (err: unknown) => err instanceof ReportPushError && /report-push endpoint must be an absolute http\(s\) URL/.test(err.message),
    )
  }
  assert.equal(fetchCalls, 0)
})

test('pushReport sends OIDC bearer for the oidc credential', async () => {
  const payload = buildReportPayload([finding()], {
    orgId: 'org_acme',
    assetId: 'ci-github',
    actor: { type: 'oidc', subject: 'repo:acme/web', provider: 'github' },
    home: HOME,
    username: USER,
  })
  let auth: string | undefined
  const fetchImpl: FetchLike = async (_url, init) => {
    auth = init.headers['authorization']
    return { status: 202, text: async () => '{}' }
  }
  await pushReport('https://cp.example', payload, {
    orgId: 'org_acme',
    assetId: 'ci-github',
    actor: { type: 'oidc', subject: 'repo:acme/web', provider: 'github' },
    credential: { kind: 'oidc', token: 'jwt-token-xyz' },
  }, { fetchImpl })
  assert.equal(auth, 'Bearer jwt-token-xyz')
})

test('pushReport surfaces a non-202 response as ReportPushError', async () => {
  const payload = buildReportPayload([finding()], {
    orgId: 'org_acme',
    assetId: 'asset_pc1',
    actor: { type: 'device-token', subject: 'dana' },
    home: HOME,
    username: USER,
  })
  const fetchImpl: FetchLike = async () => ({ status: 401, text: async () => 'bad signature' })
  await assert.rejects(() => pushReport('https://cp.example', payload, deviceIdentity, { fetchImpl }), ReportPushError)
})

test('assertRedacted passes for a normal redacted payload', () => {
  const payload = buildReportPayload([finding(), finding({ id: 'email', category: 'pii', severity: 'medium', evidence: 'voc-…test' })], {
    orgId: 'o',
    assetId: 'a',
    actor: { type: 'device-token', subject: 's' },
    home: HOME,
    username: USER,
  })
  assert.doesNotThrow(() => assertRedacted(payload))
})

// ── enrollment ──────────────────────────────────────────────────────────────

test('resolveIdentity reads a device-token enrollment file', () => {
  const id = resolveIdentity({
    home: HOME,
    env: {},
    fileExists: () => true,
    readFile: () => JSON.stringify({ orgId: 'org_acme', assetId: 'asset_pc1', deviceToken: 'tok', subject: 'dana' }),
  })
  assert.equal(id.orgId, 'org_acme')
  assert.equal(id.credential.kind, 'device-token')
  assert.equal(id.actor.type, 'device-token')
})

test('resolveIdentity prefers OIDC env over the enrollment file', () => {
  const id = resolveIdentity({
    orgId: 'org_ci',
    env: { AGENTGUARD_OIDC_TOKEN: 'jwt', AGENTGUARD_OIDC_PROVIDER: 'gitlab' },
    fileExists: () => true,
    readFile: () => '{}',
  })
  assert.equal(id.credential.kind, 'oidc')
  assert.equal(id.actor.type, 'oidc')
  assert.equal(id.actor.provider, 'gitlab')
  assert.equal(id.orgId, 'org_ci')
})

test('resolveIdentity flag overrides win over the file', () => {
  const id = resolveIdentity({
    orgId: 'flag_org',
    assetId: 'flag_asset',
    home: HOME,
    env: {},
    fileExists: () => true,
    readFile: () => JSON.stringify({ orgId: 'file_org', assetId: 'file_asset', deviceToken: 'tok' }),
  })
  assert.equal(id.orgId, 'flag_org')
  assert.equal(id.assetId, 'flag_asset')
})

test('resolveIdentity errors clearly when nothing is enrolled', () => {
  assert.throws(
    () => resolveIdentity({ home: HOME, env: {}, fileExists: () => false }),
    (err: unknown) => err instanceof EnrollmentError,
  )
})

test('resolveIdentity errors when OIDC is set without an org', () => {
  assert.throws(
    () => resolveIdentity({ env: { AGENTGUARD_OIDC_TOKEN: 'jwt' }, fileExists: () => false }),
    (err: unknown) => err instanceof EnrollmentError,
  )
})
