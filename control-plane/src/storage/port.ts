import type {
  AlertRecord,
  AssetRecord,
  DeviceAuthRecord,
  FindingFilter,
  FindingRecord,
  IngestEventRecord,
  InviteRecord,
  OrgRecord,
  Role,
  SessionRecord,
  UserRecord,
} from '../model.js'
import type { ReportFinding } from '../contract.js'

// Multi-tenant storage boundary. EVERY method takes orgId (except lookups that
// key by a globally-unique row id); there is no unscoped read path. Two
// implementations ship in Phase 1: MemoryStorage and SqliteStorage. A
// PostgresStorage adapter implements the same interface for production
// (documented, not verified locally).

export interface UpsertFindingResult {
  /** True when this (orgId, assetId, fingerprint) was not previously stored. */
  readonly isNew: boolean
}

export interface StoragePort {
  // ── assets ──
  createAsset(asset: AssetRecord): void
  getAsset(orgId: string, assetId: string): AssetRecord | undefined
  touchAsset(orgId: string, assetId: string, at: number): void
  listAssets(orgId: string): AssetRecord[]

  // ── findings ──
  upsertFinding(orgId: string, assetId: string, finding: ReportFinding, at: number): UpsertFindingResult
  listFindings(orgId: string, filter?: FindingFilter): FindingRecord[]

  // ── ingest audit ──
  recordIngest(event: IngestEventRecord): void

  // ── alerts (dedup keyed on (orgId, fingerprint)) ──
  alertExists(orgId: string, fingerprint: string): boolean
  recordAlert(alert: AlertRecord): void
  listAlerts(orgId: string): AlertRecord[]

  // ── enrollment codes (one-time, hashed, expiring) ──
  putEnrollmentCode(orgId: string, codeHash: string, expiresAt: number): void
  consumeEnrollmentCode(orgId: string, codeHash: string, now: number): boolean

  // ── OIDC enrollment grants (which provider:subject may enroll into an org) ──
  grantOidc(orgId: string, provider: string, subject: string): void
  isOidcGranted(orgId: string, provider: string, subject: string): boolean

  // ── auth: orgs ──
  createOrg(org: OrgRecord): void
  getOrg(orgId: string): OrgRecord | undefined

  // ── auth: users (email is globally unique for login-by-email) ──
  createUser(user: UserRecord): void
  getUserByEmail(email: string): UserRecord | undefined
  getUser(orgId: string, userId: string): UserRecord | undefined
  listUsers(orgId: string): UserRecord[]

  // ── auth: invites (single-use, expiring — like enrollment codes) ──
  createInvite(invite: InviteRecord): void
  consumeInvite(code: string, now: number): InviteRecord | undefined

  // ── auth: sessions ──
  createSession(session: SessionRecord): void
  getSession(token: string): SessionRecord | undefined
  deleteSession(token: string): void
  touchSession(token: string, at: number): void

  // ── auth: login rate-limiting (per-email failure counter) ──
  recordLoginFailure(email: string, at: number): void
  countRecentLoginFailures(email: string, sinceInclusive: number): number

  // ── auth: CLI device-authorization flow ──
  createDeviceAuth(record: DeviceAuthRecord): void
  getDeviceAuthByDeviceCode(deviceCode: string): DeviceAuthRecord | undefined
  approveDeviceAuthByUserCode(userCode: string, grant: { userId: string; orgId: string; role: Role }, now: number): boolean
  consumeDeviceAuth(deviceCode: string, now: number): DeviceAuthRecord | undefined

  close(): void
}
