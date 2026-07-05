import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
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
  readonly setCookie: string[]
}

async function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}): Promise<RawResponse> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] }
}
async function get(base: string, path: string, headers: Record<string, string> = {}): Promise<RawResponse> {
  const res = await fetch(`${base}${path}`, { headers })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] }
}
async function postRaw(base: string, path: string, rawBody: string, headers: Record<string, string> = {}): Promise<RawResponse> {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: rawBody })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json, setCookie: res.headers.getSetCookie?.() ?? [] }
}

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

function webhookHeaders(secret: string, tsSeconds: number, rawBody: string): Record<string, string> {
  const signature = createHmac('sha256', secret).update(`${tsSeconds}.${rawBody}`).digest('hex')
  return {
    'content-type': 'application/json',
    'x-agentguard-webhook-timestamp': String(tsSeconds),
    'x-agentguard-webhook-signature': `v1=${signature}`,
  }
}

test('valid signed webhook 201 + task fields, zero-match sets unmatched', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    const secret = deps.storage.getOrg(orgId)!.webhookSecret

    const body = { orgId, employee: { id: 'emp-1', email: 'leaver@acme.test', name: 'Leaver One' }, effectiveAt: '2026-08-01T00:00:00.000Z' }
    const rawBody = JSON.stringify(body)
    const ts = Math.floor(Date.now() / 1000)
    const res = await postRaw(base, '/v1/workflows/offboarding', rawBody, webhookHeaders(secret, ts, rawBody))

    assert.equal(res.status, 201)
    assert.equal(res.json.orgId, orgId)
    assert.deepEqual(res.json.employee, { id: 'emp-1', email: 'leaver@acme.test', name: 'Leaver One' })
    assert.equal(res.json.status, 'open')
    assert.equal(res.json.unmatched, true, 'no matching assets -> unmatched:true')
    assert.deepEqual(res.json.assetIds, [])
    assert.equal(res.json.effectiveAt, '2026-08-01T00:00:00.000Z')
    assert.equal(res.json.audit.length, 1)
    assert.equal(res.json.audit[0].to, 'open')
    assert.equal(res.json.audit[0].actor, 'webhook')
    assert.equal(typeof res.json.id, 'string')
  })
})

test('tampered body -> 401 (signature no longer matches)', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    const secret = deps.storage.getOrg(orgId)!.webhookSecret

    const signedBody = JSON.stringify({ orgId, employee: { id: 'emp-1', email: 'x@acme.test', name: 'X' }, effectiveAt: '2026-08-01T00:00:00.000Z' })
    const ts = Math.floor(Date.now() / 1000)
    const headers = webhookHeaders(secret, ts, signedBody)

    const tamperedBody = JSON.stringify({ orgId, employee: { id: 'emp-1', email: 'x@acme.test', name: 'TAMPERED' }, effectiveAt: '2026-08-01T00:00:00.000Z' })
    const res = await postRaw(base, '/v1/workflows/offboarding', tamperedBody, headers)
    assert.equal(res.status, 401)
  })
})

test('stale timestamp (outside +/-300s window) -> 401', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    const secret = deps.storage.getOrg(orgId)!.webhookSecret

    const body = JSON.stringify({ orgId, employee: { id: 'emp-1', email: 'x@acme.test', name: 'X' }, effectiveAt: '2026-08-01T00:00:00.000Z' })
    const staleTs = Math.floor(Date.now() / 1000) - 1000
    const res = await postRaw(base, '/v1/workflows/offboarding', body, webhookHeaders(secret, staleTs, body))
    assert.equal(res.status, 401)
  })
})

test('wrong-org secret -> 401 (signature computed with a different org secret)', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const regA = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin-a@acme.test', password: 'adminpass1' })
    const orgAId = regA.json.orgId as string
    const regB = await post(base, '/v1/auth/register', { orgName: 'Other', email: 'admin-b@other.test', password: 'adminpass1' })
    const orgBId = regB.json.orgId as string
    const orgBSecret = deps.storage.getOrg(orgBId)!.webhookSecret

    // Body claims orgA, but is signed with orgB's secret.
    const body = JSON.stringify({ orgId: orgAId, employee: { id: 'emp-1', email: 'x@acme.test', name: 'X' }, effectiveAt: '2026-08-01T00:00:00.000Z' })
    const ts = Math.floor(Date.now() / 1000)
    const res = await postRaw(base, '/v1/workflows/offboarding', body, webhookHeaders(orgBSecret, ts, body))
    assert.equal(res.status, 401)
  })
})

test('replay: identical body is idempotent-OK, but a DIFFERENT body with a reused stale timestamp is 401', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    const secret = deps.storage.getOrg(orgId)!.webhookSecret

    const body = JSON.stringify({ orgId, employee: { id: 'emp-1', email: 'x@acme.test', name: 'X' }, effectiveAt: '2026-08-01T00:00:00.000Z' })
    const ts = Math.floor(Date.now() / 1000)
    const headers = webhookHeaders(secret, ts, body)

    const first = await postRaw(base, '/v1/workflows/offboarding', body, headers)
    assert.equal(first.status, 201)
    // identical replay within the freshness window: idempotent-OK by design
    const replay = await postRaw(base, '/v1/workflows/offboarding', body, headers)
    assert.equal(replay.status, 200)
    assert.equal(replay.json.id, first.json.id)

    // A DIFFERENT body signed for the SAME (now-old, but replayed) timestamp:
    // once the clock moves past the freshness window, the OLD signature+timestamp
    // pair no longer validates against the new body regardless.
    const differentBody = JSON.stringify({ orgId, employee: { id: 'emp-2', email: 'y@acme.test', name: 'Y' }, effectiveAt: '2026-08-02T00:00:00.000Z' })
    const staleReplay = await postRaw(base, '/v1/workflows/offboarding', differentBody, headers)
    assert.equal(staleReplay.status, 401, 'a stale/reused signature must not authenticate a different body')
  })
})

test('idempotent re-POST via session admin returns the existing task, not a duplicate', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const adminToken = reg.json.sessionToken as string
    const body = { employee: { id: 'emp-9', email: 'z@acme.test', name: 'Z' }, effectiveAt: '2026-09-01T00:00:00.000Z' }

    const first = await post(base, '/v1/workflows/offboarding', body, { authorization: `Bearer ${adminToken}` })
    assert.equal(first.status, 201)
    const second = await post(base, '/v1/workflows/offboarding', body, { authorization: `Bearer ${adminToken}` })
    assert.equal(second.status, 200)
    assert.equal(second.json.id, first.json.id)

    const list = await get(base, '/v1/workflows/offboarding', { authorization: `Bearer ${adminToken}` })
    assert.equal(list.status, 200)
    assert.equal(list.json.tasks.length, 1, 're-POST must not create a duplicate task')
  })
})

test('session-admin create without signature works; csrf is enforced for cookie-authenticated create', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string

    // login (fresh session for cookie testing)
    const login = await post(base, '/v1/auth/login', { email: 'admin@acme.test', password: 'adminpass1' })
    const sessionTok = cookieValue(login.setCookie, 'agentguard_session')!
    const csrfTok = cookieValue(login.setCookie, 'agentguard_csrf')!
    const cookieHeader = `agentguard_session=${sessionTok}; agentguard_csrf=${csrfTok}`

    const body = { employee: { id: 'emp-c', email: 'c@acme.test', name: 'C' }, effectiveAt: '2026-09-05T00:00:00.000Z' }

    // cookie-authed, no csrf header -> 403
    const missingCsrf = await post(base, '/v1/workflows/offboarding', body, { cookie: cookieHeader })
    assert.equal(missingCsrf.status, 403)

    // cookie-authed, correct csrf header -> succeeds
    const ok = await post(base, '/v1/workflows/offboarding', body, { cookie: cookieHeader, 'x-agentguard-csrf': csrfTok })
    assert.equal(ok.status, 201)
    assert.equal(ok.json.orgId, orgId)

    // bearer auth is CSRF-exempt
    const body2 = { employee: { id: 'emp-c2', email: 'c2@acme.test', name: 'C2' }, effectiveAt: '2026-09-06T00:00:00.000Z' }
    const bearerOk = await post(base, '/v1/workflows/offboarding', body2, { authorization: `Bearer ${login.json.sessionToken}` })
    assert.equal(bearerOk.status, 201)

    // a member (non-admin) session cannot create
    const invite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${login.json.sessionToken}` })
    const accepted = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'memberpass1' })
    const memberToken = accepted.json.sessionToken as string
    const memberAttempt = await post(base, '/v1/workflows/offboarding', body, { authorization: `Bearer ${memberToken}` })
    assert.equal(memberAttempt.status, 403)
  })
})

test('assetIds absent -> label/subject match fills assetIds (matches by employee.id or employee.email)', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    const adminToken = reg.json.sessionToken as string

    deps.storage.createAsset({ orgId, assetId: 'pc-1', label: 'leaver@acme.test', kind: 'pc', authKind: 'device-token', secret: 's1', lastSeenAt: null, createdAt: 0 })
    deps.storage.createAsset({ orgId, assetId: 'ci-1', label: 'unrelated', kind: 'ci', authKind: 'oidc', subject: 'emp-42', provider: 'github', lastSeenAt: null, createdAt: 0 })
    deps.storage.createAsset({ orgId, assetId: 'pc-2', label: 'someone-else@acme.test', kind: 'pc', authKind: 'device-token', secret: 's2', lastSeenAt: null, createdAt: 0 })

    const body = { employee: { id: 'emp-42', email: 'leaver@acme.test', name: 'Leaver' }, effectiveAt: '2026-09-10T00:00:00.000Z' }
    const res = await post(base, '/v1/workflows/offboarding', body, { authorization: `Bearer ${adminToken}` })
    assert.equal(res.status, 201)
    assert.equal(res.json.unmatched, false)
    assert.deepEqual(new Set(res.json.assetIds), new Set(['pc-1', 'ci-1']))
  })
})

test('state machine: open -> sweeping -> done audited; illegal transitions (skip/backwards) are 409', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const adminToken = reg.json.sessionToken as string
    const body = { employee: { id: 'emp-sm', email: 'sm@acme.test', name: 'SM' }, effectiveAt: '2026-09-15T00:00:00.000Z' }
    const created = await post(base, '/v1/workflows/offboarding', body, { authorization: `Bearer ${adminToken}` })
    const id = created.json.id as string

    // illegal skip open -> done
    const skip = await post(base, `/v1/workflows/offboarding/${id}/transition`, { to: 'done' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(skip.status, 409)

    const toSweeping = await post(base, `/v1/workflows/offboarding/${id}/transition`, { to: 'sweeping' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(toSweeping.status, 200)
    assert.equal(toSweeping.json.status, 'sweeping')
    assert.equal(toSweeping.json.audit.length, 2)
    assert.equal(toSweeping.json.audit[1].from, 'open')
    assert.equal(toSweeping.json.audit[1].to, 'sweeping')
    assert.equal(typeof toSweeping.json.audit[1].actor, 'string')
    assert.notEqual(toSweeping.json.audit[1].actor, '', 'actor is the admin userId, not a role label')

    // illegal backwards sweeping -> open
    const backwards = await post(base, `/v1/workflows/offboarding/${id}/transition`, { to: 'open' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(backwards.status, 409)

    const toDone = await post(base, `/v1/workflows/offboarding/${id}/transition`, { to: 'done' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(toDone.status, 200)
    assert.equal(toDone.json.status, 'done')
    assert.equal(toDone.json.audit.length, 3)

    // done is terminal: no further transitions
    const pastDone = await post(base, `/v1/workflows/offboarding/${id}/transition`, { to: 'sweeping' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(pastDone.status, 409)

    // detail reflects final state
    const detail = await get(base, `/v1/workflows/offboarding/${id}`, { authorization: `Bearer ${adminToken}` })
    assert.equal(detail.status, 200)
    assert.equal(detail.json.status, 'done')

    // unknown id -> 404
    const missing = await post(base, `/v1/workflows/offboarding/nope/transition`, { to: 'sweeping' }, { authorization: `Bearer ${adminToken}` })
    assert.equal(missing.status, 404)
    const missingGet = await get(base, `/v1/workflows/offboarding/nope`, { authorization: `Bearer ${adminToken}` })
    assert.equal(missingGet.status, 404)
  })
})

test('org isolation: list/detail never cross tenants', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const regA = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin-a@acme.test', password: 'adminpass1' })
    const tokenA = regA.json.sessionToken as string
    const regB = await post(base, '/v1/auth/register', { orgName: 'Other', email: 'admin-b@other.test', password: 'adminpass1' })
    const tokenB = regB.json.sessionToken as string

    const bodyA = { employee: { id: 'emp-a', email: 'a@acme.test', name: 'A' }, effectiveAt: '2026-09-20T00:00:00.000Z' }
    const createdA = await post(base, '/v1/workflows/offboarding', bodyA, { authorization: `Bearer ${tokenA}` })
    assert.equal(createdA.status, 201)

    // org B's list is empty; org B cannot read org A's task detail
    const listB = await get(base, '/v1/workflows/offboarding', { authorization: `Bearer ${tokenB}` })
    assert.equal(listB.status, 200)
    assert.equal(listB.json.tasks.length, 0)
    const detailB = await get(base, `/v1/workflows/offboarding/${createdA.json.id}`, { authorization: `Bearer ${tokenB}` })
    assert.equal(detailB.status, 404, 'cross-tenant task lookup must miss, not leak')

    // org B cannot transition org A's task either
    const transitionB = await post(base, `/v1/workflows/offboarding/${createdA.json.id}/transition`, { to: 'sweeping' }, { authorization: `Bearer ${tokenB}` })
    assert.equal(transitionB.status, 404)

    // org A sees its own task
    const listA = await get(base, '/v1/workflows/offboarding', { authorization: `Bearer ${tokenA}` })
    assert.equal(listA.json.tasks.length, 1)
  })
})

test('unauthenticated request (no session, no signature) is rejected', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const orgId = reg.json.orgId as string
    const body = { orgId, employee: { id: 'emp-u', email: 'u@acme.test', name: 'U' }, effectiveAt: '2026-09-25T00:00:00.000Z' }
    const res = await post(base, '/v1/workflows/offboarding', body)
    assert.equal(res.status, 401)

    const list = await get(base, '/v1/workflows/offboarding')
    assert.equal(list.status, 401)
  })
})
