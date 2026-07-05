#!/usr/bin/env node
// AgentGuard self-host same-origin cookie round-trip smoke test (plan §M5).
//
// Exercises the ACTUAL browser-facing contract of the self-host topology:
// `web` and `api` sit behind ONE reverse-proxy origin (deploy/Caddyfile), so
// the session + CSRF cookies minted by POST /v1/auth/register must work,
// unmodified, against that SAME origin for a CSRF-protected mutation
// (PUT /v1/policy) and a subsequent read (GET /v1/policy).
//
// PREREQUISITE: a running stack reachable at BASE_URL. Either
//   docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d
// (BASE_URL defaults to http://localhost, matching the dev Caddyfile block),
// or any locally-started api+static-web pair that shares one origin. This
// script does NOT start anything itself and will fail fast with a clear
// network error if nothing is listening.
//
// Usage:  BASE_URL=http://localhost node deploy/smoke-cookie-roundtrip.mjs
// Exit code: 0 on success, 1 on ANY assertion or network failure.

const BASE_URL = process.env.BASE_URL ?? 'http://localhost'

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exitCode = 1
}

// Minimal Set-Cookie attribute parser — sufficient for the two cookies this
// control plane mints (agentguard_session, agentguard_csrf); not a general
// cookie-jar implementation.
function parseSetCookie(setCookieHeaders, name) {
  for (const raw of setCookieHeaders) {
    const [pair, ...attrs] = raw.split(';').map((s) => s.trim())
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    if (pair.slice(0, eq) !== name) continue
    return { name, value: decodeURIComponent(pair.slice(eq + 1)), attrs: attrs.map((a) => a.toLowerCase()) }
  }
  return undefined
}

function getSetCookies(res) {
  // Node's fetch Headers exposes multi-value Set-Cookie via getSetCookie();
  // fall back to a single joined header for older runtimes.
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie()
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

async function main() {
  const origin = new URL(BASE_URL)
  const stamp = Date.now()
  const email = `smoke-${stamp}@example.test`
  const password = 'correct horse battery staple 1'
  const orgName = `Smoke Org ${stamp}`

  // ── 1. register: mints a first-party session + csrf cookie ──
  const registerRes = await fetch(`${BASE_URL}/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orgName, email, password }),
  })
  if (registerRes.status !== 200) {
    fail(`register expected 200, got ${registerRes.status}: ${await registerRes.text()}`)
    return
  }
  const setCookies = getSetCookies(registerRes)
  const sessionCookie = parseSetCookie(setCookies, 'agentguard_session')
  const csrfCookie = parseSetCookie(setCookies, 'agentguard_csrf')
  if (!sessionCookie || !csrfCookie) {
    fail(`expected agentguard_session + agentguard_csrf Set-Cookie headers, got: ${JSON.stringify(setCookies)}`)
    return
  }

  // ── 2. first-party assertions: no Domain attribute (would scope the
  // cookie to a specific host instead of "this origin"), Path=/ (proxy-wide),
  // SameSite present, session HttpOnly (unreadable by the web console's JS),
  // csrf NOT HttpOnly (the SPA must read it to send x-agentguard-csrf), and
  // Secure whenever the origin itself is HTTPS. ──
  for (const [label, cookie] of [
    ['session', sessionCookie],
    ['csrf', csrfCookie],
  ]) {
    if (cookie.attrs.some((a) => a.startsWith('domain='))) {
      fail(`${label} cookie sets an explicit Domain attribute — not scoped to this first-party origin`)
    }
    if (!cookie.attrs.includes('path=/')) fail(`${label} cookie missing Path=/`)
    if (!cookie.attrs.some((a) => a.startsWith('samesite='))) fail(`${label} cookie missing SameSite`)
  }
  if (!sessionCookie.attrs.includes('httponly')) fail('session cookie must be HttpOnly')
  if (csrfCookie.attrs.includes('httponly')) fail('csrf cookie must NOT be HttpOnly (the web console reads it)')
  if (origin.protocol === 'https:' && !sessionCookie.attrs.includes('secure')) {
    fail('session cookie must be Secure when served over HTTPS')
  }

  const cookieHeader = `agentguard_session=${sessionCookie.value}; agentguard_csrf=${csrfCookie.value}`

  // ── 3. CSRF-protected mutation on the SAME origin, using the cookies +
  // x-agentguard-csrf exactly as a same-origin browser fetch() would. ──
  const rulesText = `smoke-test-rules-${stamp}`
  const putRes = await fetch(`${BASE_URL}/v1/policy`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: cookieHeader, 'x-agentguard-csrf': csrfCookie.value },
    body: JSON.stringify({ rules: rulesText }),
  })
  if (putRes.status !== 200) {
    fail(`PUT /v1/policy expected 200, got ${putRes.status}: ${await putRes.text()}`)
    return
  }

  // ── 4. negative control: the SAME mutation WITHOUT the csrf header must be
  // rejected — proves this round trip actually exercises CSRF protection. ──
  const putNoCsrfRes = await fetch(`${BASE_URL}/v1/policy`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: cookieHeader },
    body: JSON.stringify({ rules: 'should-be-rejected' }),
  })
  if (putNoCsrfRes.status !== 403) {
    fail(`PUT /v1/policy without x-agentguard-csrf expected 403, got ${putNoCsrfRes.status}`)
  }

  // ── 5. read back on the SAME origin (session cookie only — GETs don't
  // need csrf) — confirms the mutation actually persisted for this org. ──
  const getRes = await fetch(`${BASE_URL}/v1/policy`, { headers: { cookie: cookieHeader } })
  if (getRes.status !== 200) {
    fail(`GET /v1/policy expected 200, got ${getRes.status}: ${await getRes.text()}`)
    return
  }
  const getBody = await getRes.json()
  if (getBody.rules !== rulesText) {
    fail(`GET /v1/policy rules mismatch: expected ${JSON.stringify(rulesText)}, got ${JSON.stringify(getBody.rules)}`)
    return
  }

  if (process.exitCode) {
    console.error('Same-origin cookie round-trip: FAILED')
  } else {
    console.log('Same-origin cookie round-trip: OK (register -> cookies -> csrf-protected PUT -> GET readback)')
  }
}

main().catch((err) => {
  console.error(`FAIL: unhandled error: ${err.stack ?? err}`)
  process.exitCode = 1
})
