import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleReport, type IngestDeps } from '../src/ingest.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import type { AssetRecord } from '../src/model.js'
import { deviceHeaders, finding, oidcHeaders, payload } from './helpers.js'

const NOW_MS = Date.UTC(2026, 6, 4, 12, 0, 0)
const TS = Math.floor(NOW_MS / 1000)
const SECRET = 'device-secret-xyz'

interface Ctx {
  deps: IngestDeps
  storage: MemoryStorage
  notifier: RecordingNotifier
  oidc: StaticOidcVerifier
}

function ctx(): Ctx {
  const storage = new MemoryStorage()
  const notifier = new RecordingNotifier()
  const oidc = new StaticOidcVerifier()
  return { storage, notifier, oidc, deps: { storage, notifier, oidcVerifier: oidc, now: () => NOW_MS, freshnessWindowSec: 300 } }
}

function deviceAsset(orgId: string, assetId: string): AssetRecord {
  return { orgId, assetId, label: assetId, kind: 'pc', authKind: 'device-token', secret: SECRET, lastSeenAt: null, createdAt: 0 }
}

test('valid signed device report is accepted (202) and persisted', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const body = JSON.stringify(payload('orgA', 'pc1', [finding()]))
  const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, TS), c.deps)
  assert.equal(res.status, 202)
  assert.equal(res.json.accepted, true)
  assert.equal(c.storage.listFindings('orgA').length, 1)
  assert.equal(c.storage.getAsset('orgA', 'pc1')?.lastSeenAt, NOW_MS)
})

test('tampered body fails signature verification (401)', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const signedBody = JSON.stringify(payload('orgA', 'pc1', [finding()]))
  const headers = deviceHeaders('pc1', SECRET, signedBody, TS)
  const tamperedBody = JSON.stringify(payload('orgA', 'pc1', [finding({ severity: 'low' })]))
  const res = await handleReport(tamperedBody, headers, c.deps)
  assert.equal(res.status, 401)
  assert.equal(c.storage.listFindings('orgA').length, 0)
})

test('stale timestamp is rejected (401)', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const staleTs = TS - 1000 // > 300s window
  const body = JSON.stringify(payload('orgA', 'pc1', [finding()]))
  const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, staleTs), c.deps)
  assert.equal(res.status, 401)
})

test('unknown/unenrolled asset is rejected (401)', async () => {
  const c = ctx()
  const body = JSON.stringify(payload('orgA', 'ghost', [finding()]))
  const res = await handleReport(body, deviceHeaders('ghost', SECRET, body, TS), c.deps)
  assert.equal(res.status, 401)
})

test('asset header/body mismatch is rejected (401)', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const body = JSON.stringify(payload('orgA', 'pc1', [finding()]))
  const headers = { ...deviceHeaders('pc1', SECRET, body, TS), 'x-agentguard-asset': 'pc2' }
  const res = await handleReport(body, headers, c.deps)
  assert.equal(res.status, 401)
})

test('schema-invalid body is rejected (422) after auth passes', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  // valid-enough to carry org/asset, but findings has a bad severity -> schema fails
  const badBody = JSON.stringify({
    schemaVersion: 1,
    orgId: 'orgA',
    assetId: 'pc1',
    actor: { type: 'device-token', subject: 's' },
    scannedAt: '2026-07-04T00:00:00Z',
    agentVersion: '0.3.0',
    findings: [{ ruleId: 'x', surface: 'secret', severity: 'nope', location: 'a', evidenceRedacted: 'b', fingerprint: 'a'.repeat(32) }],
  })
  const res = await handleReport(badBody, deviceHeaders('pc1', SECRET, badBody, TS), c.deps)
  assert.equal(res.status, 422)
  assert.equal(c.storage.listFindings('orgA').length, 0)
})

test('ADVERSARIAL: a raw secret the client sweep missed is rejected (422), nothing stored', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const leaked = finding({ evidenceRedacted: 'Zx9Kq2Lm7Pv4Rt8Nw1Yb6Hd3Fg5Jc0Aq2Ws4Ex7' })
  const body = JSON.stringify(payload('orgA', 'pc1', [leaked]))
  const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, TS), c.deps)
  assert.equal(res.status, 422)
  assert.match(String(res.json.error), /redaction/)
  assert.equal(c.storage.listFindings('orgA').length, 0, 'a redaction-failing report must not be stored')
})

test('TENANT ISOLATION: a report claiming another org for the asset is rejected', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  // attacker signs a body claiming orgB for pc1; getAsset(orgB, pc1) misses -> 401
  const body = JSON.stringify(payload('orgB', 'pc1', [finding()]))
  const res = await handleReport(body, deviceHeaders('pc1', SECRET, body, TS), c.deps)
  assert.equal(res.status, 401)
  assert.equal(c.storage.listFindings('orgB').length, 0)
})

test('OIDC bearer report is accepted for an enrolled oidc asset', async () => {
  const c = ctx()
  c.storage.createAsset({
    orgId: 'orgA',
    assetId: 'ci-github',
    label: 'CI',
    kind: 'ci',
    authKind: 'oidc',
    subject: 'repo:acme/web',
    provider: 'github',
    lastSeenAt: null,
    createdAt: 0,
  })
  c.oidc.add('jwt-abc', { subject: 'repo:acme/web', provider: 'github' })
  const body = JSON.stringify(
    payload('orgA', 'ci-github', [finding()], { actor: { type: 'oidc', subject: 'repo:acme/web', provider: 'github' } }),
  )
  const res = await handleReport(body, oidcHeaders('ci-github', 'jwt-abc', TS), c.deps)
  assert.equal(res.status, 202)
})

test('OIDC report with an unknown token is rejected (401)', async () => {
  const c = ctx()
  c.storage.createAsset({
    orgId: 'orgA',
    assetId: 'ci-github',
    label: 'CI',
    kind: 'ci',
    authKind: 'oidc',
    subject: 'repo:acme/web',
    provider: 'github',
    lastSeenAt: null,
    createdAt: 0,
  })
  const body = JSON.stringify(
    payload('orgA', 'ci-github', [finding()], { actor: { type: 'oidc', subject: 'repo:acme/web', provider: 'github' } }),
  )
  const res = await handleReport(body, oidcHeaders('ci-github', 'forged-token', TS), c.deps)
  assert.equal(res.status, 401)
})

test('ALERT DEDUP: a new critical fires exactly one alert; a re-report fires none', async () => {
  const c = ctx()
  c.storage.createAsset(deviceAsset('orgA', 'pc1'))
  const body = JSON.stringify(payload('orgA', 'pc1', [finding({ severity: 'critical' })]))
  const first = await handleReport(body, deviceHeaders('pc1', SECRET, body, TS), c.deps)
  assert.equal(first.json.newCriticalCount, 1)
  assert.equal(c.notifier.sent.length, 1)

  const second = await handleReport(body, deviceHeaders('pc1', SECRET, body, TS), c.deps)
  assert.equal(second.json.newCriticalCount, 0)
  assert.equal(c.notifier.sent.length, 1, 'no duplicate alert on re-report')
})
