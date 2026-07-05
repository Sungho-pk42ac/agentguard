import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createControlPlane, type ControlPlaneDeps } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { StaticViewerAuth } from '../src/verify/viewer.js'
import { deviceHeaders, finding, oidcHeaders, payload } from './helpers.js'

async function postJson(base: string, path: string, body: string, headers: Record<string, string>): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
async function getJson(base: string, path: string, viewerKey?: string): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = viewerKey ? { authorization: `Bearer ${viewerKey}` } : {}
  const res = await fetch(`${base}${path}`, { headers })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

test('E2E: 3 assets enroll -> report -> authorized dashboard aggregates -> one alert; re-report no dup; tenant isolation', async () => {
  const storage = new MemoryStorage()
  const notifier = new RecordingNotifier()
  const oidc = new StaticOidcVerifier({ 'ci-token': { subject: 'repo:acme/web', provider: 'github' } })
  const viewerAuth = new StaticViewerAuth({ 'vk-orgA': 'orgA', 'vk-orgB': 'orgB' })
  // seed one-time PC enrollment codes and the OIDC enrollment grant for orgA
  storage.putEnrollmentCode('orgA', createHash('sha256').update('CODE1').digest('hex'), Date.now() + 3_600_000)
  storage.putEnrollmentCode('orgA', createHash('sha256').update('CODE2').digest('hex'), Date.now() + 3_600_000)
  storage.grantOidc('orgA', 'github', 'repo:acme/web')

  const deps: ControlPlaneDeps = { storage, notifier, oidcVerifier: oidc, viewerAuth, now: () => Date.now(), freshnessWindowSec: 300, staleThresholdHours: 48 }
  const server = createControlPlane(deps)
  server.listen(0, '127.0.0.1')
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
    assert.equal((await postJson(base, '/v1/reports', body2, deviceHeaders('pc2', tok2, body2, ts))).status, 202)

    const body3 = JSON.stringify(
      payload('orgA', 'ci1', [finding({ severity: 'medium', surface: 'secret', fingerprint: '3'.repeat(32) })], {
        actor: { type: 'oidc', subject: 'repo:acme/web', provider: 'github' },
      }),
    )
    assert.equal((await postJson(base, '/v1/reports', body3, oidcHeaders('ci1', 'ci-token', ts))).status, 202)

    // ── read access is AUTHORIZED: no token -> 401 ──
    assert.equal((await getJson(base, '/v1/dashboard/summary')).status, 401)
    assert.equal((await getJson(base, '/v1/findings')).status, 401)

    // ── authorized read for orgA aggregates all three assets ──
    const summary = await getJson(base, '/v1/dashboard/summary', 'vk-orgA')
    assert.equal(summary.status, 200)
    assert.equal(summary.json.totalFindings, 3)
    assert.equal(summary.json.byAsset.length, 3)
    assert.equal(summary.json.bySeverity.critical, 1)

    assert.equal((await getJson(base, '/v1/assets', 'vk-orgA')).json.assets.length, 3)
    assert.equal((await getJson(base, '/v1/dashboard/trend?window=30d', 'vk-orgA')).json.points.length, 30)
    // window is clamped (no event-loop DoS)
    assert.equal((await getJson(base, '/v1/dashboard/trend?window=999999999d', 'vk-orgA')).json.points.length, 365)

    // ── exactly one alert for the single critical finding ──
    assert.equal(notifier.sent.length, 1)

    // ── re-report the critical finding: no duplicate alert ──
    const ts2 = Math.floor(Date.now() / 1000)
    const rDup = await postJson(base, '/v1/reports', body1, deviceHeaders('pc1', tok1, body1, ts2))
    assert.equal(rDup.json.newCriticalCount, 0)
    assert.equal(notifier.sent.length, 1, 'dedup: still one alert after re-report')

    // ── TENANT ISOLATION: an orgB viewer token sees only orgB (empty), never orgA ──
    const orgBSummary = await getJson(base, '/v1/dashboard/summary', 'vk-orgB')
    assert.equal(orgBSummary.json.totalFindings, 0)
    assert.equal((await getJson(base, '/v1/findings', 'vk-orgB')).json.findings.length, 0)
    assert.equal((await getJson(base, '/v1/findings', 'vk-orgA')).json.findings.length, 3)

    // ── §M2f: the control plane is a pure JSON API by default — the root and
    //    /dashboard HTML routes are demoted to an opt-in dev aid (covered in
    //    dashboard-demote.test.ts). Here we pin that even an authorized viewer
    //    token gets a JSON 404, never server-rendered HTML. ──
    const rootRes = await fetch(`${base}/?key=vk-orgA`)
    assert.equal(rootRes.status, 404)
    assert.match(rootRes.headers.get('content-type') ?? '', /application\/json/)
  } finally {
    server.close()
    await once(server, 'close')
    storage.close()
  }
})
