// CVE matching (M2d, §6.5 [CR7/CR-C]). Post-persist, NEVER awaited on the
// ingest path (see ingest.ts's `enrich` hook). Two osv.dev calls, both
// keyless:
//   1. Batched POST /v1/querybatch  -> vuln ids per (ecosystem, package, version)
//   2. Per-vuln GET  /v1/vulns/{id} -> CVSS score (severity) + summary
// Results are cached in StoragePort under cve_cache, the SOLE intentionally
// GLOBAL (non-org-scoped) surface — see storage/port.ts for the rationale.
// A fetch failure (throw, non-2xx, or a hang the caller chooses not to await)
// degrades to "serve whatever is cached, mark it stale" — it never throws
// out of `enrichFindings`, so it can never block or fail ingest.

import type { CveDetail, CveSeverity, FindingRecord } from './model.js'
import type { StoragePort } from './storage/port.js'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface EnrichDeps {
  readonly storage: StoragePort
  readonly fetch: FetchLike
  readonly now: () => number
  /** How long a cached (ecosystem, package, version) entry is trusted before re-querying osv.dev. Default 24h. */
  readonly ttlMs?: number
}

const OSV_QUERYBATCH_URL = 'https://api.osv.dev/v1/querybatch'
const osvVulnUrl = (id: string): string => `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

// Surfaces whose evidenceRedacted text carries a trailing `name@version` we
// can match against an osv.dev ecosystem. Additive: unknown surfaces are
// simply skipped (not everything a scanner finds is a package).
const SURFACE_ECOSYSTEM: Record<string, string> = {
  'npm-global': 'npm',
}

interface PackageKey {
  readonly ecosystem: string
  readonly name: string
  readonly version: string
}

function cacheKeyOf(key: PackageKey): string {
  return `${key.ecosystem}\u0000${key.name}\u0000${key.version}`
}

/** Extract {ecosystem,name,version} from a package-shaped finding, or null. */
export function extractPackage(finding: Pick<FindingRecord, 'surface' | 'evidenceRedacted'>): PackageKey | null {
  const ecosystem = SURFACE_ECOSYSTEM[finding.surface]
  if (!ecosystem) return null
  // Trailing "name@version": greedy name-group backtracks to leave exactly
  // one non-'@' segment for version, which also handles scoped npm names
  // that themselves contain an '@' (e.g. "@openai/codex@1.2.3").
  const match = /(\S+)@([^@\s]+)$/.exec(finding.evidenceRedacted)
  if (!match) return null
  const [, name, version] = match
  if (!name || !version) return null
  return { ecosystem, name, version }
}

const CVSS_LOW_MAX = 4
const CVSS_MEDIUM_MAX = 7
const CVSS_HIGH_MAX = 9

function cvssScoreToSeverity(score: number): CveSeverity {
  if (score >= CVSS_HIGH_MAX) return 'critical'
  if (score >= CVSS_MEDIUM_MAX) return 'high'
  if (score >= CVSS_LOW_MAX) return 'medium'
  return 'low'
}

// osv.dev's database_specific.severity (GHSA-derived advisories) uses these
// labels directly when no CVSS vector/score is present.
function labelToSeverity(label: string): CveSeverity | null {
  switch (label.toUpperCase()) {
    case 'LOW':
      return 'low'
    case 'MODERATE':
    case 'MEDIUM':
      return 'medium'
    case 'HIGH':
      return 'high'
    case 'CRITICAL':
      return 'critical'
    default:
      return null
  }
}

/** Parse an osv.dev vuln detail response into a severity label. */
export function severityFromOsvVuln(vuln: unknown): CveSeverity {
  const obj = (vuln ?? {}) as Record<string, unknown>
  const severityArr = obj.severity
  if (Array.isArray(severityArr)) {
    let maxScore = -1
    for (const entry of severityArr) {
      if (!entry || typeof entry !== 'object') continue
      const raw = (entry as Record<string, unknown>).score
      const score = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : NaN
      if (Number.isFinite(score) && score > maxScore) maxScore = score
    }
    if (maxScore >= 0) return cvssScoreToSeverity(maxScore)
  }
  const databaseSpecific = obj.database_specific
  if (databaseSpecific && typeof databaseSpecific === 'object') {
    const label = (databaseSpecific as Record<string, unknown>).severity
    if (typeof label === 'string') {
      const mapped = labelToSeverity(label)
      if (mapped) return mapped
    }
  }
  return 'unknown'
}

const SEVERITY_RANK: Record<CveSeverity, number> = { unknown: 0, low: 1, medium: 2, high: 3, critical: 4 }

function maxSeverity(details: CveDetail[]): CveSeverity {
  let best: CveSeverity = 'unknown'
  for (const d of details) {
    if (SEVERITY_RANK[d.severity] > SEVERITY_RANK[best]) best = d.severity
  }
  return best
}

async function fetchVulnDetail(deps: EnrichDeps, id: string): Promise<CveDetail> {
  try {
    const res = await deps.fetch(osvVulnUrl(id))
    if (!res.ok) return { id, severity: 'unknown' }
    const json = await res.json()
    const summary = json && typeof json === 'object' && typeof (json as Record<string, unknown>).summary === 'string'
      ? ((json as Record<string, unknown>).summary as string)
      : undefined
    return { id, severity: severityFromOsvVuln(json), summary }
  } catch {
    return { id, severity: 'unknown' }
  }
}

/**
 * Batch-query osv.dev for `keys` and refresh the global cve_cache for each.
 * On ANY failure (network throw, non-2xx), existing cache entries for these
 * keys are marked stale and left as-is; keys with no prior cache stay
 * uncached (their findings simply carry no cveIds until osv.dev recovers).
 * This function never throws.
 */
async function queryAndCache(deps: EnrichDeps, keys: PackageKey[], now: number): Promise<void> {
  let results: Array<{ vulns?: Array<{ id: string }> }>
  try {
    const res = await deps.fetch(OSV_QUERYBATCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queries: keys.map((k) => ({ package: { name: k.name, ecosystem: k.ecosystem }, version: k.version })),
      }),
    })
    if (!res.ok) throw new Error(`osv querybatch failed: ${res.status}`)
    const json = (await res.json()) as { results?: Array<{ vulns?: Array<{ id: string }> }> }
    results = json.results ?? []
  } catch {
    for (const key of keys) {
      const existing = await deps.storage.getCveCache(key.ecosystem, key.name, key.version)
      if (existing) {
        await deps.storage.putCveCache(key.ecosystem, key.name, key.version, { ...existing, status: 'stale' })
      }
    }
    return
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!
    const vulnIds = (results[i]?.vulns ?? []).map((v) => v.id)
    const details: CveDetail[] = []
    for (const id of vulnIds) {
      details.push(await fetchVulnDetail(deps, id))
    }
    await deps.storage.putCveCache(key.ecosystem, key.name, key.version, { vulnIds, details, fetchedAt: now, status: 'fresh' })
  }
}

/**
 * Enrich every package-shaped finding for `orgId` with CVE data. Cache hits
 * within the TTL do ZERO network calls (neither querybatch nor per-vuln
 * fetches) — this is both the performance optimization and the osv.dev
 * outage backoff. Never throws: callers (the ingest post-persist hook, and
 * POST /v1/cve/refresh) may call this without a try/catch and it will not
 * propagate a failure.
 */
export async function enrichFindings(deps: EnrichDeps, orgId: string): Promise<void> {
  const findings = await deps.storage.listFindings(orgId)
  const targets: Array<{ finding: FindingRecord; key: PackageKey }> = []
  const uniqueKeys = new Map<string, PackageKey>()
  for (const finding of findings) {
    const key = extractPackage(finding)
    if (!key) continue
    targets.push({ finding, key })
    uniqueKeys.set(cacheKeyOf(key), key)
  }
  if (targets.length === 0) return

  try {
    const now = deps.now()
    const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS
    const toFetch: PackageKey[] = []
    for (const key of uniqueKeys.values()) {
      const cached = await deps.storage.getCveCache(key.ecosystem, key.name, key.version)
      if (!cached || cached.status === 'stale' || now - cached.fetchedAt > ttlMs) {
        toFetch.push(key)
      }
    }
    if (toFetch.length > 0) await queryAndCache(deps, toFetch, now)

    for (const { finding, key } of targets) {
      const cached = await deps.storage.getCveCache(key.ecosystem, key.name, key.version)
      if (!cached || cached.vulnIds.length === 0) continue
      await deps.storage.updateFindingCve(orgId, finding.assetId, finding.fingerprint, cached.vulnIds, maxSeverity(cached.details))
    }
  } catch {
    // Enrichment is best-effort and post-persist; nothing here may ever
    // surface as an ingest failure.
  }
}
