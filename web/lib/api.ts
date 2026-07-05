// Same-origin control-plane API client for the AgentGuard web console.
//
// SECURITY MODEL (plan §M3 / NEW-CR-2 / CR3):
// - The console is served behind the SAME reverse proxy as the control plane,
//   so every request goes to a SAME-ORIGIN /v1/* path and the browser attaches
//   the HTTP-only session cookie automatically. We NEVER read, store, or send
//   the session token ourselves — there is no session store in the web tier.
// - CSRF double-submit: the control plane sets a NON-HTTP-only `agentguard_csrf`
//   cookie. For state-changing requests (POST/PUT/PATCH/DELETE) we read that
//   cookie and echo it in the `x-agentguard-csrf` header. The server compares
//   header == cookie == Session.csrfToken. The web tier holds NO CSRF authority;
//   it only forwards the value the server minted.
// - `credentials: 'same-origin'` ensures cookies ride along and that we never
//   leak them cross-origin.

export const CSRF_COOKIE = 'agentguard_csrf'
export const CSRF_HEADER = 'x-agentguard-csrf'

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** Read a cookie value by name from a document.cookie-style string. Pure + testable. */
export function readCookie(cookieString: string, name: string): string | undefined {
  for (const part of cookieString.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key !== name) continue
    const raw = part.slice(idx + 1).trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return undefined
}

export interface RequestOptions {
  readonly method?: string
  readonly body?: unknown
  /** Injectable for tests; defaults to globalThis.fetch. */
  readonly fetchImpl?: typeof fetch
  /** Injectable for tests; defaults to document.cookie in the browser. */
  readonly cookieString?: string
  readonly signal?: AbortSignal
}

/**
 * Build the header set for a request. State-changing methods get the CSRF
 * double-submit header sourced from the readable csrf cookie; safe methods
 * (GET/HEAD) never send it. Exported for direct testing.
 */
export function buildHeaders(method: string, hasBody: boolean, cookieString: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (hasBody) headers['content-type'] = 'application/json'
  if (STATE_CHANGING.has(method.toUpperCase())) {
    const csrf = readCookie(cookieString, CSRF_COOKIE)
    if (csrf) headers[CSRF_HEADER] = csrf
  }
  return headers
}

function currentCookieString(explicit: string | undefined): string {
  if (explicit !== undefined) return explicit
  if (typeof document !== 'undefined') return document.cookie
  return ''
}

/**
 * Core same-origin request. `path` MUST be a root-relative /v1/... path; an
 * absolute URL is rejected so the console can never be pointed at a foreign
 * origin (which would defeat the same-origin cookie/CSRF model).
 */
export async function apiRequest<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!path.startsWith('/')) {
    throw new Error(`api path must be root-relative same-origin (got: ${path})`)
  }
  if (/^https?:\/\//i.test(path)) {
    throw new Error('api path must not be an absolute URL (same-origin only)')
  }
  const method = (opts.method ?? 'GET').toUpperCase()
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as typeof fetch)
  if (typeof fetchImpl !== 'function') throw new Error('no fetch implementation available')
  const hasBody = opts.body !== undefined
  const headers = buildHeaders(method, hasBody, currentCookieString(opts.cookieString))

  const res = await fetchImpl(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: hasBody ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  })

  const text = await res.text()
  let parsed: unknown = undefined
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  if (!res.ok) {
    const message =
      parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `request failed (HTTP ${res.status})`
    throw new ApiError(res.status, message, parsed)
  }
  return parsed as T
}

export const api = {
  get: <T = unknown>(path: string, opts?: RequestOptions) => apiRequest<T>(path, { ...opts, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { ...opts, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { ...opts, method: 'PUT', body }),
}
