import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createControlPlane, type ControlPlaneDeps } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { SqliteStorage } from '../src/storage/sqlite.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { StaticViewerAuth } from '../src/verify/viewer.js'
import { handleGetMcpCatalog, handlePutMcpCatalog, MCP_CATALOG_SEED, seedMcpCatalog } from '../src/mcp-catalog.js'
import { riskScore, summarize } from '../src/aggregate.js'
import type { AssetRecord, FindingRecord } from '../src/model.js'
import type { StoragePort } from '../src/storage/port.js'
// [R3/NEW-CR-1/§6.6] The mcp-unapproved scanner rule lives in the main
// package; importing it here exercises the exact function the CLI calls,
// without duplicating scanner logic in the control plane.
import { scanMcpConfig } from '../../src/scanner.js'
import { riskScore as cliRiskScore } from '../../src/report.js'
import type { Finding } from '../../src/rules.js'

async function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
async function put(base: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
async function get(base: string, path: string, headers: Record<string, string> = {}): Promise<{ status: number; json: any; etag: string | null }> {
  const res = await fetch(`${base}${path}`, { headers })
  return { status: res.status, json: await res.json().catch(() => ({})), etag: res.headers.get('etag') }
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

function baseDeps(): ControlPlaneDeps {
  return {
    storage: new MemoryStorage(),
    notifier: new RecordingNotifier(),
    oidcVerifier: new StaticOidcVerifier(),
    viewerAuth: new StaticViewerAuth(),
    now: () => Date.now(),
  } as ControlPlaneDeps
}

// ── CRUD authz + seed + org isolation ──────────────────────────────────────

test('seed loads: a fresh org GETs the well-known-server seed list, all approved:false', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const res = await get(base, '/v1/mcp/catalog', { authorization: `Bearer ${reg.json.sessionToken}` })
    assert.equal(res.status, 200)
    assert.equal(res.json.mcpStrictMode, false)
    assert.equal(res.json.entries.length, MCP_CATALOG_SEED.length)
    assert.ok(res.json.entries.every((e: { approved: boolean }) => e.approved === false))
    const names = res.json.entries.map((e: { serverName: string }) => e.serverName).sort()
    assert.deepEqual(names, [...MCP_CATALOG_SEED.map((s) => s.serverName)].sort())
    assert.ok(res.etag, 'GET sets an ETag')
  })
})

test('a repeat GET returns the same ETag (seed is persisted, not re-generated per request)', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'a@acme.test', password: 'adminpass1' })
    const auth = { authorization: `Bearer ${reg.json.sessionToken}` }
    const first = await get(base, '/v1/mcp/catalog', auth)
    const second = await get(base, '/v1/mcp/catalog', auth)
    assert.equal(first.etag, second.etag)
    const conditional = await get(base, '/v1/mcp/catalog', { ...auth, 'if-none-match': first.etag! })
    assert.equal(conditional.status, 304)
  })
})

test('CRUD authz: a non-admin (member) PUT is rejected with 403; admin PUT succeeds', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const adminToken = reg.json.sessionToken as string
    const invite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${adminToken}` })
    const accepted = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'memberpass1' })
    const memberToken = accepted.json.sessionToken as string

    const memberPut = await put(
      base,
      '/v1/mcp/catalog',
      { entries: [{ serverName: 'filesystem', approved: true, riskTags: [] }] },
      { authorization: `Bearer ${memberToken}` },
    )
    assert.equal(memberPut.status, 403)

    const adminPut = await put(
      base,
      '/v1/mcp/catalog',
      { entries: [{ serverName: 'filesystem', approved: true, riskTags: ['filesystem-access'], note: 'reviewed' }], mcpStrictMode: true },
      { authorization: `Bearer ${adminToken}` },
    )
    assert.equal(adminPut.status, 200)
    assert.equal(adminPut.json.mcpStrictMode, true)
    assert.equal(adminPut.json.entries[0].approved, true)
    assert.equal(typeof adminPut.json.entries[0].updatedBy, 'string')
    assert.ok(adminPut.json.entries[0].updatedBy.length > 0)

    const after = await get(base, '/v1/mcp/catalog', { authorization: `Bearer ${adminToken}` })
    assert.equal(after.json.entries.length, 1, 'PUT replaces the catalog wholesale')
    assert.equal(after.json.entries[0].serverName, 'filesystem')
    assert.equal(after.json.mcpStrictMode, true)
  })
})

test('PUT rejects a malformed entry (missing serverName / non-boolean approved)', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'a2@acme.test', password: 'adminpass1' })
    const auth = { authorization: `Bearer ${reg.json.sessionToken}` }
    assert.equal((await put(base, '/v1/mcp/catalog', { entries: [{ approved: true }] }, auth)).status, 400)
    assert.equal((await put(base, '/v1/mcp/catalog', { entries: [{ serverName: 'x' }] }, auth)).status, 400)
    assert.equal((await put(base, '/v1/mcp/catalog', { entries: 'nope' }, auth)).status, 400)
  })
})

test('ORG ISOLATION: org B never sees org A catalog edits, and each org gets its own independent seed', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const regA = await post(base, '/v1/auth/register', { orgName: 'OrgA', email: 'a@a.test', password: 'passwordA1' })
    const regB = await post(base, '/v1/auth/register', { orgName: 'OrgB', email: 'b@b.test', password: 'passwordB1' })

    await put(
      base,
      '/v1/mcp/catalog',
      { entries: [{ serverName: 'filesystem', approved: true, riskTags: [] }], mcpStrictMode: true },
      { authorization: `Bearer ${regA.json.sessionToken}` },
    )

    const bCatalog = await get(base, '/v1/mcp/catalog', { authorization: `Bearer ${regB.json.sessionToken}` })
    assert.equal(bCatalog.json.mcpStrictMode, false, "org B's strict mode is unaffected by org A's PUT")
    assert.equal(bCatalog.json.entries.length, MCP_CATALOG_SEED.length, 'org B still sees its own untouched seed')
    assert.ok(bCatalog.json.entries.every((e: { approved: boolean }) => e.approved === false))
  })
})

test('a viewer (legacy) token can GET the catalog but cannot PUT it (no principal/role)', async () => {
  const deps = baseDeps()
  const viewerAuth = deps.viewerAuth as StaticViewerAuth
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'v@acme.test', password: 'adminpass1' })
    viewerAuth.add('vk-org', reg.json.orgId)

    const viaViewer = await get(base, '/v1/mcp/catalog', { authorization: 'Bearer vk-org' })
    assert.equal(viaViewer.status, 200)

    const putRes = await put(base, '/v1/mcp/catalog', { entries: [] }, { authorization: 'Bearer vk-org' })
    assert.equal(putRes.status, 401, 'a viewer token never resolves to an admin Principal')
  })
})

// ── seed/persistence directly against the port (both adapters) ─────────────

for (const [adapterName, makeStorage] of [
  ['MemoryStorage', () => new MemoryStorage() as StoragePort] as const,
  ['SqliteStorage', () => new SqliteStorage(':memory:') as StoragePort] as const,
]) {
  test(`${adapterName}: getMcpCatalog/putMcpCatalog/getMcpStrictMode/setMcpStrictMode round-trip, org-scoped`, () => {
    const storage = makeStorage()
    try {
      assert.deepEqual(storage.getMcpCatalog('orgA'), [])
      assert.equal(storage.getMcpStrictMode('orgA'), false)

      const seeded = seedMcpCatalog('orgA', 1000)
      storage.putMcpCatalog('orgA', seeded)
      storage.setMcpStrictMode('orgA', true)

      const fetched = storage.getMcpCatalog('orgA')
      assert.equal(fetched.length, seeded.length)
      assert.equal(storage.getMcpStrictMode('orgA'), true)

      // org isolation at the storage layer
      assert.deepEqual(storage.getMcpCatalog('orgB'), [])
      assert.equal(storage.getMcpStrictMode('orgB'), false)

      // PUT replaces wholesale
      storage.putMcpCatalog('orgA', [{ orgId: 'orgA', serverName: 'github', approved: true, riskTags: ['x'], updatedBy: 'u1', updatedAt: 2000 }])
      const replaced = storage.getMcpCatalog('orgA')
      assert.equal(replaced.length, 1)
      assert.equal(replaced[0]!.serverName, 'github')
      assert.equal(replaced[0]!.approved, true)
    } finally {
      storage.close()
    }
  })
}

// ── scanner integration: mcp-unapproved advisory finding ────────────────────

const FS_CONFIG = JSON.stringify({ mcpServers: { filesystem: { command: 'npx', args: ['mcp-server-filesystem'] } } })

test('scanMcpConfig: no catalog provided -> zero new findings (byte-identical to pre-catalog behavior)', () => {
  const findings = scanMcpConfig(FS_CONFIG)
  assert.equal(findings.some((f) => f.id === 'mcp-unapproved'), false)
})

test('scanMcpConfig: an unapproved local server yields a low-severity advisory finding', () => {
  const findings = scanMcpConfig(FS_CONFIG, undefined, { entries: [{ serverName: 'filesystem', approved: false }] })
  const unapproved = findings.find((f) => f.id === 'mcp-unapproved')
  assert.ok(unapproved, 'mcp-unapproved finding is present')
  assert.equal(unapproved!.severity, 'low')
  assert.equal(unapproved!.advisory, true)
})

test('scanMcpConfig: strict mode bumps the unapproved finding to medium (still advisory)', () => {
  const findings = scanMcpConfig(FS_CONFIG, undefined, { entries: [{ serverName: 'filesystem', approved: false }], strictMode: true })
  const unapproved = findings.find((f) => f.id === 'mcp-unapproved')
  assert.ok(unapproved)
  assert.equal(unapproved!.severity, 'medium')
  assert.equal(unapproved!.advisory, true)
})

test('scanMcpConfig: an approved server yields no mcp-unapproved finding', () => {
  const findings = scanMcpConfig(FS_CONFIG, undefined, { entries: [{ serverName: 'filesystem', approved: true }] })
  assert.equal(findings.some((f) => f.id === 'mcp-unapproved'), false)
})

// ── advisory exclusion: exit codes (main package) + aggregates (control-plane) ──

test('advisory findings never gate the CLI risk-score-driven exit code (report.ts riskScore)', () => {
  const advisoryCritical: Finding = {
    id: 'mcp-unapproved',
    title: 'x',
    severity: 'critical', // pathological input: even a hypothetical critical advisory must not count
    category: 'mcp-risk',
    evidence: 'x',
    recommendation: 'x',
    advisory: true,
  }
  const normalLow: Finding = { id: 'y', title: 'y', severity: 'low', category: 'mcp-risk', evidence: 'y', recommendation: 'y' }
  assert.equal(cliRiskScore([advisoryCritical]), 0, 'an advisory finding contributes nothing to the score')
  assert.equal(cliRiskScore([advisoryCritical, normalLow]), 1, 'only the non-advisory finding counts')
})

test('advisory findings are excluded from control-plane summarize()/riskScore() aggregates', () => {
  const asset: AssetRecord = { orgId: 'o', assetId: 'a1', label: 'a1', kind: 'pc', authKind: 'device-token', lastSeenAt: null, createdAt: 0 }
  const advisory: FindingRecord = {
    orgId: 'o',
    assetId: 'a1',
    ruleId: 'mcp-unapproved',
    surface: 'mcp-risk',
    severity: 'critical',
    location: 'mcp-config',
    evidenceRedacted: 'filesystem',
    fingerprint: '1'.repeat(32),
    firstSeen: 0,
    lastSeen: 0,
    status: 'open',
    advisory: true,
  }
  const normal: FindingRecord = {
    orgId: 'o',
    assetId: 'a1',
    ruleId: 'openai-key',
    surface: 'secret',
    severity: 'high',
    location: '~/.zshrc',
    evidenceRedacted: 'sk-p…0000',
    fingerprint: '2'.repeat(32),
    firstSeen: 0,
    lastSeen: 0,
    status: 'open',
  }
  const summary = summarize([advisory, normal], [asset])
  assert.equal(summary.totalFindings, 1, 'the advisory finding is excluded from the total')
  assert.equal(summary.bySeverity.critical, 0, 'the advisory finding never inflates a severity bucket')
  assert.equal(summary.bySeverity.high, 1)
  assert.equal(summary.riskScore, 3, 'riskScore only reflects the non-advisory high finding')
  assert.equal(riskScore([advisory, normal]), 3)
})
