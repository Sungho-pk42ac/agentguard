import type { ReportFinding, Severity } from './contract.js'
export type { Severity } from './contract.js'

// Server-side records. Every record is orgId-scoped; the storage port requires
// orgId on every read and write so no cross-tenant path exists.

export type AssetKind = 'pc' | 'ci'
export type AuthKind = 'device-token' | 'oidc'

export interface AssetRecord {
  readonly orgId: string
  readonly assetId: string
  readonly label: string
  readonly kind: AssetKind
  readonly authKind: AuthKind
  // For device-token assets: the HMAC signing secret (encrypt at rest in prod).
  readonly secret?: string
  // For oidc assets: the expected token subject + provider binding.
  readonly subject?: string
  readonly provider?: 'github' | 'gitlab'
  lastSeenAt: number | null
  readonly createdAt: number
}

export interface FindingRecord extends ReportFinding {
  readonly orgId: string
  readonly assetId: string
  firstSeen: number
  lastSeen: number
  status: 'open' | 'resolved' | 'allowlisted'
}

export interface AlertRecord {
  readonly orgId: string
  readonly fingerprint: string
  readonly severity: Severity
  readonly firedAt: number
  readonly channel: string
}

export interface IngestEventRecord {
  readonly orgId: string
  readonly assetId: string
  readonly receivedAt: number
  readonly findingCount: number
}

export interface FindingFilter {
  readonly surface?: string
  readonly severity?: Severity
  readonly assetId?: string
}
