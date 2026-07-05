// Native session auth handlers (M2a): register/login/logout, org invites,
// members, capability doc, and the headless CLI device-authorization flow.
// Pure handlers in the style of ingest.ts's handleEnroll/handleReport —
// server.ts owns HTTP wiring (cookie parsing, CSRF, Set-Cookie headers).

import { CONTROL_PLANE_VERSION, SUPPORTED_AUTH_SCHEMA_VERSIONS, type Role, type SessionRecord } from '../model.js'
import type { Principal } from '../verify/viewer.js'
import type { StoragePort } from '../storage/port.js'
import { hashPassword, mintId, mintToken, mintUserCode, normalizeEmail, verifyPassword } from './records.js'

export interface AuthDeps {
  readonly storage: StoragePort
  readonly now: () => number
  readonly mintToken?: () => string
  readonly mintUserCode?: () => string
  readonly mintId?: (prefix: string) => string
  readonly rateLimitWindowMs?: number
  readonly rateLimitMax?: number
  readonly sessionCookieDays?: number
  readonly cliSessionDays?: number
  readonly deviceCodeTtlMs?: number
}

export interface AuthHandlerResponse {
  readonly status: number
  readonly json: Record<string, unknown>
  /** Session token to mint an agentguard_session + agentguard_csrf cookie pair for, if any. */
  readonly session?: SessionRecord
  /** True when the caller's session/cookies should be cleared (logout). */
  readonly clearSession?: boolean
}

const MIN_PASSWORD_LENGTH = 8
const DEFAULT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const DEFAULT_RATE_LIMIT_MAX = 5
const DEFAULT_SESSION_COOKIE_DAYS = 30
const DEFAULT_CLI_SESSION_DAYS = 90
const DEFAULT_DEVICE_CODE_TTL_MS = 10 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function isCliClient(headers: Record<string, string>): boolean {
  return headers['x-agentguard-client'] === 'cli'
}

function parseJson(rawBody: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(rawBody)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return undefined
  }
}

function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH
}

function isRole(role: unknown): role is Role {
  return role === 'admin' || role === 'member'
}

/** Mint a fresh session (never reuse an existing token) and persist it. */
async function mintSession(deps: AuthDeps, userId: string, orgId: string, role: Role, cli: boolean): Promise<SessionRecord> {
  const now = deps.now()
  const days = cli ? (deps.cliSessionDays ?? DEFAULT_CLI_SESSION_DAYS) : (deps.sessionCookieDays ?? DEFAULT_SESSION_COOKIE_DAYS)
  const session: SessionRecord = {
    token: (deps.mintToken ?? mintToken)(),
    userId,
    orgId,
    role,
    kind: cli ? 'cli' : 'cookie',
    csrfToken: (deps.mintToken ?? mintToken)(),
    createdAt: now,
    expiresAt: now + days * DAY_MS,
    lastSeenAt: now,
  }
  await deps.storage.createSession(session)
  return session
}

function sessionBody(session: SessionRecord, includeToken: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = { orgId: session.orgId, role: session.role }
  if (includeToken) body.sessionToken = session.token
  return body
}

/**
 * POST /v1/auth/register {orgName,email,password} -> creates Org + admin User
 * + session. sessionToken is always included in the body — the CLI login
 * contract (auth-client.ts) requires it unconditionally; x-agentguard-client:
 * cli is honored too but is not the sole gate.
 */
export async function handleRegister(rawBody: string, headers: Record<string, string>, deps: AuthDeps): Promise<AuthHandlerResponse> {
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const orgName = body.orgName
  const email = isValidEmail(body.email) ? normalizeEmail(body.email) : undefined
  const password = body.password
  if (typeof orgName !== 'string' || orgName.trim().length === 0 || !email || !isValidPassword(password)) {
    return { status: 400, json: { error: 'orgName, a valid email, and a password (min 8 chars) are required' } }
  }
  if (await deps.storage.getUserByEmail(email)) {
    return { status: 409, json: { error: 'an account with this email already exists' } }
  }

  const now = deps.now()
  const mkId = deps.mintId ?? mintId
  const org = { id: mkId('org'), name: orgName.trim(), webhookSecret: (deps.mintToken ?? mintToken)(), createdAt: now }
  await deps.storage.createOrg(org)
  const user = { id: mkId('user'), orgId: org.id, email, passwordHash: hashPassword(password), role: 'admin' as const, createdAt: now }
  await deps.storage.createUser(user)

  const session = await mintSession(deps, user.id, org.id, 'admin', isCliClient(headers))
  return { status: 200, json: sessionBody(session, true), session }
}

/**
 * POST /v1/auth/login {email,password} -> 200 {orgId,role[,sessionToken]} |
 * 401 | 429 (rate-limited). sessionToken is always included in the body — the
 * existing CLI auth-client.ts contract requires it unconditionally.
 */
export async function handleLogin(rawBody: string, headers: Record<string, string>, deps: AuthDeps): Promise<AuthHandlerResponse> {
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const email = isValidEmail(body.email) ? normalizeEmail(body.email) : undefined
  const password = typeof body.password === 'string' ? body.password : undefined
  if (!email || !password) {
    return { status: 400, json: { error: 'email and password are required' } }
  }

  const now = deps.now()
  const windowMs = deps.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS
  const max = deps.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX
  if ((await deps.storage.countRecentLoginFailures(email, now - windowMs)) >= max) {
    return { status: 429, json: { error: 'too many failed login attempts; try again later' } }
  }

  const user = await deps.storage.getUserByEmail(email)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await deps.storage.recordLoginFailure(email, now)
    return { status: 401, json: { error: 'invalid email or password' } }
  }

  const session = await mintSession(deps, user.id, user.orgId, user.role, isCliClient(headers))
  return { status: 200, json: sessionBody(session, true), session }
}

/** POST /v1/auth/logout. 204 on success, 401 when no valid session was presented. */
export async function handleLogout(token: string | undefined, deps: AuthDeps): Promise<AuthHandlerResponse> {
  if (!token || !(await deps.storage.getSession(token))) {
    return { status: 401, json: { error: 'no active session' } }
  }
  await deps.storage.deleteSession(token)
  return { status: 204, json: {}, clearSession: true }
}

/** POST /v1/orgs/invites (admin only) {role,expiresInHours?} -> 200 {code,expiresAt}. */
export async function handleCreateInvite(principal: Principal, rawBody: string, deps: AuthDeps): Promise<AuthHandlerResponse> {
  if (principal.role !== 'admin') return { status: 403, json: { error: 'admin role required' } }
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const role = body.role === undefined ? 'member' : body.role
  if (!isRole(role)) return { status: 400, json: { error: "role must be 'admin' or 'member'" } }
  const expiresInHours = body.expiresInHours === undefined ? 168 : Number(body.expiresInHours)
  if (!Number.isFinite(expiresInHours) || expiresInHours <= 0 || expiresInHours > 24 * 30) {
    return { status: 400, json: { error: 'expiresInHours must be between 0 and 720' } }
  }
  const now = deps.now()
  const code = (deps.mintToken ?? mintToken)()
  const expiresAt = now + Math.floor(expiresInHours * 60 * 60 * 1000)
  await deps.storage.createInvite({ code, orgId: principal.orgId, role, expiresAt })
  return { status: 200, json: { code, expiresAt } }
}

/** POST /v1/auth/accept-invite {code,email,password} -> creates member User + session. */
export async function handleAcceptInvite(rawBody: string, headers: Record<string, string>, deps: AuthDeps): Promise<AuthHandlerResponse> {
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const code = typeof body.code === 'string' ? body.code : undefined
  const email = isValidEmail(body.email) ? normalizeEmail(body.email) : undefined
  const password = body.password
  if (!code || !email || !isValidPassword(password)) {
    return { status: 400, json: { error: 'code, a valid email, and a password (min 8 chars) are required' } }
  }

  const now = deps.now()
  const invite = await deps.storage.consumeInvite(code, now)
  if (!invite) return { status: 401, json: { error: 'invalid, expired, or already-used invite code' } }
  if (await deps.storage.getUserByEmail(email)) {
    return { status: 409, json: { error: 'an account with this email already exists' } }
  }

  const user = {
    id: (deps.mintId ?? mintId)('user'),
    orgId: invite.orgId,
    email,
    passwordHash: hashPassword(password as string),
    role: invite.role,
    createdAt: now,
  }
  await deps.storage.createUser(user)

  const session = await mintSession(deps, user.id, user.orgId, user.role, isCliClient(headers))
  return { status: 200, json: sessionBody(session, true), session }
}

/** GET /v1/orgs/members (admin only) -> {members:[{id,email,role,createdAt}]} — never passwordHash. */
export async function handleListMembers(principal: Principal, deps: AuthDeps): Promise<AuthHandlerResponse> {
  if (principal.role !== 'admin') return { status: 403, json: { error: 'admin role required' } }
  const members = (await deps.storage.listUsers(principal.orgId)).map((u) => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt }))
  return { status: 200, json: { members } }
}

/** GET /v1/meta (public capability doc). */
export function handleMeta(): AuthHandlerResponse {
  return { status: 200, json: { schemaVersions: [...SUPPORTED_AUTH_SCHEMA_VERSIONS], version: CONTROL_PLANE_VERSION } }
}

/** POST /v1/auth/device/start -> {deviceCode,userCode,expiresAt}. */
export async function handleDeviceStart(deps: AuthDeps): Promise<AuthHandlerResponse> {
  const now = deps.now()
  const expiresAt = now + (deps.deviceCodeTtlMs ?? DEFAULT_DEVICE_CODE_TTL_MS)
  const deviceCode = (deps.mintToken ?? mintToken)()
  const userCode = (deps.mintUserCode ?? mintUserCode)()
  await deps.storage.createDeviceAuth({ deviceCode, userCode, status: 'pending', createdAt: now, expiresAt })
  return { status: 200, json: { deviceCode, userCode, expiresAt } }
}

/** POST /v1/auth/device/approve (session-authenticated) {userCode} -> 204 | 404. */
export async function handleDeviceApprove(principal: Principal, rawBody: string, deps: AuthDeps): Promise<AuthHandlerResponse> {
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const userCode = typeof body.userCode === 'string' ? body.userCode : undefined
  if (!userCode) return { status: 400, json: { error: 'userCode is required' } }
  const ok = await deps.storage.approveDeviceAuthByUserCode(userCode, { userId: principal.userId, orgId: principal.orgId, role: principal.role }, deps.now())
  if (!ok) return { status: 404, json: { error: 'unknown, expired, or already-resolved user code' } }
  return { status: 204, json: {} }
}

/** POST /v1/auth/device/poll {deviceCode} -> 200 {sessionToken,orgId,role} | 428 pending | 410 expired/consumed | 404 unknown. */
export async function handleDevicePoll(rawBody: string, deps: AuthDeps): Promise<AuthHandlerResponse> {
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  const deviceCode = typeof body.deviceCode === 'string' ? body.deviceCode : undefined
  if (!deviceCode) return { status: 400, json: { error: 'deviceCode is required' } }

  const now = deps.now()
  const record = await deps.storage.getDeviceAuthByDeviceCode(deviceCode)
  if (!record) return { status: 404, json: { error: 'unknown device code' } }
  if (record.expiresAt < now) return { status: 410, json: { error: 'device code expired' } }
  if (record.status === 'pending') return { status: 428, json: { error: 'authorization pending' } }
  if (record.status === 'consumed') return { status: 410, json: { error: 'device code already redeemed' } }

  const grant = await deps.storage.consumeDeviceAuth(deviceCode, now)
  if (!grant || !grant.userId || !grant.orgId || !grant.role) {
    return { status: 410, json: { error: 'device code already redeemed' } }
  }
  const session = await mintSession(deps, grant.userId, grant.orgId, grant.role, true)
  return { status: 200, json: sessionBody(session, true), session }
}
