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
import type { FindingFilter, Severity } from './model.js'
import type { ViewerAuth } from './verify/viewer.js'

export type ControlPlaneDeps = IngestDeps & EnrollDeps & ReadDeps & { readonly viewerAuth: ViewerAuth }

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

function clampWindowDays(raw: string | null): number {
  const n = Math.floor(Number((raw ?? '30d').replace('d', '')))
  if (!Number.isFinite(n) || n < 1) return 30
  return Math.min(n, 365)
}

const SEVERITIES = new Set<Severity>(['low', 'medium', 'high', 'critical'])

export function createControlPlane(deps: ControlPlaneDeps): Server {
  return createServer((req, res) => {
    void route(req, res, deps)
  })
}

async function route(req: IncomingMessage, res: ServerResponse, deps: ControlPlaneDeps): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'
  const headers = normalizeHeaders(req)

  const sendJson = (status: number, json: Record<string, unknown>): void => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(json))
  }
  const sendHtml = (status: number, html: string): void => {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
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

    if (method === 'GET') {
      if (path === '/healthz') return sendJson(200, { ok: true })
      // Reads are authorized: the org comes from the viewer token, not ?org=.
      const org = deps.viewerAuth.resolveOrg(viewerToken(url, headers))
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
