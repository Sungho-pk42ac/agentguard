import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { handleEnroll, handleReport, type EnrollDeps, type IngestDeps } from './ingest.js'
import {
  handleAssets,
  handleFindings,
  handleSummary,
  handleTrend,
  renderDashboardHtml,
  type ReadDeps,
} from './dashboard.js'
import {
  handleAcceptInvite,
  handleCreateInvite,
  handleDeviceApprove,
  handleDevicePoll,
  handleDeviceStart,
  handleListMembers,
  handleLogin,
  handleLogout,
  handleMeta,
  handleRegister,
  type AuthDeps,
  type AuthHandlerResponse,
} from './auth/routes.js'
import type { FindingFilter, Severity } from './model.js'
import type { SessionRecord } from './model.js'
import { SessionAuth, type Principal, type PrincipalResolver, type ViewerAuth } from './verify/viewer.js'

export type ControlPlaneDeps = IngestDeps & EnrollDeps & ReadDeps & AuthDeps & { readonly viewerAuth: ViewerAuth }

const SESSION_COOKIE = 'agentguard_session'
const CSRF_COOKIE = 'agentguard_csrf'

const MAX_BODY_BYTES = 4 * 1024 * 1024

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body exceeds 4MB limit'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// Node lowercases header names; collapse any array values to the first entry.
function normalizeHeaders(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    out[key] = Array.isArray(value) ? (value[0] ?? '') : value
  }
  return out
}

// Extract the viewer token: Authorization: Bearer, x-agentguard-viewer-key, or
// ?key= (browser convenience). The org is derived from the AUTHENTICATED token,
// never from a client-supplied ?org=.
function viewerToken(url: URL, headers: Record<string, string>): string | undefined {
  const auth = headers['authorization']
  if (auth && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length)
  return headers['x-agentguard-viewer-key'] ?? url.searchParams.get('key') ?? undefined
}

function bearerToken(headers: Record<string, string>): string | undefined {
  const auth = headers['authorization']
  return auth && auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined
}

// Tiny manual cookie parser (no dependency): "a=1; b=2" -> {a:'1', b:'2'}.
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

// Secure flag is set only when the request arrived over TLS — directly, or
// behind a proxy that sets x-forwarded-proto.
function isHttpsRequest(req: IncomingMessage, headers: Record<string, string>): boolean {
  return (req.socket as { encrypted?: boolean }).encrypted === true || headers['x-forwarded-proto'] === 'https'
}

function serializeCookie(name: string, value: string, opts: { httpOnly: boolean; maxAgeSec: number; secure: boolean }): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax', `Max-Age=${Math.max(0, opts.maxAgeSec)}`]
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { httpOnly: name === SESSION_COOKIE, maxAgeSec: 0, secure })
}

function sessionCookies(session: SessionRecord, now: number, secure: boolean): string[] {
  const maxAgeSec = Math.floor((session.expiresAt - now) / 1000)
  return [
    serializeCookie(SESSION_COOKIE, session.token, { httpOnly: true, maxAgeSec, secure }),
    serializeCookie(CSRF_COOKIE, session.csrfToken, { httpOnly: false, maxAgeSec, secure }),
  ]
}

/** Session identity for a request: Bearer takes precedence over the cookie. */
function sessionContext(
  headers: Record<string, string>,
  cookies: Record<string, string>,
  sessionAuth: PrincipalResolver,
): { principal: Principal | null; token: string | undefined; viaCookie: boolean } {
  const bearer = bearerToken(headers)
  const cookieToken = cookies[SESSION_COOKIE]
  const principal = sessionAuth.resolvePrincipal({ bearer, cookie: cookieToken })
  return { principal, token: bearer ?? cookieToken, viaCookie: !bearer && cookieToken !== undefined }
}

// CSRF double-submit: cookie-authenticated state-changing requests must present
// x-agentguard-csrf equal to BOTH the (non-HttpOnly) csrf cookie AND the
// session's server-side csrfToken. Bearer-authenticated requests are exempt.
function csrfOk(headers: Record<string, string>, cookies: Record<string, string>, session: SessionRecord): boolean {
  const header = headers['x-agentguard-csrf']
  const cookieCsrf = cookies[CSRF_COOKIE]
  return header !== undefined && header.length > 0 && header === cookieCsrf && header === session.csrfToken
}

function clampWindowDays(raw: string | null): number {
  const n = Math.floor(Number((raw ?? '30d').replace('d', '')))
  if (!Number.isFinite(n) || n < 1) return 30
  return Math.min(n, 365)
}

const SEVERITIES = new Set<Severity>(['low', 'medium', 'high', 'critical'])

export function createControlPlane(deps: ControlPlaneDeps): Server {
  const sessionAuth = new SessionAuth(deps.storage, deps.now)
  return createServer((req, res) => {
    void route(req, res, deps, sessionAuth)
  })
}

async function route(req: IncomingMessage, res: ServerResponse, deps: ControlPlaneDeps, sessionAuth: PrincipalResolver): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'
  const headers = normalizeHeaders(req)
  const cookies = parseCookies(headers['cookie'])
  const secure = isHttpsRequest(req, headers)

  const sendJson = (status: number, json: Record<string, unknown>): void => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(json))
  }
  const sendHtml = (status: number, html: string): void => {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  }
  // Auth handlers return {status,json[,session][,clearSession]}; this wires
  // the Set-Cookie side effects (mint or clear) and the response body/status.
  const sendAuth = (result: AuthHandlerResponse): void => {
    const setCookies: string[] = []
    if (result.session) setCookies.push(...sessionCookies(result.session, deps.now(), secure))
    if (result.clearSession) setCookies.push(clearCookie(SESSION_COOKIE, secure), clearCookie(CSRF_COOKIE, secure))
    if (setCookies.length > 0) res.setHeader('set-cookie', setCookies)
    if (result.status === 204) {
      res.writeHead(204)
      res.end()
      return
    }
    return sendJson(result.status, result.json)
  }
  // CSRF gate for a cookie-authenticated state-changing request. Bearer-
  // authenticated requests skip this entirely. Returns true iff the request
  // may proceed.
  const requireCsrfIfCookie = (ctx: { token: string | undefined; viaCookie: boolean }): boolean => {
    if (!ctx.viaCookie) return true
    const session = ctx.token ? deps.storage.getSession(ctx.token) : undefined
    if (!session || !csrfOk(headers, cookies, session)) {
      sendJson(403, { error: 'CSRF check failed: missing or mismatched x-agentguard-csrf' })
      return false
    }
    return true
  }

  try {
    if (method === 'POST' && path === '/v1/reports') {
      const body = await readBody(req)
      const result = await handleReport(body, headers, deps)
      return sendJson(result.status, result.json)
    }
    if (method === 'POST' && path === '/v1/enroll') {
      const body = await readBody(req)
      const result = handleEnroll(body, deps)
      return sendJson(result.status, result.json)
    }

    if (method === 'GET' && path === '/v1/meta') {
      return sendAuth(handleMeta())
    }

    if (method === 'POST' && path === '/v1/auth/register') {
      const body = await readBody(req)
      return sendAuth(handleRegister(body, headers, deps))
    }
    if (method === 'POST' && path === '/v1/auth/login') {
      const body = await readBody(req)
      return sendAuth(handleLogin(body, headers, deps))
    }
    if (method === 'POST' && path === '/v1/auth/logout') {
      const ctx = sessionContext(headers, cookies, sessionAuth)
      if (!ctx.token) return sendJson(401, { error: 'no active session' })
      if (!requireCsrfIfCookie(ctx)) return
      return sendAuth(handleLogout(ctx.token, deps))
    }
    if (method === 'POST' && path === '/v1/auth/accept-invite') {
      const body = await readBody(req)
      return sendAuth(handleAcceptInvite(body, headers, deps))
    }
    if (method === 'POST' && path === '/v1/auth/device/start') {
      return sendAuth(handleDeviceStart(deps))
    }
    if (method === 'POST' && path === '/v1/auth/device/poll') {
      const body = await readBody(req)
      return sendAuth(handleDevicePoll(body, deps))
    }
    if (method === 'POST' && path === '/v1/auth/device/approve') {
      // Session-authenticated only: a viewer token or device HMAC identity
      // never resolves to a Principal here.
      const ctx = sessionContext(headers, cookies, sessionAuth)
      if (!ctx.principal) return sendJson(401, { error: 'unauthorized: a valid session is required' })
      if (!requireCsrfIfCookie(ctx)) return
      const body = await readBody(req)
      return sendAuth(handleDeviceApprove(ctx.principal, body, deps))
    }
    if (method === 'POST' && path === '/v1/orgs/invites') {
      const ctx = sessionContext(headers, cookies, sessionAuth)
      if (!ctx.principal) return sendJson(401, { error: 'unauthorized: a valid session is required' })
      if (!requireCsrfIfCookie(ctx)) return
      const body = await readBody(req)
      return sendAuth(handleCreateInvite(ctx.principal, body, deps))
    }
    if (method === 'GET' && path === '/v1/orgs/members') {
      const ctx = sessionContext(headers, cookies, sessionAuth)
      if (!ctx.principal) return sendJson(401, { error: 'unauthorized: a valid session is required' })
      return sendAuth(handleListMembers(ctx.principal, deps))
    }

    if (method === 'GET') {
      if (path === '/healthz') return sendJson(200, { ok: true })
      // Reads are authorized by EITHER a legacy viewer token OR a session
      // (cookie/bearer). The org is derived from the AUTHENTICATED identity,
      // never from a client-supplied ?org=.
      let org = deps.viewerAuth.resolveOrg(viewerToken(url, headers))
      if (!org) {
        const ctx = sessionContext(headers, cookies, sessionAuth)
        org = ctx.principal?.orgId ?? null
      }
      if (path === '/' || path === '/dashboard') {
        if (!org) {
          res.setHeader('www-authenticate', 'Bearer realm="agentguard"')
          return sendHtml(401, '<!doctype html><h1>AgentGuard Control Plane</h1><p>Unauthorized — present a viewer token (Authorization: Bearer, or ?key=).</p>')
        }
        return sendHtml(200, renderDashboardHtml(org, deps))
      }
      if (path.startsWith('/v1/')) {
        if (!org) return sendJson(401, { error: 'unauthorized: valid viewer token required' })
        if (path === '/v1/dashboard/summary') {
          const r = handleSummary(org, deps)
          return sendJson(r.status, r.json)
        }
        if (path === '/v1/dashboard/trend') {
          const windowDays = clampWindowDays(url.searchParams.get('window'))
          const r = handleTrend(org, windowDays, deps)
          return sendJson(r.status, r.json)
        }
        if (path === '/v1/assets') {
          const r = handleAssets(org, deps)
          return sendJson(r.status, r.json)
        }
        if (path === '/v1/findings') {
          const sev = url.searchParams.get('severity')
          const filter: FindingFilter = {
            surface: url.searchParams.get('surface') ?? undefined,
            severity: sev && SEVERITIES.has(sev as Severity) ? (sev as Severity) : undefined,
            assetId: url.searchParams.get('assetId') ?? undefined,
          }
          const r = handleFindings(org, filter, deps)
          return sendJson(r.status, r.json)
        }
      }
    }

    return sendJson(404, { error: 'not found' })
  } catch (error) {
    // Log server-side; never leak internal exception detail to the network.
    console.error('control-plane request error:', error)
    return sendJson(500, { error: 'internal error' })
  }
}
