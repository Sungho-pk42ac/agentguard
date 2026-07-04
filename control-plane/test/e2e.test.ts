import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createControlPlane, type ControlPlaneDeps } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { deviceHeaders, finding, oidcHeaders, payload } from './helpers.js'

async function postJson(base: string, path: string, body: string, headers: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
async function getJson(base: string, path: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`)
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

test('E2E: 3 assets enroll -> report -> dashboard aggregates -> exactly one alert; re-report no dup; tenant isolation', async () => {
  const storage = new MemoryStorage()
  const notifier = new RecordingNotifier()
  const oidc = new StaticOidcVerifier()
  oidc.add('ci-token', { subject: 'repo:acme/web', provider: 'github' })
  // seed a one-time PC enrollment code for orgA
  storage.putEnrollmentCode('orgA', createHash('sha256').update('CODE1').digest('hex'), Date.now() + 3_600_000)
  storage.putEnrollmentCode('orgA', createHash('sha256').update('CODE2').digest('hex'), Date.now() + 3_600_000)

  const deps: ControlPlaneDeps = { storage, notifier, oidcVerifier: oidc, now: () => Date.now(), freshnessWindowSec: 300, staleThresholdHours: 48 }
  const server = createControlPlane(deps)
  server.listen(0)
  await once(server, 'listening')
  const port = (server.address() as AddressInfo).port
  const base = `http://127.0.0.1:${port}`

  try {
    // ── enroll 2 device PCs + 1 CI (OIDC) ──
    const e1 = await postJson(base, '/v1/enroll', JSON.stringify({ orgId: 'orgA', enrollmentCode: 'CODE1', assetId: 'pc1', assetLabel: 'Dana PC' }), { 'content-type': 'application/json' })
    const e2 = await postJson(base, '/v1/enroll', JSON.stringify({ orgId: 'orgA', enrollmentCode: 'CODE2', assetId: 'pc2', assetLabel: 'Sam PC' }), { 'content-type': 'application/json' })
    const e3 = await postJson(base, '/v1/enroll', JSON.stringify({ orgId: 'orgA', oidcToken: 'ci-token', assetId: 'ci1', assetLabel: 'GH Actions' }), { 'content-type': 'application/json' })
    assert.equal(e1.status, 200)
    assert.equal(e2.status, 200)
    assert.equal(e3.status, 200)
    const tok1: string = e1.json.deviceToken
    const tok2: string = e2.json.deviceToken
    assert.ok(tok1 && tok2, 'device tokens issued')

    // ── report from each asset ──
    const ts = Math.floor(Date.now() / 1000)
    const body1 = JSON.stringify(payload('orgA', 'pc1', [finding({ severity: 'critical', fingerprint: '1'.repeat(32) })]))
    const r1 = await postJson(base, '/v1/reports', body1, deviceHeaders('pc1', tok1, body1, ts))
    assert.equal(r1.status, 202)
    assert.equal(r1.json.newCriticalCount, 1)

    const body2 = JSON.stringify(payload('orgA', 'pc2', [finding({ severity: 'high', surface: 'mcp-risk', fingerprint: '2'.repeat(32) })]))
    const r2 = await postJson(base, '/v1/reports', body2, deviceHeaders('pc2', tok2, body2, ts))
    assert.equal(r2.status, 202)

    const body3 = JSON.stringify(
      payload('orgA', 'ci1', [finding({ severity: 'medium', surface: 'secret', fingerprint: '3'.repeat(32) })], {
        actor: { type: 'oidc', subject: 'repo:acme/web', provider: 'github' },
      }),
    )
    const r3 = await postJson(base, '/v1/reports', body3, oidcHeaders('ci1', 'ci-token', ts))
    assert.equal(r3.status, 202)

    // ── dashboard aggregates all three assets ──
    const summary = await getJson(base, '/v1/dashboard/summary?org=orgA')
    assert.equal(summary.status, 200)
    assert.equal(summary.json.totalFindings, 3)
    assert.equal(summary.json.byAsset.length, 3)
    assert.equal(summary.json.bySeverity.critical, 1)

    const assets = await getJson(base, '/v1/assets?org=orgA')
    assert.equal(assets.json.assets.length, 3)

    const trend = await getJson(base, '/v1/dashboard/trend?org=orgA&window=30d')
    assert.equal(trend.json.points.length, 30)

    // ── exactly one alert fired for the single critical finding ──
    assert.equal(notifier.sent.length, 1)

    // ── re-report the critical finding: no duplicate alert ──
    const ts2 = Math.floor(Date.now() / 1000)
    const rDup = await postJson(base, '/v1/reports', body1, deviceHeaders('pc1', tok1, body1, ts2))
    assert.equal(rDup.status, 202)
    assert.equal(rDup.json.newCriticalCount, 0)
    assert.equal(notifier.sent.length, 1, 'dedup: still one alert after re-report')

    // ── tenant isolation: orgB sees nothing ──
    const otherOrg = await getJson(base, '/v1/dashboard/summary?org=orgB')
    assert.equal(otherOrg.json.totalFindings, 0)
    const findingsA = await getJson(base, '/v1/findings?org=orgA')
    const findingsB = await getJson(base, '/v1/findings?org=orgB')
    assert.equal(findingsA.json.findings.length, 3)
    assert.equal(findingsB.json.findings.length, 0)

    // ── HTML dashboard renders ──
    const html = await fetch(`${base}/?org=orgA`).then((r) => r.text())
    assert.match(html, /AgentGuard Control Plane/)
    assert.match(html, /BLOCK/) // critical present -> BLOCK verdict badge
  } finally {
    server.close()
    await once(server, 'close')
    storage.close()
  }
})
