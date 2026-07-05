import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { createControlPlane, type ControlPlaneDeps } from '../src/server.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { RecordingNotifier } from '../src/notify/recording.js'
import { StaticOidcVerifier } from '../src/verify/oidc.js'
import { StaticViewerAuth } from '../src/verify/viewer.js'
import { hashPassword, verifyPassword } from '../src/auth/records.js'

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

function cookieValue(setCookie: string[], name: string): string | undefined {
  for (const line of setCookie) {
    if (line.startsWith(`${name}=`)) return decodeURIComponent(line.slice(name.length + 1).split(';')[0]!)
  }
  return undefined
}
function cookieAttrs(setCookie: string[], name: string): string | undefined {
  return setCookie.find((line) => line.startsWith(`${name}=`))
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

test('scrypt roundtrip: correct password verifies, wrong password does not, format is stable', () => {
  const hash = hashPassword('correct horse battery staple')
  assert.match(hash, /^scrypt:N=16384,r=8,p=1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
  assert.equal(verifyPassword('correct horse battery staple', hash), true)
  assert.equal(verifyPassword('wrong password', hash), false)
  assert.equal(verifyPassword('correct horse battery staple', 'garbage'), false)
})

test('register -> login -> logout lifecycle: cookie attrs, csrf double-submit, session rotation', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'Admin@Acme.test', password: 'hunter22222' })
    assert.equal(reg.status, 200)
    assert.equal(reg.json.role, 'admin')
    assert.equal(typeof reg.json.orgId, 'string')
    assert.equal(typeof reg.json.sessionToken, 'string', 'CLI contract requires sessionToken unconditionally')

    const sessionCookie = cookieAttrs(reg.setCookie, 'agentguard_session')
    const csrfCookie = cookieAttrs(reg.setCookie, 'agentguard_csrf')
    assert.ok(sessionCookie, 'session cookie is set')
    assert.match(sessionCookie!, /HttpOnly/)
    assert.match(sessionCookie!, /SameSite=Lax/)
    assert.match(sessionCookie!, /Path=\//)
    assert.doesNotMatch(sessionCookie!, /Secure/, 'no Secure flag over plain HTTP')
    assert.ok(csrfCookie, 'csrf cookie is set')
    assert.doesNotMatch(csrfCookie!, /HttpOnly/, 'csrf cookie is readable by JS (non-HttpOnly)')

    // duplicate registration is rejected
    assert.equal((await post(base, '/v1/auth/register', { orgName: 'Acme2', email: 'admin@acme.test', password: 'hunter22222' })).status, 409)

    // login mints a DIFFERENT session token (rotation, never reuse)
    const login1 = await post(base, '/v1/auth/login', { email: 'admin@acme.test', password: 'hunter22222' })
    assert.equal(login1.status, 200)
    assert.notEqual(login1.json.sessionToken, reg.json.sessionToken)
    const login2 = await post(base, '/v1/auth/login', { email: 'admin@acme.test', password: 'hunter22222' })
    assert.notEqual(login1.json.sessionToken, login2.json.sessionToken, 'each login mints a fresh token')

    // wrong password -> 401
    assert.equal((await post(base, '/v1/auth/login', { email: 'admin@acme.test', password: 'nope-nope-nope' })).status, 401)

    // ── CSRF double-submit on a cookie-authenticated mutation ──
    const sessionTok = cookieValue(login2.setCookie, 'agentguard_session')!
    const csrfTok = cookieValue(login2.setCookie, 'agentguard_csrf')!
    const cookieHeader = `agentguard_session=${sessionTok}; agentguard_csrf=${csrfTok}`

    const missingCsrf = await post(base, '/v1/orgs/invites', { role: 'member' }, { cookie: cookieHeader })
    assert.equal(missingCsrf.status, 403, 'cookie-authenticated mutation without x-agentguard-csrf must be rejected')

    const wrongCsrf = await post(base, '/v1/orgs/invites', { role: 'member' }, { cookie: cookieHeader, 'x-agentguard-csrf': 'bogus' })
    assert.equal(wrongCsrf.status, 403, 'mismatched csrf header must be rejected')

    const correctCsrf = await post(base, '/v1/orgs/invites', { role: 'member' }, { cookie: cookieHeader, 'x-agentguard-csrf': csrfTok })
    assert.equal(correctCsrf.status, 200, 'matching double-submit csrf header succeeds')
    assert.equal(typeof correctCsrf.json.code, 'string')

    // Bearer-authenticated mutations are CSRF-exempt.
    const bearerInvite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${login2.json.sessionToken}` })
    assert.equal(bearerInvite.status, 200, 'bearer auth skips csrf entirely')

    // ── logout: cookie-authenticated mutation also requires csrf, then clears cookies ──
    const logoutNoCsrf = await post(base, '/v1/auth/logout', undefined, { cookie: cookieHeader })
    assert.equal(logoutNoCsrf.status, 403)

    const logoutOk = await post(base, '/v1/auth/logout', undefined, { cookie: cookieHeader, 'x-agentguard-csrf': csrfTok })
    assert.equal(logoutOk.status, 204)
    const clearedSession = cookieAttrs(logoutOk.setCookie, 'agentguard_session')
    assert.match(clearedSession!, /Max-Age=0/)

    // the logged-out session token no longer authenticates
    assert.equal((await post(base, '/v1/auth/logout', undefined, { authorization: `Bearer ${sessionTok}` })).status, 401)

    // bearer logout of a still-live session succeeds without csrf
    assert.equal((await post(base, '/v1/auth/logout', undefined, { authorization: `Bearer ${login1.json.sessionToken}` })).status, 204)
  })
})

test('login rate-limit: 5 failures within the window locks out the 6th attempt with 429', async () => {
  const deps = baseDeps({ rateLimitWindowMs: 5 * 60 * 1000, rateLimitMax: 5 } as Partial<ControlPlaneDeps>)
  await withServer(deps, async (base) => {
    await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'a@acme.test', password: 'correcthorse' })
    for (let i = 0; i < 5; i++) {
      const r = await post(base, '/v1/auth/login', { email: 'a@acme.test', password: 'wrong' })
      assert.equal(r.status, 401, `attempt ${i} should be a plain 401`)
    }
    const locked = await post(base, '/v1/auth/login', { email: 'a@acme.test', password: 'wrong' })
    assert.equal(locked.status, 429)
    // even the CORRECT password is rejected while locked out
    const lockedCorrect = await post(base, '/v1/auth/login', { email: 'a@acme.test', password: 'correcthorse' })
    assert.equal(lockedCorrect.status, 429)
  })
})

test('invites: single-use, expiring, and admin-only issuance; accept-invite creates a member', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'admin@acme.test', password: 'adminpass1' })
    const adminToken = reg.json.sessionToken as string

    // non-admin cannot issue invites (accept-invite as member, then try)
    const invite = await post(base, '/v1/orgs/invites', { role: 'member', expiresInHours: 1 }, { authorization: `Bearer ${adminToken}` })
    assert.equal(invite.status, 200)
    assert.equal(typeof invite.json.code, 'string')
    assert.equal(typeof invite.json.expiresAt, 'number')

    const accepted = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'member@acme.test', password: 'memberpass1' })
    assert.equal(accepted.status, 200)
    assert.equal(accepted.json.role, 'member')
    assert.equal(accepted.json.orgId, reg.json.orgId)

    // single-use: same code again is rejected
    const reused = await post(base, '/v1/auth/accept-invite', { code: invite.json.code, email: 'other@acme.test', password: 'anotherpass1' })
    assert.equal(reused.status, 401)

    // expired invite is rejected: exercise the storage contract directly with
    // a "now" far past expiresAt (the HTTP surface has no clock override here).
    const shortLived = await post(base, '/v1/orgs/invites', { role: 'member', expiresInHours: 1 }, { authorization: `Bearer ${adminToken}` })
    assert.equal(deps.storage.consumeInvite(shortLived.json.code, shortLived.json.expiresAt + 1), undefined)

    // a member session cannot issue invites (403)
    const memberToken = accepted.json.sessionToken as string
    const memberInvite = await post(base, '/v1/orgs/invites', { role: 'member' }, { authorization: `Bearer ${memberToken}` })
    assert.equal(memberInvite.status, 403)

    // GET /v1/orgs/members (admin only) lists members without passwordHash
    const members = await get(base, '/v1/orgs/members', { authorization: `Bearer ${adminToken}` })
    assert.equal(members.status, 200)
    assert.equal(members.json.members.length, 2)
    for (const m of members.json.members) {
      assert.equal('passwordHash' in m, false)
      assert.ok(m.id && m.email && m.role && typeof m.createdAt === 'number')
    }
    assert.equal((await get(base, '/v1/orgs/members', { authorization: `Bearer ${memberToken}` })).status, 403)
  })
})

test('GET /v1/meta advertises supported schema versions and version (public, no auth)', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const meta = await get(base, '/v1/meta')
    assert.equal(meta.status, 200)
    assert.deepEqual(meta.json.schemaVersions, [1, 2])
    assert.equal(typeof meta.json.version, 'string')
  })
})

test('x-agentguard-client: cli returns sessionToken in the login body and mints a kind=cli session (CLI contract)', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'cli@acme.test', password: 'clipassword' })
    const login = await post(base, '/v1/auth/login', { email: 'cli@acme.test', password: 'clipassword' }, { 'x-agentguard-client': 'cli' })
    assert.equal(login.status, 200)
    assert.equal(typeof login.json.sessionToken, 'string')

    assert.equal(typeof login.json.orgId, 'string')
    assert.equal(login.json.role, 'admin')

    // The header selects the long-lived CLI session kind — this is the
    // branch the shipped auth-client actually exercises.
    const session = deps.storage.getSession(login.json.sessionToken as string)
    assert.equal(session?.kind, 'cli')
    const days = Math.round((session!.expiresAt - session!.createdAt) / (24 * 60 * 60 * 1000))
    assert.equal(days, 90, 'CLI sessions live 90 days, not the 30-day cookie default')
  })
})

test('HARDENING: a malformed Cookie header (bad percent-encoding) must not crash the server', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    // decodeURIComponent('%') throws URIError; before the parseCookies guard
    // this single unauthenticated request killed the whole process via an
    // unhandled route() rejection.
    const malformed = await fetch(`${base}/v1/meta`, { headers: { cookie: 'a=%; agentguard_session=%zz' } })
    assert.equal(malformed.status, 200, 'request with a malformed cookie is still served')

    // The server is still alive and answering afterwards.
    const followUp = await get(base, '/v1/meta')
    assert.equal(followUp.status, 200)
    assert.deepEqual(followUp.json.schemaVersions, [1, 2])

    // A malformed csrf cookie on a cookie-authed mutation degrades to 403
    // (csrf mismatch), never a crash.
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'hard@acme.test', password: 'hardpass123' })
    const invite = await fetch(`${base}/v1/orgs/invites`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `agentguard_session=${reg.json.sessionToken}; agentguard_csrf=%`,
        'x-agentguard-csrf': '%',
      },
      body: JSON.stringify({ role: 'member' }),
    })
    assert.notEqual(invite.status, 500)
    const alive = await get(base, '/v1/meta')
    assert.equal(alive.status, 200, 'server survives malformed csrf cookie on a mutation')
  })
})

test('headless device-authorization flow: start -> pending poll (428) -> approve -> poll succeeds once, then 410', async () => {
  const deps = baseDeps()
  await withServer(deps, async (base) => {
    const reg = await post(base, '/v1/auth/register', { orgName: 'Acme', email: 'device@acme.test', password: 'devicepass1' })
    const sessionToken = reg.json.sessionToken as string

    const start = await post(base, '/v1/auth/device/start', {})
    assert.equal(start.status, 200)
    assert.equal(typeof start.json.deviceCode, 'string')
    assert.equal(typeof start.json.userCode, 'string')

    const pendingPoll = await post(base, '/v1/auth/device/poll', { deviceCode: start.json.deviceCode })
    assert.equal(pendingPoll.status, 428)

    // unauthenticated approve is rejected
    assert.equal((await post(base, '/v1/auth/device/approve', { userCode: start.json.userCode })).status, 401)

    const approve = await post(base, '/v1/auth/device/approve', { userCode: start.json.userCode }, { authorization: `Bearer ${sessionToken}` })
    assert.equal(approve.status, 204)

    // unknown user code is rejected
    assert.equal(
      (await post(base, '/v1/auth/device/approve', { userCode: 'NOPE-NOPE' }, { authorization: `Bearer ${sessionToken}` })).status,
      404,
    )

    const poll = await post(base, '/v1/auth/device/poll', { deviceCode: start.json.deviceCode })
    assert.equal(poll.status, 200)
    assert.equal(poll.json.orgId, reg.json.orgId)
    assert.equal(poll.json.role, 'admin')
    assert.equal(typeof poll.json.sessionToken, 'string')
    assert.notEqual(poll.json.sessionToken, sessionToken, 'device poll mints its own fresh session')

    // single-use: polling again after redemption is 410
    const rePoll = await post(base, '/v1/auth/device/poll', { deviceCode: start.json.deviceCode })
    assert.equal(rePoll.status, 410)

    // unknown device code
    assert.equal((await post(base, '/v1/auth/device/poll', { deviceCode: 'unknown' })).status, 404)
  })
})

test('device code expiry: poll after expiry is 410', async () => {
  let now = 1_000_000
  const deps = baseDeps({ now: () => now, deviceCodeTtlMs: 1000 } as Partial<ControlPlaneDeps>)
  await withServer(deps, async (base) => {
    const start = await post(base, '/v1/auth/device/start', {})
    now += 2000
    const poll = await post(base, '/v1/auth/device/poll', { deviceCode: start.json.deviceCode })
    assert.equal(poll.status, 410)
  })
})
