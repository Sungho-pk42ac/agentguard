import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ApiError,
  CSRF_COOKIE,
  CSRF_HEADER,
  apiRequest,
  buildHeaders,
  readCookie,
} from './api.ts'

type Call = { url: string; init: RequestInit }

function fakeFetch(status: number, body: unknown, sink: Call[]): typeof fetch {
  return (async (url: unknown, init: unknown) => {
    sink.push({ url: String(url), init: (init ?? {}) as RequestInit })
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as Response
  }) as unknown as typeof fetch
}

test('readCookie extracts a value and ignores others; url-decodes; tolerant of junk', () => {
  const cookies = `a=1; ${CSRF_COOKIE}=abc123; b=2`
  assert.equal(readCookie(cookies, CSRF_COOKIE), 'abc123')
  assert.equal(readCookie(cookies, 'a'), '1')
  assert.equal(readCookie(cookies, 'missing'), undefined)
  assert.equal(readCookie(`${CSRF_COOKIE}=a%20b`, CSRF_COOKIE), 'a b')
  assert.equal(readCookie(`${CSRF_COOKIE}=%`, CSRF_COOKIE), '%', 'malformed percent-encoding is returned verbatim, not a throw')
})

test('buildHeaders: safe methods never send the CSRF header', () => {
  const h = buildHeaders('GET', false, `${CSRF_COOKIE}=tok`)
  assert.equal(h[CSRF_HEADER], undefined)
  assert.equal(h['content-type'], undefined)
})

test('buildHeaders: state-changing methods echo the csrf cookie into the header', () => {
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
    const h = buildHeaders(m, true, `${CSRF_COOKIE}=tok-${m}`)
    assert.equal(h[CSRF_HEADER], `tok-${m}`, `${m} carries the double-submit token`)
    assert.equal(h['content-type'], 'application/json')
  }
})

test('buildHeaders: state-changing request with NO csrf cookie omits the header (server will 403)', () => {
  const h = buildHeaders('POST', true, 'unrelated=1')
  assert.equal(h[CSRF_HEADER], undefined, 'we never invent a CSRF token — no authority in the web tier')
})

test('apiRequest GET: same-origin path, credentials same-origin, no CSRF header, parsed JSON', async () => {
  const calls: Call[] = []
  const out = await apiRequest<{ totalFindings: number }>('/v1/dashboard/summary', {
    fetchImpl: fakeFetch(200, { totalFindings: 3 }, calls),
    cookieString: `${CSRF_COOKIE}=tok`,
  })
  assert.deepEqual(out, { totalFindings: 3 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/v1/dashboard/summary')
  assert.equal((calls[0].init as RequestInit).credentials, 'same-origin')
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers[CSRF_HEADER], undefined, 'GET is safe — no CSRF header even when the cookie exists')
})

test('apiRequest POST: sends the CSRF header from the cookie and a JSON body', async () => {
  const calls: Call[] = []
  await apiRequest('/v1/orgs/invites', {
    method: 'POST',
    body: { role: 'member' },
    fetchImpl: fakeFetch(200, { code: 'X' }, calls),
    cookieString: `${CSRF_COOKIE}=csrf-xyz`,
  })
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers[CSRF_HEADER], 'csrf-xyz')
  assert.equal(headers['content-type'], 'application/json')
  assert.equal(calls[0].init.body, JSON.stringify({ role: 'member' }))
  assert.equal((calls[0].init as RequestInit).credentials, 'same-origin')
})

test('apiRequest rejects absolute URLs and non-root paths (same-origin invariant)', async () => {
  await assert.rejects(() => apiRequest('https://evil.example/v1/x'), /absolute URL|same-origin/)
  await assert.rejects(() => apiRequest('//evil.example/v1/x'), /protocol-relative|same-origin/)
  await assert.rejects(() => apiRequest('v1/x'), /root-relative/)
})

test('apiRequest surfaces a non-2xx response as ApiError carrying status + server error message', async () => {
  const calls: Call[] = []
  await assert.rejects(
    () => apiRequest('/v1/orgs/invites', { method: 'POST', body: {}, fetchImpl: fakeFetch(403, { error: 'csrf token mismatch' }, calls), cookieString: '' }),
    (err: unknown) => err instanceof ApiError && err.status === 403 && err.message === 'csrf token mismatch',
  )
})

test('apiRequest tolerates an empty body (204-style) without throwing', async () => {
  const calls: Call[] = []
  const out = await apiRequest('/v1/auth/logout', { method: 'POST', fetchImpl: fakeFetch(204, '', calls), cookieString: `${CSRF_COOKIE}=t` })
  assert.equal(out, undefined)
})
