import { DatabaseSync } from 'node:sqlite'
import type {
  AlertRecord,
  AssetRecord,
  AssetKind,
  AuthKind,
  CveCacheRecord,
  CveSeverity,
  DeviceAuthRecord,
  DeviceAuthStatus,
  FindingFilter,
  FindingRecord,
  IngestEventRecord,
  InviteRecord,
  McpCatalogEntry,
  OffboardingAuditEntry,
  OffboardingStatus,
  OffboardingTask,
  OrgRecord,
  PolicyExceptionRecord,
  PolicyExceptionStatus,
  PolicyRecord,
  Role,
  SessionKind,
  SessionRecord,
  UserRecord,
} from '../model.js'
import { isLegalOffboardingTransition } from '../model.js'
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
  cve_ids: string | null
  cve_severity: string | null
  advisory: number
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
interface PolicyRow {
  org_id: string
  rules_version: number
  rules: string
  exceptions_version: number
}

interface PolicyExceptionRow {
  id: string
  org_id: string
  rule_id: string
  reason: string
  status: string
  created_at: number
  resolved_at: number | null
}
interface OffboardingRow {
  id: string
  org_id: string
  employee_id: string
  employee_email: string
  employee_name: string
  asset_ids: string
  unmatched: number
  status: string
  effective_at: string
  created_at: number
  updated_at: number
  audit: string
}
interface McpCatalogRow {
  org_id: string
  server_name: string
  approved: number
  risk_tags: string
  note: string | null
  updated_by: string
  updated_at: number
}

export class SqliteStorage implements StoragePort {
  private readonly db: DatabaseSync
  private nextIngestNoncePruneAt = 0

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
        status TEXT NOT NULL DEFAULT 'open', cve_ids TEXT, cve_severity TEXT, advisory INTEGER NOT NULL DEFAULT 0,
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
      CREATE TABLE IF NOT EXISTS ingest_nonces (
        org_id TEXT NOT NULL, asset_id TEXT NOT NULL, nonce TEXT NOT NULL, expires_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, asset_id, nonce)
      );
      CREATE INDEX IF NOT EXISTS ingest_nonces_expires_at_idx ON ingest_nonces (expires_at);
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
      CREATE TABLE IF NOT EXISTS offboarding_tasks (
        id TEXT PRIMARY KEY, org_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_email TEXT NOT NULL,
        employee_name TEXT NOT NULL, asset_ids TEXT NOT NULL, unmatched INTEGER NOT NULL, status TEXT NOT NULL,
        effective_at TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, audit TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_offboarding_key ON offboarding_tasks (org_id, employee_id, effective_at);

      CREATE TABLE IF NOT EXISTS policies (
        org_id TEXT PRIMARY KEY, rules_version INTEGER NOT NULL, rules TEXT NOT NULL, exceptions_version INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS policy_exceptions (
        id TEXT PRIMARY KEY, org_id TEXT NOT NULL, rule_id TEXT NOT NULL, reason TEXT NOT NULL,
        status TEXT NOT NULL, created_at INTEGER NOT NULL, resolved_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS cve_cache (
        ecosystem TEXT NOT NULL, package TEXT NOT NULL, version TEXT NOT NULL,
        vuln_ids TEXT NOT NULL, details TEXT NOT NULL, fetched_at INTEGER NOT NULL, status TEXT NOT NULL,
        PRIMARY KEY (ecosystem, package, version)
      );
      CREATE TABLE IF NOT EXISTS mcp_catalog (
        org_id TEXT NOT NULL, server_name TEXT NOT NULL, approved INTEGER NOT NULL, risk_tags TEXT NOT NULL,
        note TEXT, updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (org_id, server_name)
      );
      CREATE TABLE IF NOT EXISTS org_settings (
        org_id TEXT PRIMARY KEY, mcp_strict_mode INTEGER NOT NULL DEFAULT 0
      );
    `)
  }

  async createAsset(a: AssetRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO assets
         (org_id, asset_id, label, kind, auth_kind, secret, subject, provider, last_seen_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(a.orgId, a.assetId, a.label, a.kind, a.authKind, a.secret ?? null, a.subject ?? null, a.provider ?? null, a.lastSeenAt, a.createdAt)
  }

  async getAsset(orgId: string, assetId: string): Promise<AssetRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM assets WHERE org_id = ? AND asset_id = ?`).get(orgId, assetId) as unknown as AssetRow | undefined
    return row ? this.toAsset(row) : undefined
  }

  async touchAsset(orgId: string, assetId: string, at: number): Promise<void> {
    this.db.prepare(`UPDATE assets SET last_seen_at = ? WHERE org_id = ? AND asset_id = ?`).run(at, orgId, assetId)
  }

  async listAssets(orgId: string): Promise<AssetRecord[]> {
    const rows = this.db.prepare(`SELECT * FROM assets WHERE org_id = ? ORDER BY asset_id`).all(orgId) as unknown as AssetRow[]
    return rows.map((r) => this.toAsset(r))
  }

  async upsertFinding(orgId: string, assetId: string, finding: ReportFinding, at: number): Promise<UpsertFindingResult> {
    const existing = this.db
      .prepare(`SELECT fingerprint FROM findings WHERE org_id = ? AND asset_id = ? AND fingerprint = ?`)
      .get(orgId, assetId, finding.fingerprint)
    if (existing) {
      this.db
        .prepare(
          `UPDATE findings SET last_seen = ?, severity = ?, location = ?, evidence_redacted = ?, surface = ?, rule_id = ?, advisory = ?
           WHERE org_id = ? AND asset_id = ? AND fingerprint = ?`,
        )
        .run(
          at,
          finding.severity,
          finding.location,
          finding.evidenceRedacted,
          finding.surface,
          finding.ruleId,
          finding.advisory ? 1 : 0,
          orgId,
          assetId,
          finding.fingerprint,
        )
      return { isNew: false }
    }
    this.db
      .prepare(
        `INSERT INTO findings
         (org_id, asset_id, rule_id, surface, severity, location, evidence_redacted, fingerprint, first_seen, last_seen, status, cve_ids, cve_severity, advisory)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?)`,
      )
      .run(
        orgId,
        assetId,
        finding.ruleId,
        finding.surface,
        finding.severity,
        finding.location,
        finding.evidenceRedacted,
        finding.fingerprint,
        at,
        at,
        finding.advisory ? 1 : 0,
      )
    return { isNew: true }
  }

  async listFindings(orgId: string, filter: FindingFilter = {}): Promise<FindingRecord[]> {
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

  async recordIngest(event: IngestEventRecord): Promise<void> {
    this.db
      .prepare(`INSERT INTO ingest_events (org_id, asset_id, received_at, finding_count) VALUES (?, ?, ?, ?)`)
      .run(event.orgId, event.assetId, event.receivedAt, event.findingCount)
  }

  async consumeIngestNonce(orgId: string, assetId: string, nonce: string, expiresAt: number, now: number): Promise<boolean> {
    if (now >= this.nextIngestNoncePruneAt) {
      this.nextIngestNoncePruneAt = now + 60_000
      this.db.prepare(`DELETE FROM ingest_nonces WHERE expires_at <= ?`).run(now)
    }
    this.db.prepare(`DELETE FROM ingest_nonces WHERE org_id = ? AND asset_id = ? AND nonce = ? AND expires_at <= ?`).run(orgId, assetId, nonce, now)
    const result = this.db
      .prepare(`INSERT OR IGNORE INTO ingest_nonces (org_id, asset_id, nonce, expires_at) VALUES (?, ?, ?, ?)`)
      .run(orgId, assetId, nonce, expiresAt) as unknown as { changes?: number }
    return (result.changes ?? 0) > 0
  }

  async alertExists(orgId: string, fingerprint: string): Promise<boolean> {
    return this.db.prepare(`SELECT 1 FROM alerts WHERE org_id = ? AND fingerprint = ?`).get(orgId, fingerprint) !== undefined
  }

  async recordAlert(alert: AlertRecord): Promise<void> {
    this.db
      .prepare(`INSERT OR IGNORE INTO alerts (org_id, fingerprint, severity, fired_at, channel) VALUES (?, ?, ?, ?, ?)`)
      .run(alert.orgId, alert.fingerprint, alert.severity, alert.firedAt, alert.channel)
  }

  async listAlerts(orgId: string): Promise<AlertRecord[]> {
    const rows = this.db.prepare(`SELECT * FROM alerts WHERE org_id = ? ORDER BY fired_at`).all(orgId) as unknown as Array<{
      org_id: string
      fingerprint: string
      severity: string
      fired_at: number
      channel: string
    }>
    return rows.map((r) => ({ orgId: r.org_id, fingerprint: r.fingerprint, severity: r.severity as Severity, firedAt: r.fired_at, channel: r.channel }))
  }

  async putEnrollmentCode(orgId: string, codeHash: string, expiresAt: number): Promise<void> {
    this.db.prepare(`INSERT OR REPLACE INTO enrollment_codes (org_id, code_hash, expires_at) VALUES (?, ?, ?)`).run(orgId, codeHash, expiresAt)
  }

  async consumeEnrollmentCode(orgId: string, codeHash: string, now: number): Promise<boolean> {
    const row = this.db.prepare(`SELECT expires_at FROM enrollment_codes WHERE org_id = ? AND code_hash = ?`).get(orgId, codeHash) as unknown as
      | { expires_at: number }
      | undefined
    if (row === undefined) return false
    this.db.prepare(`DELETE FROM enrollment_codes WHERE org_id = ? AND code_hash = ?`).run(orgId, codeHash)
    return row.expires_at >= now
  }

  async grantOidc(orgId: string, provider: string, subject: string): Promise<void> {
    this.db.prepare(`INSERT OR IGNORE INTO oidc_grants (org_id, provider, subject) VALUES (?, ?, ?)`).run(orgId, provider, subject)
  }

  async isOidcGranted(orgId: string, provider: string, subject: string): Promise<boolean> {
    return this.db.prepare(`SELECT 1 FROM oidc_grants WHERE org_id = ? AND provider = ? AND subject = ?`).get(orgId, provider, subject) !== undefined
  }


  async createOrg(org: OrgRecord): Promise<void> {
    this.db
      .prepare(`INSERT OR REPLACE INTO orgs (id, name, webhook_secret, created_at) VALUES (?, ?, ?, ?)`)
      .run(org.id, org.name, org.webhookSecret, org.createdAt)
  }
  async getOrg(orgId: string): Promise<OrgRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM orgs WHERE id = ?`).get(orgId) as unknown as
      | { id: string; name: string; webhook_secret: string; created_at: number }
      | undefined
    return row ? { id: row.id, name: row.name, webhookSecret: row.webhook_secret, createdAt: row.created_at } : undefined
  }

  async createUser(user: UserRecord): Promise<void> {
    this.db
      .prepare(`INSERT INTO users (id, org_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(user.id, user.orgId, user.email, user.passwordHash, user.role, user.createdAt)
  }
  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as unknown as UserRow | undefined
    return row ? this.toUser(row) : undefined
  }
  async getUser(orgId: string, userId: string): Promise<UserRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM users WHERE org_id = ? AND id = ?`).get(orgId, userId) as unknown as UserRow | undefined
    return row ? this.toUser(row) : undefined
  }
  async listUsers(orgId: string): Promise<UserRecord[]> {
    const rows = this.db.prepare(`SELECT * FROM users WHERE org_id = ? ORDER BY created_at`).all(orgId) as unknown as UserRow[]
    return rows.map((r) => this.toUser(r))
  }

  async createInvite(invite: InviteRecord): Promise<void> {
    this.db
      .prepare(`INSERT OR REPLACE INTO invites (code, org_id, role, expires_at, used_by) VALUES (?, ?, ?, ?, ?)`)
      .run(invite.code, invite.orgId, invite.role, invite.expiresAt, invite.usedBy ?? null)
  }
  async consumeInvite(code: string, now: number): Promise<InviteRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM invites WHERE code = ?`).get(code) as unknown as
      | { code: string; org_id: string; role: string; expires_at: number; used_by: string | null }
      | undefined
    if (!row) return undefined
    this.db.prepare(`DELETE FROM invites WHERE code = ?`).run(code) // single-use regardless of expiry outcome
    if (row.expires_at < now) return undefined
    return { code: row.code, orgId: row.org_id, role: row.role as Role, expiresAt: row.expires_at, usedBy: row.used_by ?? undefined }
  }

  async createSession(session: SessionRecord): Promise<void> {
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
  async getSession(token: string): Promise<SessionRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token) as unknown as SessionRow | undefined
    return row ? this.toSession(row) : undefined
  }
  async deleteSession(token: string): Promise<void> {
    this.db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token)
  }
  async touchSession(token: string, at: number): Promise<void> {
    this.db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token = ?`).run(at, token)
  }

  async recordLoginFailure(email: string, at: number): Promise<void> {
    this.db.prepare(`INSERT INTO login_failures (email, at) VALUES (?, ?)`).run(email, at)
  }
  async countRecentLoginFailures(email: string, sinceInclusive: number): Promise<number> {
    const row = this.db.prepare(`SELECT COUNT(*) AS n FROM login_failures WHERE email = ? AND at >= ?`).get(email, sinceInclusive) as unknown as {
      n: number
    }
    return row.n
  }

  async createDeviceAuth(record: DeviceAuthRecord): Promise<void> {
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
  async getDeviceAuthByDeviceCode(deviceCode: string): Promise<DeviceAuthRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM device_auths WHERE device_code = ?`).get(deviceCode) as unknown as DeviceAuthRow | undefined
    return row ? this.toDeviceAuth(row) : undefined
  }
  async approveDeviceAuthByUserCode(userCode: string, grant: { userId: string; orgId: string; role: Role }, now: number): Promise<boolean> {
    const row = this.db.prepare(`SELECT * FROM device_auths WHERE user_code = ?`).get(userCode) as unknown as DeviceAuthRow | undefined
    if (!row || row.status !== 'pending' || row.expires_at < now) return false
    this.db
      .prepare(`UPDATE device_auths SET status = 'approved', user_id = ?, org_id = ?, role = ? WHERE user_code = ?`)
      .run(grant.userId, grant.orgId, grant.role, userCode)
    return true
  }
  async consumeDeviceAuth(deviceCode: string, now: number): Promise<DeviceAuthRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM device_auths WHERE device_code = ?`).get(deviceCode) as unknown as DeviceAuthRow | undefined
    if (!row || row.status !== 'approved' || row.expires_at < now) return undefined
    this.db.prepare(`UPDATE device_auths SET status = 'consumed' WHERE device_code = ?`).run(deviceCode)
    // Memory parity: the returned record reflects the post-update state.
    return { ...this.toDeviceAuth(row), status: 'consumed' }
  }
  async createOffboardingTask(task: OffboardingTask): Promise<{ task: OffboardingTask; created: boolean }> {
    const info = this.db
      .prepare(
        `INSERT OR IGNORE INTO offboarding_tasks
         (id, org_id, employee_id, employee_email, employee_name, asset_ids, unmatched, status, effective_at, created_at, updated_at, audit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.orgId,
        task.employee.id,
        task.employee.email,
        task.employee.name,
        JSON.stringify(task.assetIds),
        task.unmatched ? 1 : 0,
        task.status,
        task.effectiveAt,
        task.createdAt,
        task.updatedAt,
        JSON.stringify(task.audit),
      )
    if (info.changes === 0) {
      // idempotency key collision: the unique (org_id, employee_id, effective_at)
      // index rejected the insert — return the EXISTING task, never a duplicate.
      const row = this.db
        .prepare(`SELECT * FROM offboarding_tasks WHERE org_id = ? AND employee_id = ? AND effective_at = ?`)
        .get(task.orgId, task.employee.id, task.effectiveAt) as unknown as OffboardingRow
      return { task: this.toOffboarding(row), created: false }
    }
    return {
      task: { ...task, employee: { ...task.employee }, assetIds: [...task.assetIds], audit: task.audit.map((a) => ({ ...a })) },
      created: true,
    }
  }
  async getOffboardingTask(orgId: string, id: string): Promise<OffboardingTask | undefined> {
    const row = this.db.prepare(`SELECT * FROM offboarding_tasks WHERE org_id = ? AND id = ?`).get(orgId, id) as unknown as OffboardingRow | undefined
    return row ? this.toOffboarding(row) : undefined
  }
  async listOffboardingTasks(orgId: string): Promise<OffboardingTask[]> {
    const rows = this.db.prepare(`SELECT * FROM offboarding_tasks WHERE org_id = ? ORDER BY created_at`).all(orgId) as unknown as OffboardingRow[]
    return rows.map((r) => this.toOffboarding(r))
  }
  async transitionOffboardingTask(
    orgId: string,
    id: string,
    to: OffboardingStatus,
    actor: string,
    at: number,
  ): Promise<{ ok: true; task: OffboardingTask } | { ok: false; reason: 'not_found' | 'invalid_transition' }> {
    const row = this.db.prepare(`SELECT * FROM offboarding_tasks WHERE org_id = ? AND id = ?`).get(orgId, id) as unknown as OffboardingRow | undefined
    if (!row) return { ok: false, reason: 'not_found' }
    const current = this.toOffboarding(row)
    if (!isLegalOffboardingTransition(current.status, to)) return { ok: false, reason: 'invalid_transition' }
    const audit = [...current.audit, { at, from: current.status, to, actor }]
    this.db
      .prepare(`UPDATE offboarding_tasks SET status = ?, updated_at = ?, audit = ? WHERE org_id = ? AND id = ?`)
      .run(to, at, JSON.stringify(audit), orgId, id)
    return { ok: true, task: { ...current, status: to, updatedAt: at, audit } }
  }
  async getPolicy(orgId: string): Promise<PolicyRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM policies WHERE org_id = ?`).get(orgId) as unknown as PolicyRow | undefined
    return row ? this.toPolicy(row) : undefined
  }
  async putPolicyRules(orgId: string, rules: string): Promise<PolicyRecord> {
    const existing = this.db.prepare(`SELECT rules_version, exceptions_version FROM policies WHERE org_id = ?`).get(orgId) as unknown as
      | { rules_version: number; exceptions_version: number }
      | undefined
    const rulesVersion = (existing?.rules_version ?? 0) + 1
    const exceptionsVersion = existing?.exceptions_version ?? 0
    this.db
      .prepare(`INSERT OR REPLACE INTO policies (org_id, rules_version, rules, exceptions_version) VALUES (?, ?, ?, ?)`)
      .run(orgId, rulesVersion, rules, exceptionsVersion)
    return { orgId, rulesVersion, rules, exceptionsVersion }
  }
  async listExceptions(orgId: string): Promise<PolicyExceptionRecord[]> {
    const rows = this.db.prepare(`SELECT * FROM policy_exceptions WHERE org_id = ? ORDER BY created_at`).all(orgId) as unknown as PolicyExceptionRow[]
    return rows.map((r) => this.toException(r))
  }
  async createException(record: PolicyExceptionRecord): Promise<void> {
    this.db
      .prepare(`INSERT INTO policy_exceptions (id, org_id, rule_id, reason, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(record.id, record.orgId, record.ruleId, record.reason, record.status, record.createdAt, record.resolvedAt ?? null)
  }
  async resolveException(orgId: string, id: string, status: Exclude<PolicyExceptionStatus, 'pending'>, now: number): Promise<PolicyExceptionRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM policy_exceptions WHERE id = ? AND org_id = ?`).get(id, orgId) as unknown as PolicyExceptionRow | undefined
    if (!row || row.status !== 'pending') return undefined
    this.db.prepare(`UPDATE policy_exceptions SET status = ?, resolved_at = ? WHERE id = ?`).run(status, now, id)
    const existing = this.db.prepare(`SELECT rules_version, rules, exceptions_version FROM policies WHERE org_id = ?`).get(orgId) as unknown as
      | { rules_version: number; rules: string; exceptions_version: number }
      | undefined
    this.db
      .prepare(`INSERT OR REPLACE INTO policies (org_id, rules_version, rules, exceptions_version) VALUES (?, ?, ?, ?)`)
      .run(orgId, existing?.rules_version ?? 0, existing?.rules ?? '', (existing?.exceptions_version ?? 0) + 1)
    return { ...this.toException(row), status, resolvedAt: now }
  }

  async getCveCache(ecosystem: string, pkg: string, version: string): Promise<CveCacheRecord | undefined> {
    const row = this.db.prepare(`SELECT * FROM cve_cache WHERE ecosystem = ? AND package = ? AND version = ?`).get(ecosystem, pkg, version) as unknown as
      | { ecosystem: string; package: string; version: string; vuln_ids: string; details: string; fetched_at: number; status: string }
      | undefined
    if (!row) return undefined
    return {
      vulnIds: JSON.parse(row.vuln_ids) as string[],
      details: JSON.parse(row.details) as CveCacheRecord['details'],
      fetchedAt: row.fetched_at,
      status: row.status as CveCacheRecord['status'],
    }
  }
  async putCveCache(ecosystem: string, pkg: string, version: string, record: CveCacheRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cve_cache (ecosystem, package, version, vuln_ids, details, fetched_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(ecosystem, pkg, version, JSON.stringify(record.vulnIds), JSON.stringify(record.details), record.fetchedAt, record.status)
  }
  async updateFindingCve(orgId: string, assetId: string, fingerprint: string, cveIds: string[], cveSeverity: CveSeverity): Promise<void> {
    this.db
      .prepare(`UPDATE findings SET cve_ids = ?, cve_severity = ? WHERE org_id = ? AND asset_id = ? AND fingerprint = ?`)
      .run(JSON.stringify(cveIds), cveSeverity, orgId, assetId, fingerprint)
  }
  async close(): Promise<void> {
    this.db.close()
  }

  async getMcpCatalog(orgId: string): Promise<McpCatalogEntry[]> {
    const rows = this.db.prepare(`SELECT * FROM mcp_catalog WHERE org_id = ? ORDER BY server_name`).all(orgId) as unknown as McpCatalogRow[]
    return rows.map((r) => this.toMcpCatalogEntry(r))
  }
  async putMcpCatalog(orgId: string, entries: McpCatalogEntry[]): Promise<void> {
    this.db.prepare(`DELETE FROM mcp_catalog WHERE org_id = ?`).run(orgId)
    for (const e of entries) {
      this.db
        .prepare(
          `INSERT INTO mcp_catalog (org_id, server_name, approved, risk_tags, note, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(orgId, e.serverName, e.approved ? 1 : 0, JSON.stringify(e.riskTags), e.note ?? null, e.updatedBy, e.updatedAt)
    }
  }
  async getMcpStrictMode(orgId: string): Promise<boolean> {
    const row = this.db.prepare(`SELECT mcp_strict_mode FROM org_settings WHERE org_id = ?`).get(orgId) as unknown as
      | { mcp_strict_mode: number }
      | undefined
    return row ? row.mcp_strict_mode === 1 : false
  }
  async setMcpStrictMode(orgId: string, value: boolean): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO org_settings (org_id, mcp_strict_mode) VALUES (?, ?)
         ON CONFLICT(org_id) DO UPDATE SET mcp_strict_mode = excluded.mcp_strict_mode`,
      )
      .run(orgId, value ? 1 : 0)
  }
  private toMcpCatalogEntry(r: McpCatalogRow): McpCatalogEntry {
    return {
      orgId: r.org_id,
      serverName: r.server_name,
      approved: r.approved === 1,
      riskTags: JSON.parse(r.risk_tags) as string[],
      note: r.note ?? undefined,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
    }
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
      cveIds: r.cve_ids ? (JSON.parse(r.cve_ids) as string[]) : undefined,
      cveSeverity: (r.cve_severity as CveSeverity | null) ?? undefined,
      advisory: r.advisory === 1,
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
  private toOffboarding(r: OffboardingRow): OffboardingTask {
    return {
      id: r.id,
      orgId: r.org_id,
      employee: { id: r.employee_id, email: r.employee_email, name: r.employee_name },
      assetIds: JSON.parse(r.asset_ids) as string[],
      unmatched: r.unmatched === 1,
      status: r.status as OffboardingStatus,
      effectiveAt: r.effective_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      audit: JSON.parse(r.audit) as OffboardingAuditEntry[],
    }
  }
  private toPolicy(r: PolicyRow): PolicyRecord {
    return { orgId: r.org_id, rulesVersion: r.rules_version, rules: r.rules, exceptionsVersion: r.exceptions_version }
  }
  private toException(r: PolicyExceptionRow): PolicyExceptionRecord {
    return {
      id: r.id,
      orgId: r.org_id,
      ruleId: r.rule_id,
      reason: r.reason,
      status: r.status as PolicyExceptionStatus,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at ?? undefined,
    }
  }
}
