import { DatabaseSync } from 'node:sqlite'
import type {
  AlertRecord,
  AssetRecord,
  AssetKind,
  AuthKind,
  DeviceAuthRecord,
  DeviceAuthStatus,
  FindingFilter,
  FindingRecord,
  IngestEventRecord,
  InviteRecord,
  OrgRecord,
  Role,
  SessionKind,
  SessionRecord,
  UserRecord,
} from '../model.js'
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
interface UserRow {
  id: string
  org_id: string
  email: string
  password_hash: string
  role: string
  created_at: number
}

interface SessionRow {
  token: string
  user_id: string
  org_id: string
  role: string
  kind: string
  csrf_token: string
  created_at: number
  expires_at: number
  last_seen_at: number
}

interface DeviceAuthRow {
  device_code: string
  user_code: string
  status: string
  user_id: string | null
  org_id: string | null
  role: string | null
  created_at: number
  expires_at: number
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
      CREATE TABLE IF NOT EXISTS oidc_grants (
        org_id TEXT NOT NULL, provider TEXT NOT NULL, subject TEXT NOT NULL,
        PRIMARY KEY (org_id, provider, subject)
      );
      CREATE TABLE IF NOT EXISTS orgs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, webhook_secret TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        role TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invites (
        code TEXT PRIMARY KEY, org_id TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL, used_by TEXT
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL,
        csrf_token TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS login_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS device_auths (
        device_code TEXT PRIMARY KEY, user_code TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
        user_id TEXT, org_id TEXT, role TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
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

  grantOidc(orgId: string, provider: string, subject: string): void {
    this.db.prepare(`INSERT OR IGNORE INTO oidc_grants (org_id, provider, subject) VALUES (?, ?, ?)`).run(orgId, provider, subject)
  }

  isOidcGranted(orgId: string, provider: string, subject: string): boolean {
    return this.db.prepare(`SELECT 1 FROM oidc_grants WHERE org_id = ? AND provider = ? AND subject = ?`).get(orgId, provider, subject) !== undefined
  }


  createOrg(org: OrgRecord): void {
    this.db
      .prepare(`INSERT OR REPLACE INTO orgs (id, name, webhook_secret, created_at) VALUES (?, ?, ?, ?)`)
      .run(org.id, org.name, org.webhookSecret, org.createdAt)
  }
  getOrg(orgId: string): OrgRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM orgs WHERE id = ?`).get(orgId) as unknown as
      | { id: string; name: string; webhook_secret: string; created_at: number }
      | undefined
    return row ? { id: row.id, name: row.name, webhookSecret: row.webhook_secret, createdAt: row.created_at } : undefined
  }

  createUser(user: UserRecord): void {
    this.db
      .prepare(`INSERT INTO users (id, org_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(user.id, user.orgId, user.email, user.passwordHash, user.role, user.createdAt)
  }
  getUserByEmail(email: string): UserRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as unknown as UserRow | undefined
    return row ? this.toUser(row) : undefined
  }
  getUser(orgId: string, userId: string): UserRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM users WHERE org_id = ? AND id = ?`).get(orgId, userId) as unknown as UserRow | undefined
    return row ? this.toUser(row) : undefined
  }
  listUsers(orgId: string): UserRecord[] {
    const rows = this.db.prepare(`SELECT * FROM users WHERE org_id = ? ORDER BY created_at`).all(orgId) as unknown as UserRow[]
    return rows.map((r) => this.toUser(r))
  }

  createInvite(invite: InviteRecord): void {
    this.db
      .prepare(`INSERT OR REPLACE INTO invites (code, org_id, role, expires_at, used_by) VALUES (?, ?, ?, ?, ?)`)
      .run(invite.code, invite.orgId, invite.role, invite.expiresAt, invite.usedBy ?? null)
  }
  consumeInvite(code: string, now: number): InviteRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM invites WHERE code = ?`).get(code) as unknown as
      | { code: string; org_id: string; role: string; expires_at: number; used_by: string | null }
      | undefined
    if (!row) return undefined
    this.db.prepare(`DELETE FROM invites WHERE code = ?`).run(code) // single-use regardless of expiry outcome
    if (row.expires_at < now) return undefined
    return { code: row.code, orgId: row.org_id, role: row.role as Role, expiresAt: row.expires_at, usedBy: row.used_by ?? undefined }
  }

  createSession(session: SessionRecord): void {
    this.db
      .prepare(
        `INSERT INTO sessions (token, user_id, org_id, role, kind, csrf_token, created_at, expires_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.token,
        session.userId,
        session.orgId,
        session.role,
        session.kind,
        session.csrfToken,
        session.createdAt,
        session.expiresAt,
        session.lastSeenAt,
      )
  }
  getSession(token: string): SessionRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token) as unknown as SessionRow | undefined
    return row ? this.toSession(row) : undefined
  }
  deleteSession(token: string): void {
    this.db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
  }
  touchSession(token: string, at: number): void {
    this.db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token = ?`).run(at, token)
  }

  recordLoginFailure(email: string, at: number): void {
    this.db.prepare(`INSERT INTO login_failures (email, at) VALUES (?, ?)`).run(email, at)
  }
  countRecentLoginFailures(email: string, sinceInclusive: number): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM login_failures WHERE email = ? AND at >= ?`).get(email, sinceInclusive) as unknown as {
      n: number
    }
    return row.n
  }

  createDeviceAuth(record: DeviceAuthRecord): void {
    this.db
      .prepare(
        `INSERT INTO device_auths (device_code, user_code, status, user_id, org_id, role, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.deviceCode,
        record.userCode,
        record.status,
        record.userId ?? null,
        record.orgId ?? null,
        record.role ?? null,
        record.createdAt,
        record.expiresAt,
      )
  }
  getDeviceAuthByDeviceCode(deviceCode: string): DeviceAuthRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM device_auths WHERE device_code = ?`).get(deviceCode) as unknown as DeviceAuthRow | undefined
    return row ? this.toDeviceAuth(row) : undefined
  }
  approveDeviceAuthByUserCode(userCode: string, grant: { userId: string; orgId: string; role: Role }, now: number): boolean {
    const row = this.db.prepare(`SELECT * FROM device_auths WHERE user_code = ?`).get(userCode) as unknown as DeviceAuthRow | undefined
    if (!row || row.status !== 'pending' || row.expires_at < now) return false
    this.db
      .prepare(`UPDATE device_auths SET status = 'approved', user_id = ?, org_id = ?, role = ? WHERE user_code = ?`)
      .run(grant.userId, grant.orgId, grant.role, userCode)
    return true
  }
  consumeDeviceAuth(deviceCode: string, now: number): DeviceAuthRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM device_auths WHERE device_code = ?`).get(deviceCode) as unknown as DeviceAuthRow | undefined
    if (!row || row.status !== 'approved' || row.expires_at < now) return undefined
    this.db.prepare(`UPDATE device_auths SET status = 'consumed' WHERE device_code = ?`).run(deviceCode)
    return this.toDeviceAuth(row)
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

  private toUser(r: UserRow): UserRecord {
    return { id: r.id, orgId: r.org_id, email: r.email, passwordHash: r.password_hash, role: r.role as Role, createdAt: r.created_at }
  }

  private toSession(r: SessionRow): SessionRecord {
    return {
      token: r.token,
      userId: r.user_id,
      orgId: r.org_id,
      role: r.role as Role,
      kind: r.kind as SessionKind,
      csrfToken: r.csrf_token,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      lastSeenAt: r.last_seen_at,
    }
  }

  private toDeviceAuth(r: DeviceAuthRow): DeviceAuthRecord {
    return {
      deviceCode: r.device_code,
      userCode: r.user_code,
      status: r.status as DeviceAuthStatus,
      userId: r.user_id ?? undefined,
      orgId: r.org_id ?? undefined,
      role: (r.role as Role | null) ?? undefined,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    }
  }
}
