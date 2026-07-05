import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createControlPlane, type ControlPlaneDeps } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { StaticViewerAuth } from '../src/verify/viewer.js'

interface RawResponse {
  readonly status: number
  readonly json: any
  readonly etag: string | null
  readonly setCookie: string[]
}

async function req(base: string, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<RawResponse> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, etag: res.headers.get('etag'), setCookie: res.headers.getSetCookie?.() ?? [] }
}
const post = (base: string, path: string, body?: unknown, headers?: Record<string, string>) => req(base, 'POST', path, body, headers)
const put = (base: string, path: string, body?: unknown, headers?: Record<string, string>) => req(base, 'PUT', path, body, headers)
const get = (base: string, path: string, headers: Record<string, string> = {}) => req(base, 'GET', path, undefined, headers)

function cookieValue(setCookie: string[], name: string): string | undefined {
  for (const line of setCookie) {
    if (line.startsWith(`${name}=`)) return decodeURIComponent(line.slice(name.length + 1).split(';')[0]!)
  }
  return undefined
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

function baseDeps(overrides: Partial<ControlPlaneDeps> = {}): ControlPlaneDeps {
  const storage = new MemoryStorage()
  return {
    storage,
    notifier: new RecordingNotifier(),
    oidcVerifier: new StaticOidcVerifier(),
    viewerAuth: new StaticViewerAuth(),
    now: () => Date.now(),
    ...overrides,
  } as ControlPlaneDeps
}

async function registerAdmin(base: string, email: string, orgName = 'Acme'): Promise<{ sessionToken: string; orgId: string }> {
  const reg = await post(base, '/v1/auth/register', { orgName, email, password: 'adminpass1' })
  return { sessionToken: reg.json.sessionToken as string, orgId: reg.json.orgId as string }
}

test('GET /v1/policy: default empty policy, ETag stable across no-op GETs, 304 on If-None-Match match', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const { sessionToken } = await registerAdmin(base, 'admin@acme.test')
    const auth = { authorization: `Bearer ${sessionToken}` }

    const first = await get(base, '/v1/policy', auth)
    assert.equal(first.status, 200)
    assert.equal(first.json.rulesVersion, 0)
    assert.equal(first.json.exceptionsVersion, 0)
    assert.equal(first.json.rules, '')
    assert.deepEqual(first.json.exceptions, [])
    assert.ok(first.etag, 'ETag header is present')
    assert.match(first.etag!, /^"[0-9a-f]{64}"$/)

    const second = await get(base, '/v1/policy', auth)
    assert.equal(second.etag, first.etag, 'ETag is stable across no-op GETs')

    const cached = await get(base, '/v1/policy', { ...auth, 'if-none-match': first.etag! })
    assert.equal(cached.status, 304)
    assert.equal(cached.etag, first.etag, '304 response still carries the ETag header')
  })
})

test('PUT /v1/policy (admin): replaces rules, bumps rulesVersion, and busts the ETag', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const { sessionToken } = await registerAdmin(base, 'admin@acme.test')
    const auth = { authorization: `Bearer ${sessionToken}` }

    const before = await get(base, '/v1/policy', auth)
    const putResult = await put(base, '/v1/policy', { rules: 'denyRead:\n  - "**/.env"\n' }, auth)
    assert.equal(putResult.status, 200)
    assert.equal(putResult.json.rulesVersion, 1)
    assert.equal(putResult.json.exceptionsVersion, 0)

    const after = await get(base, '/v1/policy', auth)
    assert.equal(after.json.rulesVersion, 1)
    assert.equal(after.json.rules, 'denyRead:\n  - "**/.env"\n')
    assert.notEqual(after.etag, before.etag, 'PUT rules busts the ETag')

    // the etag the client cached before the PUT no longer matches
    const staleCheck = await get(base, '/v1/policy', { ...auth, 'if-none-match': before.etag! })
    assert.equal(staleCheck.status, 200, 'a stale If-None-Match after a rules PUT must not 304')
  })
})

test('PUT /v1/policy: non-admin (member) is rejected with 403', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const { sessionToken: adminToken } = await registerAdmin(base, 'admin@acme.test')
    const invite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${adminToken}` })
    const accepted = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'memberpass1' })
    const memberToken = accepted.json.sessionToken as string

    const attempt = await put(base, '/v1/policy', { rules: 'denyRead: []' }, { authorization: `Bearer ${memberToken}` })
    assert.equal(attempt.status, 403)
  })
})

test('PUT /v1/policy: cookie-authenticated admin without x-agentguard-csrf is rejected with 403', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const login = await post(base, '/v1/auth/login', { email: 'admin@acme.test', password: 'adminpass1' })
    const sessionTok = cookieValue(login.setCookie, 'agentguard_session')!
    const csrfTok = cookieValue(login.setCookie, 'agentguard_csrf')!
    const cookieHeader = `agentguard_session=${sessionTok}; agentguard_csrf=${csrfTok}`

    const missingCsrf = await put(base, '/v1/policy', { rules: 'denyRead: []' }, { cookie: cookieHeader })
    assert.equal(missingCsrf.status, 403)

    const withCsrf = await put(base, '/v1/policy', { rules: 'denyRead: []' }, { cookie: cookieHeader, 'x-agentguard-csrf': csrfTok })
    assert.equal(withCsrf.status, 200)
    assert.equal(reg.json.role, 'admin')
  })
})

test('exceptions: any member proposes; admin approve bumps exceptionsVersion and busts ETag; approved exception appears in GET', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const { sessionToken: adminToken } = await registerAdmin(base, 'admin@acme.test')
    const invite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${adminToken}` })
    const accepted = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'memberpass1' })
    const memberToken = accepted.json.sessionToken as string
    const memberAuth = { authorization: `Bearer ${memberToken}` }
    const adminAuth = { authorization: `Bearer ${adminToken}` }

    const before = await get(base, '/v1/policy', adminAuth)

    // a member can propose a pending exception
    const created = await post(base, '/v1/policy/exceptions', { ruleId: 'mcp-unapproved', reason: 'temporary rollout' }, memberAuth)
    assert.equal(created.status, 200)
    assert.equal(created.json.status, 'pending')
    assert.equal(typeof created.json.id, 'string')

    // pending exceptions are invisible in GET and do not bust the ETag
    const stillPending = await get(base, '/v1/policy', adminAuth)
    assert.equal(stillPending.etag, before.etag, 'a pending exception does not change the ETag-visible surface')
    assert.deepEqual(stillPending.json.exceptions, [])

    // a member cannot approve
    const memberApprove = await post(base, `/v1/policy/exceptions/${created.json.id}/approve`, {}, memberAuth)
    assert.equal(memberApprove.status, 403)

    // admin approves: bumps exceptionsVersion, busts the ETag, and the
    // approved exception now shows up in GET /v1/policy
    const approve = await post(base, `/v1/policy/exceptions/${created.json.id}/approve`, {}, adminAuth)
    assert.equal(approve.status, 200)
    assert.equal(approve.json.status, 'approved')

    const afterApprove = await get(base, '/v1/policy', adminAuth)
    assert.notEqual(afterApprove.etag, before.etag, 'approve busts the ETag')
    assert.equal(afterApprove.json.exceptionsVersion, 1)
    assert.equal(afterApprove.json.exceptions.length, 1)
    assert.equal(afterApprove.json.exceptions[0].id, created.json.id)
    assert.equal(afterApprove.json.exceptions[0].status, 'approved')

    // approving an already-resolved exception fails
    const reApprove = await post(base, `/v1/policy/exceptions/${created.json.id}/approve`, {}, adminAuth)
    assert.equal(reApprove.status, 404)
  })
})

test('exceptions: admin reject bumps exceptionsVersion and busts the ETag but never appears in GET', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const { sessionToken: adminToken } = await registerAdmin(base, 'admin@acme.test')
    const adminAuth = { authorization: `Bearer ${adminToken}` }

    const before = await get(base, '/v1/policy', adminAuth)
    const created = await post(base, '/v1/policy/exceptions', { ruleId: 'secret-rule', reason: 'not applicable' }, adminAuth)

    const reject = await post(base, `/v1/policy/exceptions/${created.json.id}/reject`, {}, adminAuth)
    assert.equal(reject.status, 200)
    assert.equal(reject.json.status, 'rejected')

    const after = await get(base, '/v1/policy', adminAuth)
    assert.notEqual(after.etag, before.etag, 'reject busts the ETag')
    assert.equal(after.json.exceptionsVersion, 1)
    assert.deepEqual(after.json.exceptions, [], 'a rejected exception never appears in the approved-only exceptions list')
  })
})

test('cross-org isolation: org B never sees org A policy, rules, or exceptions', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const { sessionToken: aToken } = await registerAdmin(base, 'admin@a.test', 'OrgA')
    const { sessionToken: bToken } = await registerAdmin(base, 'admin@b.test', 'OrgB')
    const aAuth = { authorization: `Bearer ${aToken}` }
    const bAuth = { authorization: `Bearer ${bToken}` }

    await put(base, '/v1/policy', { rules: 'denyRead:\n  - "**/orgA-secret"\n' }, aAuth)
    const exc = await post(base, '/v1/policy/exceptions', { ruleId: 'orgA-only-rule', reason: 'orgA reason' }, aAuth)
    await post(base, `/v1/policy/exceptions/${exc.json.id}/approve`, {}, aAuth)

    const bView = await get(base, '/v1/policy', bAuth)
    assert.equal(bView.json.rulesVersion, 0, 'org B never observes org A rulesVersion')
    assert.equal(bView.json.rules, '', 'org B never observes org A rules text')
    assert.deepEqual(bView.json.exceptions, [], 'org B never observes org A exceptions')

    const aView = await get(base, '/v1/policy', aAuth)
    assert.equal(aView.json.rulesVersion, 1)
    assert.equal(aView.json.exceptions.length, 1)
  })
})

test('unauthenticated requests to the policy surface are rejected', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    assert.equal((await get(base, '/v1/policy')).status, 401)
    assert.equal((await put(base, '/v1/policy', { rules: 'x' })).status, 401)
    assert.equal((await post(base, '/v1/policy/exceptions', { ruleId: 'r', reason: 'r' })).status, 401)
  })
})
