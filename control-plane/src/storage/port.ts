import type { AlertRecord, AssetRecord, FindingFilter, FindingRecord, IngestEventRecord } from '../model.js'
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

  close(): void
}
