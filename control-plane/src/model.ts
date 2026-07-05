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
