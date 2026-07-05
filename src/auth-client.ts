// Auth-client CLI verbs (login/logout/enroll) against the control plane.
//
// The auth server itself does not exist yet (lands at M2a); this module is
// built against the pinned contract below with an injectable `fetchImpl` so
// it is fully testable without network access:
//
//   POST {endpoint}/v1/auth/login  {email,password} -> 200 {sessionToken,orgId,role} | 401
//   POST {endpoint}/v1/auth/logout (authorization: Bearer <token>) -> 204
//   POST {endpoint}/v1/enroll {orgId,enrollmentCode,assetId?,assetLabel?} -> 200 {assetId,deviceToken}
//
// `enroll` reuses the EXISTING control-plane contract already relied on by
// enrollment.ts's `EnrollmentFile` shape — only the client call is new here.

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export interface FetchResponse {
  readonly status: number
  text(): Promise<string>
}
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<FetchResponse>

function resolveFetch(fetchImpl: FetchLike | undefined): FetchLike {
  const impl = fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  if (typeof impl !== 'function') {
    throw new AuthError('no fetch implementation available (Node >=20 required)')
  }
  return impl
}

function apiUrl(endpoint: string, path: string): string {
  return `${endpoint.replace(/\/+$/, '')}${path}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export interface LoginOptions {
  readonly endpoint: string
  readonly email: string
  readonly password: string
  readonly fetchImpl?: FetchLike
}

export interface LoginResult {
  readonly sessionToken: string
  readonly orgId: string
  readonly role: string
}

/** POST /v1/auth/login. Throws `AuthError` on 401, network failure, or a malformed response. */
export async function login(options: LoginOptions): Promise<LoginResult> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const url = apiUrl(options.endpoint, '/v1/auth/login')
  let response: FetchResponse
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agentguard-client': 'cli' },
      body: JSON.stringify({ email: options.email, password: options.password }),
    })
  } catch (error) {
    throw new AuthError(`could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (response.status === 401) throw new AuthError('invalid credentials')
  const text = await response.text()
  if (response.status !== 200) {
    throw new AuthError(`login failed (HTTP ${response.status}): ${text}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AuthError('login response was not valid JSON')
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.sessionToken !== 'string' ||
    typeof parsed.orgId !== 'string' ||
    typeof parsed.role !== 'string'
  ) {
    throw new AuthError('login response missing sessionToken/orgId/role')
  }
  return { sessionToken: parsed.sessionToken, orgId: parsed.orgId, role: parsed.role }
}

export interface LogoutOptions {
  readonly endpoint: string
  readonly token: string
  readonly fetchImpl?: FetchLike
}

/**
 * POST /v1/auth/logout. Both 204 (revoked) and 401 (already invalid) count as
 * success — the server-side session is gone either way. Any other response,
 * or a network failure, is surfaced as `AuthError` for the caller to decide
 * whether to still clear the local session file.
 */
export async function logout(options: LogoutOptions): Promise<void> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const url = apiUrl(options.endpoint, '/v1/auth/logout')
  let response: FetchResponse
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${options.token}`, 'x-agentguard-client': 'cli' },
    })
  } catch (error) {
    throw new AuthError(`could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (response.status === 204 || response.status === 401) return
  const text = await response.text()
  throw new AuthError(`logout failed (HTTP ${response.status}): ${text}`)
}

export interface EnrollOptions {
  readonly endpoint: string
  readonly orgId: string
  readonly code: string
  readonly assetId?: string
  readonly label?: string
  readonly fetchImpl?: FetchLike
}

export interface EnrollResult {
  readonly assetId: string
  readonly deviceToken: string
}

/** POST /v1/enroll. Throws `AuthError` on a non-200 response, network failure, or malformed body. */
export async function enroll(options: EnrollOptions): Promise<EnrollResult> {
  const fetchImpl = resolveFetch(options.fetchImpl)
  const url = apiUrl(options.endpoint, '/v1/enroll')
  const body: Record<string, unknown> = { orgId: options.orgId, enrollmentCode: options.code }
  if (options.assetId !== undefined) body.assetId = options.assetId
  if (options.label !== undefined) body.assetLabel = options.label
  let response: FetchResponse
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new AuthError(`could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const text = await response.text()
  if (response.status !== 200) {
    throw new AuthError(`enroll failed (HTTP ${response.status}): ${text}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new AuthError('enroll response was not valid JSON')
  }
  if (!isRecord(parsed) || typeof parsed.assetId !== 'string' || typeof parsed.deviceToken !== 'string') {
    throw new AuthError('enroll response missing assetId/deviceToken')
  }
  return { assetId: parsed.assetId, deviceToken: parsed.deviceToken }
}
