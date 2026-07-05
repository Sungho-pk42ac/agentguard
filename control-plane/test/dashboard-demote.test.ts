import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createControlPlane, type ControlPlaneDeps } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { StaticViewerAuth } from '../src/verify/viewer.js'

async function withServer<T>(overrides: Partial<ControlPlaneDeps>, fn: (base: string) => Promise<T>): Promise<T> {
  const deps = {
    storage: new MemoryStorage(),
    notifier: new RecordingNotifier(),
    oidcVerifier: new StaticOidcVerifier(),
    viewerAuth: new StaticViewerAuth({ 'vk-orgA': 'orgA' }),
    now: () => Date.now(),
    ...overrides,
  } as ControlPlaneDeps
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

// §M2f: the control plane is a pure JSON API by default; the server-rendered
// HTML dashboard is opt-in (enableHtmlDashboard) for dev/local inspection only.
test('M2f: by default (pure API) / and /dashboard return 404 JSON, not HTML — even with a valid viewer token', async () => {
  await withServer({}, async (base) => {
    for (const path of ['/', '/dashboard']) {
      const res = await fetch(`${base}${path}`, { headers: { authorization: 'Bearer vk-orgA' } })
      assert.equal(res.status, 404, `${path} is 404 in pure-API mode`)
      assert.match(res.headers.get('content-type') ?? '', /application\/json/, `${path} answers JSON, never HTML`)
      const json = await res.json()
      assert.match(json.error, /pure JSON API/)
    }
  })
})

test('M2f: the JSON dashboard API (/v1/dashboard/summary) still works in pure-API mode', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/v1/dashboard/summary`, { headers: { authorization: 'Bearer vk-orgA' } })
    assert.equal(res.status, 200, 'the machine-facing /v1 API is unaffected by the HTML demotion')
    const json = await res.json()
    assert.equal(typeof json.totalFindings, 'number')
  })
})

test('M2f: opt-in enableHtmlDashboard restores the server-rendered HTML dashboard for dev', async () => {
  await withServer({ enableHtmlDashboard: true }, async (base) => {
    const ok = await fetch(`${base}/dashboard`, { headers: { authorization: 'Bearer vk-orgA' } })
    assert.equal(ok.status, 200)
    assert.match(ok.headers.get('content-type') ?? '', /text\/html/)
    assert.match(await ok.text(), /<!doctype html>/i)

    // Still auth-gated when enabled.
    const unauth = await fetch(`${base}/dashboard`)
    assert.equal(unauth.status, 401)
  })
})
