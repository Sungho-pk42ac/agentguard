// NEGATIVE isolation tests: a credential minted for one identity plane
// (session, device HMAC, viewer key) must never be usable on another plane's
// endpoints. Each test proves a specific cross-plane forgery attempt fails.
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
import { finding, payload } from './helpers.js'

async function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
async function get(base: string, path: string, headers: Record<string, string> = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, { headers })
  return { status: res.status, json: await res.json().catch(() => ({})) }
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

test('(a) a valid SESSION token cannot double as a device-HMAC signing secret for /v1/reports', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'a@acme.test', password: 'adminpass1' })
    const sessionToken = reg.json.sessionToken as string
    const orgId = reg.json.orgId as string

    // enroll a real device with its OWN (different) secret
    deps.storage.putEnrollmentCode(orgId, createHash('sha256').update('CODE1').digest('hex'), Date.now() + 3_600_000)
    const enroll = await post(base, '/v1/enroll', { orgId, enrollmentCode: 'CODE1', assetId: 'pc1' })
    assert.equal(enroll.status, 200)

    // attacker signs a report using the SESSION token as the HMAC secret,
    // impersonating pc1. The asset's real secret differs, so the signature
    // check must fail regardless of the session token's validity elsewhere.
    const ts = Math.floor(Date.now() / 1000)
    const body = JSON.stringify(payload(orgId, 'pc1', [finding()]))
    const forgedSignature = `v1=${createHmac('sha256', sessionToken).update(`${ts}.${body}`).digest('hex')}`
    const res = await fetch(`${base}/v1/reports`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agentguard-asset': 'pc1',
        'x-agentguard-timestamp': String(ts),
        'x-agentguard-signature': forgedSignature,
      },
      body,
    })
    assert.equal(res.status, 401, 'a session token is not a valid device-HMAC secret')
  })
})

test('(b) a device-token identity (Bearer) cannot call the admin invites endpoint', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'b@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    deps.storage.putEnrollmentCode(orgId, createHash('sha256').update('CODE2').digest('hex'), Date.now() + 3_600_000)
    const enroll = await post(base, '/v1/enroll', { orgId, enrollmentCode: 'CODE2', assetId: 'pc2' })
    const deviceToken = enroll.json.deviceToken as string
    assert.ok(deviceToken)

    // the device token is not a session token; it must not resolve to a Principal
    const res = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${deviceToken}` })
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`)
  })
})

test('(c) a legacy viewer key cannot call admin/member session endpoints', async () => {
  const deps = baseDeps()
  const viewerAuth = deps.viewerAuth as StaticViewerAuth
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'c@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    viewerAuth.add('vk-orgC', orgId)

    // a viewer key legitimately reads dashboards...
    const summary = await get(base, '/v1/dashboard/summary', { authorization: 'Bearer vk-orgC' })
    assert.equal(summary.status, 200)

    // ...but carries no role/userId, so it must not authorize admin endpoints
    const invites = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: 'Bearer vk-orgC' })
    assert.equal(invites.status, 401)
    const members = await get(base, '/v1/orgs/members', { authorization: 'Bearer vk-orgC' })
    assert.equal(members.status, 401)
    const approve = await post(base, '/v1/auth/device/approve', { userCode: 'AAAA-BBBB' }, { authorization: 'Bearer vk-orgC' })
    assert.equal(approve.status, 401)
  })
})

test('(d) a member (non-admin) session cannot issue org invites', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin-d@acme.test', password: 'adminpass1' })
    const adminToken = reg.json.sessionToken as string
    const invite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${adminToken}` })
    const accepted = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'member-d@acme.test', password: 'memberpass1' })
    const memberToken = accepted.json.sessionToken as string
    assert.equal(accepted.json.role, 'member')

    const res = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${memberToken}` })
    assert.equal(res.status, 403, 'a valid but non-admin session must be rejected with 403, not silently allowed')

    const members = await get(base, '/v1/orgs/members', { authorization: `Bearer ${memberToken}` })
    assert.equal(members.status, 403)
  })
})
