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

export type ControlPlaneDeps = IngestDeps & EnrollDeps & ReadDeps

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

function sessionOrg(url: URL, headers: Record<string, string>): string | undefined {
  return url.searchParams.get('org') ?? headers['x-agentguard-session-org'] ?? undefined
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
      const org = sessionOrg(url, headers)
      if (path === '/' || path === '/dashboard') {
        if (!org) return sendHtml(400, '<!doctype html><h1>AgentGuard Control Plane</h1><p>Add ?org=&lt;orgId&gt; to view a fleet.</p>')
        return sendHtml(200, renderDashboardHtml(org, deps))
      }
      if (path === '/healthz') return sendJson(200, { ok: true })
      if (path.startsWith('/v1/')) {
        if (!org) return sendJson(401, { error: 'missing org session' })
        if (path === '/v1/dashboard/summary') {
          const r = handleSummary(org, deps)
          return sendJson(r.status, r.json)
        }
        if (path === '/v1/dashboard/trend') {
          const raw = (url.searchParams.get('window') ?? '30d').replace('d', '')
          const windowDays = Number(raw) > 0 ? Number(raw) : 30
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
    return sendJson(500, { error: error instanceof Error ? error.message : 'internal error' })
  }
}
