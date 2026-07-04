import type { AlertRecord, AssetRecord, FindingFilter, FindingRecord, IngestEventRecord } from '../model.js'
import type { ReportFinding } from '../contract.js'
import type { StoragePort, UpsertFindingResult } from './port.js'

// In-memory storage. The default for tests and ephemeral/dev control planes.
// Byte-for-byte the same semantics as SqliteStorage so the same acceptance
// suite runs against both.
export class MemoryStorage implements StoragePort {
  private readonly assets = new Map<string, AssetRecord>()
  private readonly findings = new Map<string, FindingRecord>()
  private readonly alerts = new Map<string, AlertRecord>()
  private readonly ingests: IngestEventRecord[] = []
  private readonly codes = new Map<string, number>()

  private assetKey(orgId: string, assetId: string): string {
    return `${orgId}\u0000${assetId}`
  }
  private findingKey(orgId: string, assetId: string, fingerprint: string): string {
    return `${orgId}\u0000${assetId}\u0000${fingerprint}`
  }
  private alertKey(orgId: string, fingerprint: string): string {
    return `${orgId}\u0000${fingerprint}`
  }

  createAsset(asset: AssetRecord): void {
    this.assets.set(this.assetKey(asset.orgId, asset.assetId), { ...asset })
  }
  getAsset(orgId: string, assetId: string): AssetRecord | undefined {
    const a = this.assets.get(this.assetKey(orgId, assetId))
    return a ? { ...a } : undefined
  }
  touchAsset(orgId: string, assetId: string, at: number): void {
    const a = this.assets.get(this.assetKey(orgId, assetId))
    if (a) a.lastSeenAt = at
  }
  listAssets(orgId: string): AssetRecord[] {
    return [...this.assets.values()].filter((a) => a.orgId === orgId).map((a) => ({ ...a }))
  }

  upsertFinding(orgId: string, assetId: string, finding: ReportFinding, at: number): UpsertFindingResult {
    const key = this.findingKey(orgId, assetId, finding.fingerprint)
    const existing = this.findings.get(key)
    if (existing) {
      existing.lastSeen = at
      existing.severity = finding.severity
      existing.location = finding.location
      existing.evidenceRedacted = finding.evidenceRedacted
      existing.surface = finding.surface
      existing.ruleId = finding.ruleId
      return { isNew: false }
    }
    this.findings.set(key, { ...finding, orgId, assetId, firstSeen: at, lastSeen: at, status: 'open' })
    return { isNew: true }
  }
  listFindings(orgId: string, filter: FindingFilter = {}): FindingRecord[] {
    return [...this.findings.values()]
      .filter((f) => f.orgId === orgId)
      .filter((f) => (filter.surface ? f.surface === filter.surface : true))
      .filter((f) => (filter.severity ? f.severity === filter.severity : true))
      .filter((f) => (filter.assetId ? f.assetId === filter.assetId : true))
      .map((f) => ({ ...f }))
  }

  recordIngest(event: IngestEventRecord): void {
    this.ingests.push({ ...event })
  }

  alertExists(orgId: string, fingerprint: string): boolean {
    return this.alerts.has(this.alertKey(orgId, fingerprint))
  }
  recordAlert(alert: AlertRecord): void {
    const key = this.alertKey(alert.orgId, alert.fingerprint)
    if (!this.alerts.has(key)) this.alerts.set(key, { ...alert })
  }
  listAlerts(orgId: string): AlertRecord[] {
    return [...this.alerts.values()].filter((a) => a.orgId === orgId).map((a) => ({ ...a }))
  }

  putEnrollmentCode(orgId: string, codeHash: string, expiresAt: number): void {
    this.codes.set(this.alertKey(orgId, codeHash), expiresAt)
  }
  consumeEnrollmentCode(orgId: string, codeHash: string, now: number): boolean {
    const key = this.alertKey(orgId, codeHash)
    const expiresAt = this.codes.get(key)
    if (expiresAt === undefined) return false
    this.codes.delete(key) // single-use regardless of expiry outcome
    return expiresAt >= now
  }

  close(): void {
    // nothing to release
  }
}
