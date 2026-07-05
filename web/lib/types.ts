// Shared response shapes for the control-plane /v1/* API, as consumed by the
// console. These mirror the server's JSON contracts (English machine fields);
// they are UI-side view types, not the server's source of truth.

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type CveStatus = 'fresh' | 'stale'

export interface Meta {
  readonly schemaVersions: number[]
  readonly version: string
}

export interface AuthResult {
  readonly orgId: string
  readonly role: 'admin' | 'member'
  readonly sessionToken?: string
}

export interface FleetSummary {
  readonly totalFindings: number
  readonly riskScore: number
  readonly bySeverity: Record<Severity, number>
  readonly byAsset: Array<{ assetId: string; label: string; count: number }>
  readonly bySurface?: Record<string, number>
}

export interface TrendPoint {
  readonly date: string
  readonly total: number
}

export interface TrendResponse {
  readonly points: TrendPoint[]
}

export interface AssetStatus {
  readonly assetId: string
  readonly label: string
  readonly kind: string
  readonly lastSeenAt: number | null
  readonly stale: boolean
}

export interface Finding {
  readonly fingerprint: string
  readonly ruleId: string
  readonly surface: string
  readonly severity: Severity
  readonly location: string
  readonly evidenceRedacted: string
  readonly assetId: string
  readonly cveIds?: string[]
  readonly cveSeverity?: Severity | 'unknown'
  readonly advisory?: boolean
}

export interface PolicyView {
  readonly rulesVersion: number
  readonly exceptionsVersion: number
  readonly rules: string
  readonly exceptions: PolicyException[]
}

export interface PolicyException {
  readonly id: string
  readonly ruleId: string
  readonly reason: string
  readonly status: 'pending' | 'approved' | 'rejected'
}

export interface OffboardingTask {
  readonly id: string
  readonly employee: { id: string; email: string; name: string }
  readonly assetIds: string[]
  readonly unmatched: boolean
  readonly status: 'open' | 'sweeping' | 'done'
  readonly effectiveAt: string
}

export interface McpCatalogEntry {
  readonly serverName: string
  readonly approved: boolean
  readonly riskTags: string[]
  readonly note?: string
}

export interface McpCatalog {
  readonly entries: McpCatalogEntry[]
  readonly mcpStrictMode: boolean
}

export interface OrgMember {
  readonly email: string
  readonly role: 'admin' | 'member'
}
