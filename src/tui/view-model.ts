import type { PostureFinding } from '../posture.js'
import type { ResidualCredential } from '../residual.js'
import type { Finding, Severity } from '../rules.js'

// Pure view-model for the findings explorer: a single item shape all sources
// normalize to, plus filtering/selection/color helpers. No React here.

export interface ExplorerItem {
  readonly severity: Severity
  readonly surface: string
  readonly location: string
  readonly evidence: string
  readonly recommendation: string
  readonly line?: number
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'red',
  high: 'magenta',
  medium: 'yellow',
  low: 'gray',
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
export const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low']

export function severityColor(severity: Severity): string {
  return SEVERITY_COLOR[severity]
}

export function findingToItem(finding: Finding): ExplorerItem {
  return {
    severity: finding.severity,
    surface: finding.category,
    location: finding.file ?? finding.id,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
    ...(finding.line === undefined ? {} : { line: finding.line }),
  }
}

export function residualToItem(residual: ResidualCredential): ExplorerItem {
  return {
    severity: residual.severity,
    surface: residual.surface,
    location: residual.location,
    evidence: residual.evidence,
    recommendation: residual.recommendation,
    ...(residual.line === undefined ? {} : { line: residual.line }),
  }
}

export function postureToItem(finding: PostureFinding): ExplorerItem {
  return {
    severity: finding.severity,
    surface: finding.surface,
    location: finding.file ?? finding.surface,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
  }
}

export interface ExplorerFilter {
  readonly severity?: Severity
  readonly query?: string
}

export function filterItems(items: readonly ExplorerItem[], filter: ExplorerFilter): ExplorerItem[] {
  const query = filter.query?.trim().toLowerCase()
  return items.filter((item) => {
    if (filter.severity && item.severity !== filter.severity) return false
    if (query && query.length > 0) {
      const haystack = `${item.surface} ${item.location} ${item.evidence}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export function sortItemsBySeverity(items: readonly ExplorerItem[]): ExplorerItem[] {
  return [...items].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
}

// Cycles the severity filter: none -> critical -> high -> medium -> low -> none.
export function nextSeverityFilter(current: Severity | undefined): Severity | undefined {
  if (current === undefined) return 'critical'
  const index = SEVERITY_ORDER.indexOf(current)
  return SEVERITY_ORDER[index + 1]
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  if (index < 0) return 0
  if (index >= length) return length - 1
  return index
}

export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}
