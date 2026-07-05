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
  // CVE enrichment (post-persist, async — see cve.ts). Absent until the
  // background enrichment pass matches this finding against osv.dev.
  cveIds?: string[]
  cveSeverity?: CveSeverity
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

// ── auth: orgs/users/invites/sessions/device-flow ──
// Native session auth (M2a). Every record is org-scoped except lookups keyed
// by a globally-unique row id (email, session/device token, invite/user code).

export type Role = 'admin' | 'member'
export type SessionKind = 'cookie' | 'cli'
export type DeviceAuthStatus = 'pending' | 'approved' | 'consumed'

export const CONTROL_PLANE_VERSION = '0.1.0'
export const SUPPORTED_AUTH_SCHEMA_VERSIONS = [1, 2] as const

export interface OrgRecord {
  readonly id: string
  readonly name: string
  readonly webhookSecret: string
  readonly createdAt: number
}

export interface UserRecord {
  readonly id: string
  readonly orgId: string
  readonly email: string
  readonly passwordHash: string
  readonly role: Role
  readonly createdAt: number
}

export interface InviteRecord {
  readonly code: string
  readonly orgId: string
  readonly role: Role
  readonly expiresAt: number
  readonly usedBy?: string
}

export interface SessionRecord {
  readonly token: string
  readonly userId: string
  readonly orgId: string
  readonly role: Role
  readonly kind: SessionKind
  readonly csrfToken: string
  readonly createdAt: number
  expiresAt: number
  lastSeenAt: number
}

export interface DeviceAuthRecord {
  readonly deviceCode: string
  readonly userCode: string
  status: DeviceAuthStatus
  userId?: string
  orgId?: string
  role?: Role
  readonly createdAt: number
  readonly expiresAt: number
}
// ── policy sync (M2b): per-org rules doc + exceptions ──
// Org-scoped. rulesVersion bumps on every PUT of rules text (yaml/json, opaque
// to the server); exceptionsVersion bumps only when an exception is resolved
// (approve/reject) — creating a pending exception does not change the
// ETag-visible surface since only approved exceptions are ever returned.

export type PolicyExceptionStatus = 'pending' | 'approved' | 'rejected'

export interface PolicyRecord {
  readonly orgId: string
  rulesVersion: number
  rules: string
  exceptionsVersion: number
}

export interface PolicyExceptionRecord {
  readonly id: string
  readonly orgId: string
  readonly ruleId: string
  readonly reason: string
  status: PolicyExceptionStatus
  readonly createdAt: number
  resolvedAt?: number
}

// ── offboarding (M2c): HR-driven asset sweep workflow ──
// Org-scoped, keyed by (orgId, employee.id, effectiveAt) for idempotency —
// a re-POST of the same webhook/session request must return the existing
// task rather than creating a duplicate.

export type OffboardingStatus = 'open' | 'sweeping' | 'done'

export interface OffboardingEmployee {
  readonly id: string
  readonly email: string
  readonly name: string
}

export interface OffboardingAuditEntry {
  readonly at: number
  readonly from: OffboardingStatus | ''
  readonly to: OffboardingStatus
  readonly actor: string
}

export interface OffboardingTask {
  readonly id: string
  readonly orgId: string
  readonly employee: OffboardingEmployee
  assetIds: string[]
  unmatched: boolean
  status: OffboardingStatus
  readonly effectiveAt: string
  readonly createdAt: number
  updatedAt: number
  audit: OffboardingAuditEntry[]
}

// State machine is strictly linear: open -> sweeping -> done. No skips, no
// backwards transitions. Shared by both storage adapters so MemoryStorage and
// SqliteStorage enforce byte-identical semantics.
const OFFBOARDING_TRANSITIONS: Record<OffboardingStatus, OffboardingStatus | null> = {
  open: 'sweeping',
  sweeping: 'done',
  done: null,
}

export function isLegalOffboardingTransition(from: OffboardingStatus, to: OffboardingStatus): boolean {
  return OFFBOARDING_TRANSITIONS[from] === to
}

// ── CVE enrichment (M2d) ──
// osv.dev-derived vulnerability data. `CveCacheRecord` is keyed by
// (ecosystem, package, version) and is the SOLE intentionally-global
// (non-org-scoped) StoragePort surface — see storage/port.ts for the
// whitelist rationale. FindingRecord.cveIds/cveSeverity (above) are the
// org-scoped projection of this data onto a specific org's finding.

export type CveSeverity = 'low' | 'medium' | 'high' | 'critical' | 'unknown'

export interface CveDetail {
  readonly id: string
  readonly severity: CveSeverity
  readonly summary?: string
}

export interface CveCacheRecord {
  readonly vulnIds: string[]
  readonly details: CveDetail[]
  readonly fetchedAt: number
  readonly status: 'fresh' | 'stale'
}
// ── MCP catalog (M2e/§6.6): org-managed approval list for local MCP servers ──
// Org-scoped. A seed list ships with approved:false so a fresh org starts
// deny-by-default; admins flip entries to approved via PUT /v1/mcp/catalog.
// mcpStrictMode is a per-org boolean setting (default false) that bumps the
// scanner's mcp-unapproved advisory finding from low to medium severity.

export interface McpCatalogEntry {
  readonly orgId: string
  readonly serverName: string
  approved: boolean
  riskTags: string[]
  note?: string
  updatedBy: string
  updatedAt: number
}
