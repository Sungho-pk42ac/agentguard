import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleReport, type IngestDeps } from '../src/ingest.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import type { AssetRecord } from '../src/model.js'
import { deviceHeaders, finding, payload } from './helpers.js'

// [R3/NEW-CR-1] Server-side half of the wire cross-version compatibility
// contract: ONE schema validates both v1 and v2 payloads (a and b below). The
// client-side negotiation scenarios (c)/(d) live in test/wire-skew.test.ts at
// the repo root.

const NOW_MS = Date.UTC(2026, 6, 4, 12, 0, 0)
const TS = Math.floor(NOW_MS / 1000)
const SECRET = 'device-secret-xyz'

interface Ctx {
  deps: IngestDeps
  storage: MemoryStorage
}

function ctx(): Ctx {
  const storage = new MemoryStorage()
  return {
    storage,
    deps: { storage, notifier: new RecordingNotifier(), oidcVerifier: new StaticOidcVerifier(), now: () => NOW_MS, freshnessWindowSec: 300 },
  }
}

function deviceAsset(orgId: string, assetId: string): AssetRecord {
  return { orgId, assetId, label: assetId, kind: 'pc', authKind: 'device-token', secret: SECRET, lastSeenAt: null, createdAt: 0 }
}

test('(a) a v1 payload (no advisory findings) is accepted (202) by a v2-capable server', async () => {
  const c = ctx()
  await c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const body = JSON.stringify(payload('orgA', 'pc1', [finding()], { schemaVersion: 1 }))
  const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, TS), c.deps)
  assert.equal(res.status, 202)
  assert.equal((await c.storage.listFindings('orgA')).length, 1)
})

test('(b) a v2 payload with an advisory finding is accepted (202) and the advisory flag is stored', async () => {
  const c = ctx()
  await c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const advisoryFinding = finding({
    ruleId: 'mcp-unapproved',
    surface: 'mcp-risk',
    severity: 'low',
    evidenceRedacted: 'filesystem',
    advisory: true,
  })
  const body = JSON.stringify(payload('orgA', 'pc1', [advisoryFinding, finding()], { schemaVersion: 2 }))
  const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, TS), c.deps)
  assert.equal(res.status, 202)

  const stored = await c.storage.listFindings('orgA')
  assert.equal(stored.length, 2)
  const storedAdvisory = stored.find((f) => f.ruleId === 'mcp-unapproved')
  assert.equal(storedAdvisory?.advisory, true, 'the advisory flag must survive persistence')
  const storedNormal = stored.find((f) => f.ruleId === 'openai-key')
  assert.notEqual(storedNormal?.advisory, true, 'a non-advisory finding must not be marked advisory')
})

test('a re-report toggling advisory off updates the stored flag (upsert keeps advisory in sync)', async () => {
  const c = ctx()
  await c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const shared = { ruleId: 'mcp-unapproved', surface: 'mcp-risk', severity: 'low' as const, evidenceRedacted: 'filesystem', location: 'mcp-config' }
  const advisoryFinding = finding({ ...shared, advisory: true })
  const body1 = JSON.stringify(payload('orgA', 'pc1', [advisoryFinding], { schemaVersion: 2 }))
  await handleReport(body1, deviceHeaders('pc1', SECRET, body1, TS), c.deps)
  assert.equal((await c.storage.listFindings('orgA'))[0]?.advisory, true)

  const approvedFinding = finding({ ...shared, advisory: false })
  const body2 = JSON.stringify(payload('orgA', 'pc1', [approvedFinding], { schemaVersion: 1 }))
  await handleReport(body2, deviceHeaders('pc1', SECRET, body2, TS), c.deps)
  assert.notEqual((await c.storage.listFindings('orgA'))[0]?.advisory, true, 'advisory:false must clear the stored flag on re-report')
})

test('report nonce rejects same org+asset replay before a second ingest is recorded', async () => {
  const c = ctx()
  await c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const body = JSON.stringify(payload('orgA', 'pc1', [finding()]))
  const headers = { ...deviceHeaders('pc1', SECRET, body, TS), 'x-agentguard-nonce': 'nonce-123' }

  const first = await handleReport(body, headers, c.deps)
  assert.equal(first.status, 202)

  const replay = await handleReport(body, headers, c.deps)
  assert.ok(replay.status === 401 || replay.status === 409, `expected replay rejection, got ${replay.status}`)
  assert.match(String(replay.json.error ?? ''), /replay|nonce/i)

  const ingests = (c.storage as any).ingests as unknown[]
  assert.equal(ingests.length, 1, 'replay must be rejected before recordIngest')
})

test('report nonce replay cache is scoped by org and asset', async () => {
  const c = ctx()
  await c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  await c.storage.createAsset(deviceAsset('orgA', 'pc2'))
  const body1 = JSON.stringify(payload('orgA', 'pc1', [finding({ location: 'pc1' })]))
  const body2 = JSON.stringify(payload('orgA', 'pc2', [finding({ location: 'pc2' })]))

  const pc1 = await handleReport(body1, { ...deviceHeaders('pc1', SECRET, body1, TS), 'x-agentguard-nonce': 'shared-nonce' }, c.deps)
  const pc2 = await handleReport(body2, { ...deviceHeaders('pc2', SECRET, body2, TS), 'x-agentguard-nonce': 'shared-nonce' }, c.deps)

  assert.equal(pc1.status, 202)
  assert.equal(pc2.status, 202)
  assert.equal((c.storage as any).ingests.length, 2)
})

test('malformed report nonce is rejected instead of bypassing replay protection', async () => {
  const c = ctx()
  await c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const body = JSON.stringify(payload('orgA', 'pc1', [finding()]))
  const blank = await handleReport(body, { ...deviceHeaders('pc1', SECRET, body, TS), 'x-agentguard-nonce': '   ' }, c.deps)
  assert.equal(blank.status, 400)
  assert.match(String(blank.json.error ?? ''), /nonce/i)

  const tooLong = await handleReport(body, { ...deviceHeaders('pc1', SECRET, body, TS), 'x-agentguard-jti': 'n'.repeat(257) }, c.deps)
  assert.equal(tooLong.status, 400)
  assert.match(String(tooLong.json.error ?? ''), /nonce/i)

  const duplicateHeader = await handleReport(
    body,
    { ...deviceHeaders('pc1', SECRET, body, TS), 'x-agentguard-nonce': ['nonce-a', 'nonce-b'] } as any,
    c.deps,
  )
  assert.equal(duplicateHeader.status, 400)
  assert.match(String(duplicateHeader.json.error ?? ''), /nonce/i)

  assert.equal((c.storage as any).ingests.length, 0, 'malformed nonce must fail before recordIngest')
})
