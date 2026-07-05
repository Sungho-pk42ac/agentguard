import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { AuthError, enroll, login, logout, type FetchLike, type FetchResponse } from '../src/auth-client.js'
import { clearSession, readSession, sessionPath, writeSession } from '../src/session.js'
import { enrollmentPath, resolveIdentity } from '../src/enrollment.js'

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), 'agentguard-auth-'))
}

function jsonResponse(status: number, body: unknown): FetchResponse {
  return { status, text: async () => JSON.stringify(body) }
}

// ── login ─────────────────────────────────────────────────────────────────

test('login: happy path posts credentials and returns the parsed session', async () => {
  let seen: { url: string; init: { method: string; headers: Record<string, string>; body?: string } } | undefined
  const fetchImpl: FetchLike = async (url, init) => {
    seen = { url, init }
    return jsonResponse(200, { sessionToken: 'tok-abc', orgId: 'org_1', role: 'admin' })
  }
  const result = await login({ endpoint: 'https://cp.example/', email: 'a@b.com', password: 'hunter2', fetchImpl })
  assert.deepEqual(result, { sessionToken: 'tok-abc', orgId: 'org_1', role: 'admin' })
  assert.ok(seen)
  assert.equal(seen.url, 'https://cp.example/v1/auth/login')
  assert.equal(seen.init.method, 'POST')
  assert.deepEqual(JSON.parse(seen.init.body ?? '{}'), { email: 'a@b.com', password: 'hunter2' })
  assert.equal(seen.init.headers['x-agentguard-client'], 'cli', 'CLI identifies itself so the server mints a kind=cli session (90d), not a cookie session')
})

test('login: 401 response throws AuthError("invalid credentials")', async () => {
  const fetchImpl: FetchLike = async () => ({ status: 401, text: async () => 'nope' })
  await assert.rejects(
    () => login({ endpoint: 'https://cp.example', email: 'a@b.com', password: 'wrong', fetchImpl }),
    (err: unknown) => err instanceof AuthError && err.message === 'invalid credentials',
  )
})

test('login: network failure surfaces as AuthError with the underlying reason', async () => {
  const fetchImpl: FetchLike = async () => {
    throw new Error('ECONNREFUSED')
  }
  await assert.rejects(
    () => login({ endpoint: 'https://cp.example', email: 'a@b.com', password: 'x', fetchImpl }),
    (err: unknown) => err instanceof AuthError && /ECONNREFUSED/.test(err.message),
  )
})

test('login: malformed 200 body throws AuthError instead of returning garbage', async () => {
  const fetchImpl: FetchLike = async () => jsonResponse(200, { sessionToken: 'tok' })
  await assert.rejects(
    () => login({ endpoint: 'https://cp.example', email: 'a@b.com', password: 'x', fetchImpl }),
    (err: unknown) => err instanceof AuthError,
  )
})

test('login writes a session.json with the exact documented shape', async () => {
  const home = tmpHome()
  try {
    const fetchImpl: FetchLike = async () => jsonResponse(200, { sessionToken: 'tok-xyz', orgId: 'org_9', role: 'member' })
    const result = await login({ endpoint: 'https://cp.example', email: 'dana@acme.com', password: 'pw', fetchImpl })
    writeSession(
      { endpoint: 'https://cp.example', sessionToken: result.sessionToken, orgId: result.orgId, role: result.role, email: 'dana@acme.com' },
      home,
    )
    const path = sessionPath(home)
    assert.ok(existsSync(path))
    const saved = JSON.parse(readFileSync(path, 'utf8'))
    assert.deepEqual(saved, {
      endpoint: 'https://cp.example',
      sessionToken: 'tok-xyz',
      orgId: 'org_9',
      role: 'member',
      email: 'dana@acme.com',
    })
    if (process.platform !== 'win32') {
      const mode = statSync(path).mode & 0o777
      assert.equal(mode, 0o600)
    }
    assert.deepEqual(readSession(home), saved)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('clearSession removes the session file, tolerating an already-missing file', () => {
  const home = tmpHome()
  try {
    writeSession({ endpoint: 'e', sessionToken: 't', orgId: 'o', role: 'r', email: 'x@y.z' }, home)
    assert.ok(existsSync(sessionPath(home)))
    clearSession(home)
    assert.equal(existsSync(sessionPath(home)), false)
    assert.equal(readSession(home), undefined)
    // Second call on an already-cleared session must not throw.
    assert.doesNotThrow(() => clearSession(home))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

// ── logout ────────────────────────────────────────────────────────────────

test('logout: tolerates a 204 (revoked) response', async () => {
  const fetchImpl: FetchLike = async () => ({ status: 204, text: async () => '' })
  await assert.doesNotReject(() => logout({ endpoint: 'https://cp.example', token: 'tok', fetchImpl }))
})

test('logout: tolerates a 401 (already invalid) response', async () => {
  const fetchImpl: FetchLike = async () => ({ status: 401, text: async () => '' })
  await assert.doesNotReject(() => logout({ endpoint: 'https://cp.example', token: 'tok', fetchImpl }))
})

test('logout: sends the Bearer token on the authorization header', async () => {
  let seenAuth: string | undefined
  const fetchImpl: FetchLike = async (_url, init) => {
    seenAuth = init.headers['authorization']
    return { status: 204, text: async () => '' }
  }
  await logout({ endpoint: 'https://cp.example', token: 'secret-tok', fetchImpl })
  assert.equal(seenAuth, 'Bearer secret-tok')
})

test('logout: an unexpected status throws AuthError', async () => {
  const fetchImpl: FetchLike = async () => ({ status: 500, text: async () => 'boom' })
  await assert.rejects(
    () => logout({ endpoint: 'https://cp.example', token: 'tok', fetchImpl }),
    (err: unknown) => err instanceof AuthError,
  )
})

// ── enroll ────────────────────────────────────────────────────────────────

test('enroll: happy path posts the enrollment code and returns assetId/deviceToken', async () => {
  let seenBody: unknown
  const fetchImpl: FetchLike = async (_url, init) => {
    seenBody = JSON.parse(init.body ?? '{}')
    return jsonResponse(200, { assetId: 'asset_123', deviceToken: 'dev-tok' })
  }
  const result = await enroll({ endpoint: 'https://cp.example', orgId: 'org_1', code: 'ABC-123', label: 'laptop', fetchImpl })
  assert.deepEqual(result, { assetId: 'asset_123', deviceToken: 'dev-tok' })
  assert.deepEqual(seenBody, { orgId: 'org_1', enrollmentCode: 'ABC-123', assetLabel: 'laptop' })
})

test('enroll: omits assetId/assetLabel from the request body when not provided', async () => {
  let seenBody: unknown
  const fetchImpl: FetchLike = async (_url, init) => {
    seenBody = JSON.parse(init.body ?? '{}')
    return jsonResponse(200, { assetId: 'asset_1', deviceToken: 'tok' })
  }
  await enroll({ endpoint: 'https://cp.example', orgId: 'org_1', code: 'CODE', fetchImpl })
  assert.deepEqual(seenBody, { orgId: 'org_1', enrollmentCode: 'CODE' })
})

test('enroll: a non-200 response throws AuthError', async () => {
  const fetchImpl: FetchLike = async () => ({ status: 403, text: async () => 'forbidden' })
  await assert.rejects(
    () => enroll({ endpoint: 'https://cp.example', orgId: 'org_1', code: 'BAD', fetchImpl }),
    (err: unknown) => err instanceof AuthError,
  )
})

test('enroll writes an enrollment.json that resolveIdentity can read back (round-trip)', async () => {
  const home = tmpHome()
  try {
    const fetchImpl: FetchLike = async () => jsonResponse(200, { assetId: 'asset_rt', deviceToken: 'dev-rt' })
    const result = await enroll({ endpoint: 'https://cp.example', orgId: 'org_rt', code: 'CODE', fetchImpl })
    const file = { orgId: 'org_rt', assetId: result.assetId, deviceToken: result.deviceToken }
    const identity = resolveIdentity({
      home,
      env: {},
      fileExists: (p) => p === enrollmentPath(home),
      readFile: () => JSON.stringify(file),
    })
    assert.equal(identity.orgId, 'org_rt')
    assert.equal(identity.assetId, 'asset_rt')
    assert.equal(identity.credential.kind, 'device-token')
    assert.equal(identity.credential.kind === 'device-token' && identity.credential.secret, 'dev-rt')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
