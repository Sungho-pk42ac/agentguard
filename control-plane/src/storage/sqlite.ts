import { DatabaseSync } from 'node:sqlite'
import type { AlertRecord, AssetRecord, AssetKind, AuthKind, FindingFilter, FindingRecord, IngestEventRecord } from '../model.js'
import type { ReportFinding, Severity } from '../contract.js'
import type { StoragePort, UpsertFindingResult } from './port.js'

// node:sqlite-backed storage (Node >=22). Same semantics as MemoryStorage; the
// acceptance suite runs against both. Use ':memory:' for tests, a file path for
// a durable single-node control plane. PostgresStorage is the production
// horizontal-scale adapter behind the same StoragePort.

interface AssetRow {
  org_id: string
  asset_id: string
  label: string
  kind: string
  auth_kind: string
  secret: string | null
  subject: string | null
  provider: string | null
  last_seen_at: number | null
  created_at: number
}

interface FindingRow {
  org_id: string
  asset_id: string
  rule_id: string
  surface: string
  severity: string
  location: string
  evidence_redacted: string
  fingerprint: string
  first_seen: number
  last_seen: number
  status: string
}

export class SqliteStorage implements StoragePort {
  private readonly db: DatabaseSync

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        org_id TEXT NOT NULL, asset_id TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL,
        auth_kind TEXT NOT NULL, secret TEXT, subject TEXT, provider TEXT,
        last_seen_at INTEGER, created_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, asset_id)
      );
      CREATE TABLE IF NOT EXISTS findings (
        org_id TEXT NOT NULL, asset_id TEXT NOT NULL, rule_id TEXT NOT NULL, surface TEXT NOT NULL,
        severity TEXT NOT NULL, location TEXT NOT NULL, evidence_redacted TEXT NOT NULL,
        fingerprint TEXT NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        PRIMARY KEY (org_id, asset_id, fingerprint)
      );
      CREATE TABLE IF NOT EXISTS alerts (
        org_id TEXT NOT NULL, fingerprint TEXT NOT NULL, severity TEXT NOT NULL,
        fired_at INTEGER NOT NULL, channel TEXT NOT NULL,
        PRIMARY KEY (org_id, fingerprint)
      );
      CREATE TABLE IF NOT EXISTS ingest_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, asset_id TEXT NOT NULL,
        received_at INTEGER NOT NULL, finding_count INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS enrollment_codes (
        org_id TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, code_hash)
      );
    `)
  }

  createAsset(a: AssetRecord): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO assets
         (org_id, asset_id, label, kind, auth_kind, secret, subject, provider, last_seen_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(a.orgId, a.assetId, a.label, a.kind, a.authKind, a.secret ?? null, a.subject ?? null, a.provider ?? null, a.lastSeenAt, a.createdAt)
  }

  getAsset(orgId: string, assetId: string): AssetRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM assets WHERE org_id = ? AND asset_id = ?`).get(orgId, assetId) as unknown as AssetRow | undefined
    return row ? this.toAsset(row) : undefined
  }

  touchAsset(orgId: string, assetId: string, at: number): void {
    this.db.prepare(`UPDATE assets SET last_seen_at = ? WHERE org_id = ? AND asset_id = ?`).run(at, orgId, assetId)
  }

  listAssets(orgId: string): AssetRecord[] {
    const rows = this.db.prepare(`SELECT * FROM assets WHERE org_id = ? ORDER BY asset_id`).all(orgId) as unknown as AssetRow[]
    return rows.map((r) => this.toAsset(r))
  }

  upsertFinding(orgId: string, assetId: string, finding: ReportFinding, at: number): UpsertFindingResult {
    const existing = this.db
      .prepare(`SELECT fingerprint FROM findings WHERE org_id = ? AND asset_id = ? AND fingerprint = ?`)
      .get(orgId, assetId, finding.fingerprint)
    if (existing) {
      this.db
        .prepare(
          `UPDATE findings SET last_seen = ?, severity = ?, location = ?, evidence_redacted = ?, surface = ?, rule_id = ?
           WHERE org_id = ? AND asset_id = ? AND fingerprint = ?`,
        )
        .run(at, finding.severity, finding.location, finding.evidenceRedacted, finding.surface, finding.ruleId, orgId, assetId, finding.fingerprint)
      return { isNew: false }
    }
    this.db
      .prepare(
        `INSERT INTO findings
         (org_id, asset_id, rule_id, surface, severity, location, evidence_redacted, fingerprint, first_seen, last_seen, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      )
      .run(orgId, assetId, finding.ruleId, finding.surface, finding.severity, finding.location, finding.evidenceRedacted, finding.fingerprint, at, at)
    return { isNew: true }
  }

  listFindings(orgId: string, filter: FindingFilter = {}): FindingRecord[] {
    const clauses = ['org_id = ?']
    const params: (string | number)[] = [orgId]
    if (filter.surface) {
      clauses.push('surface = ?')
      params.push(filter.surface)
    }
    if (filter.severity) {
      clauses.push('severity = ?')
      params.push(filter.severity)
    }
    if (filter.assetId) {
      clauses.push('asset_id = ?')
      params.push(filter.assetId)
    }
    const rows = this.db
      .prepare(`SELECT * FROM findings WHERE ${clauses.join(' AND ')} ORDER BY first_seen`)
      .all(...params) as unknown as FindingRow[]
    return rows.map((r) => this.toFinding(r))
  }

  recordIngest(event: IngestEventRecord): void {
    this.db
      .prepare(`INSERT INTO ingest_events (org_id, asset_id, received_at, finding_count) VALUES (?, ?, ?, ?)`)
      .run(event.orgId, event.assetId, event.receivedAt, event.findingCount)
  }

  alertExists(orgId: string, fingerprint: string): boolean {
    return this.db.prepare(`SELECT 1 FROM alerts WHERE org_id = ? AND fingerprint = ?`).get(orgId, fingerprint) !== undefined
  }

  recordAlert(alert: AlertRecord): void {
    this.db
      .prepare(`INSERT OR IGNORE INTO alerts (org_id, fingerprint, severity, fired_at, channel) VALUES (?, ?, ?, ?, ?)`)
      .run(alert.orgId, alert.fingerprint, alert.severity, alert.firedAt, alert.channel)
  }

  listAlerts(orgId: string): AlertRecord[] {
    const rows = this.db.prepare(`SELECT * FROM alerts WHERE org_id = ? ORDER BY fired_at`).all(orgId) as unknown as Array<{
      org_id: string
      fingerprint: string
      severity: string
      fired_at: number
      channel: string
    }>
    return rows.map((r) => ({ orgId: r.org_id, fingerprint: r.fingerprint, severity: r.severity as Severity, firedAt: r.fired_at, channel: r.channel }))
  }

  putEnrollmentCode(orgId: string, codeHash: string, expiresAt: number): void {
    this.db.prepare(`INSERT OR REPLACE INTO enrollment_codes (org_id, code_hash, expires_at) VALUES (?, ?, ?)`).run(orgId, codeHash, expiresAt)
  }

  consumeEnrollmentCode(orgId: string, codeHash: string, now: number): boolean {
    const row = this.db.prepare(`SELECT expires_at FROM enrollment_codes WHERE org_id = ? AND code_hash = ?`).get(orgId, codeHash) as unknown as
      | { expires_at: number }
      | undefined
    if (row === undefined) return false
    this.db.prepare(`DELETE FROM enrollment_codes WHERE org_id = ? AND code_hash = ?`).run(orgId, codeHash)
    return row.expires_at >= now
  }

  close(): void {
    this.db.close()
  }

  private toAsset(r: AssetRow): AssetRecord {
    return {
      orgId: r.org_id,
      assetId: r.asset_id,
      label: r.label,
      kind: r.kind as AssetKind,
      authKind: r.auth_kind as AuthKind,
      secret: r.secret ?? undefined,
      subject: r.subject ?? undefined,
      provider: (r.provider as 'github' | 'gitlab' | null) ?? undefined,
      lastSeenAt: r.last_seen_at,
      createdAt: r.created_at,
    }
  }

  private toFinding(r: FindingRow): FindingRecord {
    return {
      orgId: r.org_id,
      assetId: r.asset_id,
      ruleId: r.rule_id,
      surface: r.surface,
      severity: r.severity as Severity,
      location: r.location,
      evidenceRedacted: r.evidence_redacted,
      fingerprint: r.fingerprint,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      status: r.status as FindingRecord['status'],
    }
  }
}
