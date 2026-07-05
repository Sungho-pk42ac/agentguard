import { createHash } from 'node:crypto'
import type { McpCatalogEntry } from './model.js'
import type { Principal } from './verify/viewer.js'
import type { StoragePort } from './storage/port.js'

// MCP catalog (M2e/§6.6): org-managed approval list for local MCP servers.
// GET is available to any authenticated org identity (viewer token OR
// session); PUT requires an admin session (server.ts also gates csrf when the
// principal is cookie-authenticated, same as the other admin mutation routes).

export interface McpCatalogDeps {
  readonly storage: StoragePort
  readonly now: () => number
}

export interface McpCatalogHandlerResponse {
  readonly status: number
  readonly json: Record<string, unknown>
  readonly headers?: Record<string, string>
}

// A small seed list of well-known MCP servers. Every seeded entry ships
// approved:false — a fresh org starts deny-by-default and an admin must
// explicitly approve each server via PUT /v1/mcp/catalog.
export const MCP_CATALOG_SEED: readonly { readonly serverName: string; readonly riskTags: readonly string[] }[] = [
  { serverName: 'filesystem', riskTags: ['filesystem-access', 'broad-root'] },
  { serverName: 'github', riskTags: ['source-code-access', 'credential-scope'] },
  { serverName: 'slack', riskTags: ['messaging', 'pii-exposure'] },
  { serverName: 'puppeteer', riskTags: ['browser-automation', 'network-egress'] },
  { serverName: 'postgres', riskTags: ['database-access', 'credential-scope'] },
  { serverName: 'google-drive', riskTags: ['cloud-storage', 'pii-exposure'] },
]

export function seedMcpCatalog(orgId: string, now: number): McpCatalogEntry[] {
  return MCP_CATALOG_SEED.map((s) => ({
    orgId,
    serverName: s.serverName,
    approved: false,
    riskTags: [...s.riskTags],
    updatedBy: 'system',
    updatedAt: now,
  }))
}

function loadOrSeedCatalog(orgId: string, deps: McpCatalogDeps): McpCatalogEntry[] {
  const existing = deps.storage.getMcpCatalog(orgId)
  if (existing.length > 0) return existing
  const seeded = seedMcpCatalog(orgId, deps.now())
  deps.storage.putMcpCatalog(orgId, seeded)
  return seeded
}

function computeEtag(entries: readonly McpCatalogEntry[], mcpStrictMode: boolean): string {
  return createHash('sha256').update(JSON.stringify({ entries, mcpStrictMode })).digest('hex')
}

function stripWeak(etag: string): string {
  return etag.replace(/^W\//, '').replace(/^"|"$/g, '')
}

/** GET /v1/mcp/catalog (any org principal — viewer token or session). */
export function handleGetMcpCatalog(orgId: string, ifNoneMatch: string | undefined, deps: McpCatalogDeps): McpCatalogHandlerResponse {
  const entries = loadOrSeedCatalog(orgId, deps)
  const mcpStrictMode = deps.storage.getMcpStrictMode(orgId)
  const etag = computeEtag(entries, mcpStrictMode)
  if (ifNoneMatch && stripWeak(ifNoneMatch) === etag) {
    return { status: 304, json: {}, headers: { etag: `"${etag}"` } }
  }
  return { status: 200, json: { entries, mcpStrictMode }, headers: { etag: `"${etag}"` } }
}

function parseJson(rawBody: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(rawBody)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return undefined
  }
}

/** PUT /v1/mcp/catalog (admin only) {entries:[{serverName,approved,riskTags?,note?}], mcpStrictMode?}. */
export function handlePutMcpCatalog(principal: Principal, rawBody: string, deps: McpCatalogDeps): McpCatalogHandlerResponse {
  if (principal.role !== 'admin') return { status: 403, json: { error: 'admin role required' } }
  const body = parseJson(rawBody)
  if (!body) return { status: 400, json: { error: 'invalid JSON body' } }
  if (!Array.isArray(body.entries)) return { status: 400, json: { error: 'entries must be an array' } }

  const now = deps.now()
  const entries: McpCatalogEntry[] = []
  for (const raw of body.entries) {
    if (!raw || typeof raw !== 'object') return { status: 400, json: { error: 'each entry must be an object' } }
    const record = raw as Record<string, unknown>
    const serverName = record.serverName
    const approved = record.approved
    if (typeof serverName !== 'string' || serverName.trim().length === 0) {
      return { status: 400, json: { error: 'each entry requires a non-empty serverName' } }
    }
    if (typeof approved !== 'boolean') {
      return { status: 400, json: { error: 'each entry requires approved: boolean' } }
    }
    const riskTags = Array.isArray(record.riskTags) ? record.riskTags.filter((t): t is string => typeof t === 'string') : []
    const note = typeof record.note === 'string' ? record.note : undefined
    entries.push({ orgId: principal.orgId, serverName, approved, riskTags, note, updatedBy: principal.userId, updatedAt: now })
  }

  deps.storage.putMcpCatalog(principal.orgId, entries)
  if (typeof body.mcpStrictMode === 'boolean') {
    deps.storage.setMcpStrictMode(principal.orgId, body.mcpStrictMode)
  }
  const mcpStrictMode = deps.storage.getMcpStrictMode(principal.orgId)
  return { status: 200, json: { entries, mcpStrictMode } }
}
