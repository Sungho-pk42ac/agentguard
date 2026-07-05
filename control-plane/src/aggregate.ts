import type { AssetRecord, FindingRecord } from './model.js'
import type { Severity } from './contract.js'

// Pure, org-scoped aggregation. The caller passes rows already fetched from
// storage for a single org, so aggregation itself carries no cross-tenant path.

export function severityScore(severity: Severity): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity]
}

// [R3/NEW-CR-1] Advisory findings (REVIEW tier, e.g. mcp-unapproved) never
// gate the risk score.
export function riskScore(findings: readonly { severity: Severity; advisory?: boolean }[]): number {
  return findings.filter((f) => !f.advisory).reduce((sum, f) => sum + severityScore(f.severity), 0)
}

export interface AssetSummary {
  readonly assetId: string
  readonly label: string
  readonly count: number
  readonly riskScore: number
}

export interface FleetSummary {
  readonly totalFindings: number
  readonly riskScore: number
  readonly bySurface: Record<string, number>
  readonly bySeverity: Record<Severity, number>
  readonly byAsset: AssetSummary[]
}

// [R3/NEW-CR-1] Advisory findings are skipped entirely: they never contribute
// to totalFindings, bySurface/bySeverity buckets, or riskScore.
export function summarize(findings: readonly FindingRecord[], assets: readonly AssetRecord[]): FleetSummary {
  const scored = findings.filter((f) => !f.advisory)
  const bySurface: Record<string, number> = {}
  const bySeverity: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 }
  const perAsset = new Map<string, FindingRecord[]>()
  for (const f of scored) {
    bySurface[f.surface] = (bySurface[f.surface] ?? 0) + 1
    bySeverity[f.severity] += 1
    const list = perAsset.get(f.assetId) ?? []
    list.push(f)
    perAsset.set(f.assetId, list)
  }
  const byAsset: AssetSummary[] = assets.map((a) => {
    const list = perAsset.get(a.assetId) ?? []
    return { assetId: a.assetId, label: a.label, count: list.length, riskScore: riskScore(list) }
  })
  return {
    totalFindings: scored.length,
    riskScore: riskScore(scored),
    bySurface,
    bySeverity,
    byAsset,
  }
}

export interface TrendPoint {
  readonly date: string
  readonly riskScore: number
}

const DAY_MS = 86_400_000

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Cumulative daily risk score across a trailing window. Each point is the total
 * risk score of every finding first seen up to and including that day, so the
 * series is monotonic and time-ordered.
 */
export function trend(findings: readonly FindingRecord[], options: { now: number; windowDays?: number }): TrendPoint[] {
  const windowDays = options.windowDays ?? 30
  const points: TrendPoint[] = []
  const startDay = Math.floor((options.now - (windowDays - 1) * DAY_MS) / DAY_MS) * DAY_MS
  for (let i = 0; i < windowDays; i++) {
    const dayStart = startDay + i * DAY_MS
    const dayEnd = dayStart + DAY_MS
    const upTo = findings.filter((f) => f.firstSeen < dayEnd)
    points.push({ date: dayKey(dayStart), riskScore: riskScore(upTo) })
  }
  return points
}

export interface AssetStatus {
  readonly assetId: string
  readonly label: string
  readonly kind: string
  readonly lastSeenAt: number | null
  readonly stale: boolean
}

export function assetStatuses(
  assets: readonly AssetRecord[],
  options: { now: number; staleThresholdHours: number },
): AssetStatus[] {
  const thresholdMs = options.staleThresholdHours * 3_600_000
  return assets.map((a) => ({
    assetId: a.assetId,
    label: a.label,
    kind: a.kind,
    lastSeenAt: a.lastSeenAt,
    stale: a.lastSeenAt === null || options.now - a.lastSeenAt > thresholdMs,
  }))
}
