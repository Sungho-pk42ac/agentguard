import type {
  AlertRecord,
  AssetKind,
  AssetRecord,
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

// Postgres-backed storage (production, self-hosted M5 topology). Same
// semantics as MemoryStorage/SqliteStorage; the async contract suite
// (test/storage.test.ts + test/postgres.test.ts) runs the identical parametric
// acceptance battery against all three. Unlike the two sync, single-process
// adapters, this one talks to a real network database, so EVERY StoragePort
// method here issues a real async round trip — there is no honest way to make
// a networked Postgres client look synchronous, which is why StoragePort
// itself became async (see storage/port.ts).
//
// Driver injection: control-plane keeps its RUNTIME dependency surface to
// Node built-ins + zod. `pg` is NOT a hard dependency. Production wiring is
// expected to construct a real `pg` `Pool` (the `node-postgres` package) and
// pass it in — `Pool#query` already satisfies `PgQueryable` structurally, so
// `new PostgresStorage({ query: pool.query.bind(pool) })` (or simply
// `new PostgresStorage(pool)`) works with zero adapter code. Tests instead
// inject an in-memory pg-mem `Pool`, which implements the same async
// `query(text, params)` shape without touching a real network socket.

export interface PgQueryResult<T> {
  readonly rows: T[]
  readonly rowCount?: number | null
}

export interface PgQueryable {
  query<T = unknown>(text: string, params?: unknown[]): Promise<PgQueryResult<T>>
}

// ── DDL ──────────────────────────────────────────────────────────────────
//
// Two schemas, mirroring the least-privilege split expected in the self-host
// Compose topology (docs/self-hosting.md):
//   - `auth`:     orgs, users, invites, sessions, login_failures,
//                 device_auths, enrollment_codes, oidc_grants.
//   - `findings`: assets, findings, alerts, ingest_events, policies,
//                 policy_exceptions, offboarding_tasks, mcp_catalog,
//                 org_settings, cve_cache (the sole non-org-scoped table).
//
// The `agentguard_api` application role is granted ONLY the DML it needs on
// each schema (SELECT/INSERT/UPDATE/DELETE — never DDL, never superuser, no
// ownership) so a compromised API process cannot alter schema or escalate.
// MemoryStorage and SqliteStorage are single-store, single-process adapters
// with no separate database role to grant — the split below is a Postgres-only
// concern and is a documented no-op for the other two adapters (asserted in
// test/postgres.test.ts).

export const AUTH_SCHEMA_DDL = `
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.orgs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, webhook_secret TEXT NOT NULL, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth.users (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL, created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth.invites (
  code TEXT PRIMARY KEY, org_id TEXT NOT NULL, role TEXT NOT NULL, expires_at BIGINT NOT NULL, used_by TEXT
);
CREATE TABLE IF NOT EXISTS auth.sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL,
  csrf_token TEXT NOT NULL, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, last_seen_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth.login_failures (
  id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth.device_auths (
  device_code TEXT PRIMARY KEY, user_code TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
  user_id TEXT, org_id TEXT, role TEXT, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth.enrollment_codes (
  org_id TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at BIGINT NOT NULL,
  PRIMARY KEY (org_id, code_hash)
);
CREATE TABLE IF NOT EXISTS auth.oidc_grants (
  org_id TEXT NOT NULL, provider TEXT NOT NULL, subject TEXT NOT NULL,
  PRIMARY KEY (org_id, provider, subject)
);
`

export const FINDINGS_SCHEMA_DDL = `
CREATE SCHEMA IF NOT EXISTS findings;

CREATE TABLE IF NOT EXISTS findings.assets (
  org_id TEXT NOT NULL, asset_id TEXT NOT NULL, label TEXT NOT NULL, kind TEXT NOT NULL,
  auth_kind TEXT NOT NULL, secret TEXT, subject TEXT, provider TEXT,
  last_seen_at BIGINT, created_at BIGINT NOT NULL,
  PRIMARY KEY (org_id, asset_id)
);
CREATE TABLE IF NOT EXISTS findings.findings (
  org_id TEXT NOT NULL, asset_id TEXT NOT NULL, rule_id TEXT NOT NULL, surface TEXT NOT NULL,
  severity TEXT NOT NULL, location TEXT NOT NULL, evidence_redacted TEXT NOT NULL,
  fingerprint TEXT NOT NULL, first_seen BIGINT NOT NULL, last_seen BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', cve_ids TEXT, cve_severity TEXT, advisory BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (org_id, asset_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS findings.alerts (
  org_id TEXT NOT NULL, fingerprint TEXT NOT NULL, severity TEXT NOT NULL,
  fired_at BIGINT NOT NULL, channel TEXT NOT NULL,
  PRIMARY KEY (org_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS findings.ingest_events (
  id BIGSERIAL PRIMARY KEY, org_id TEXT NOT NULL, asset_id TEXT NOT NULL,
  received_at BIGINT NOT NULL, finding_count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS findings.ingest_nonces (
  org_id TEXT NOT NULL, asset_id TEXT NOT NULL, nonce TEXT NOT NULL, expires_at BIGINT NOT NULL,
  PRIMARY KEY (org_id, asset_id, nonce)
);
CREATE INDEX IF NOT EXISTS ingest_nonces_expires_at_idx ON findings.ingest_nonces (expires_at);
CREATE TABLE IF NOT EXISTS findings.policies (
  org_id TEXT PRIMARY KEY, rules_version INTEGER NOT NULL, rules TEXT NOT NULL, exceptions_version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS findings.policy_exceptions (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, rule_id TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL, created_at BIGINT NOT NULL, resolved_at BIGINT
);
CREATE TABLE IF NOT EXISTS findings.offboarding_tasks (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_email TEXT NOT NULL,
  employee_name TEXT NOT NULL, asset_ids TEXT NOT NULL, unmatched BOOLEAN NOT NULL, status TEXT NOT NULL,
  effective_at TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, audit TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offboarding_key ON findings.offboarding_tasks (org_id, employee_id, effective_at);
CREATE TABLE IF NOT EXISTS findings.mcp_catalog (
  org_id TEXT NOT NULL, server_name TEXT NOT NULL, approved BOOLEAN NOT NULL, risk_tags TEXT NOT NULL,
  note TEXT, updated_by TEXT NOT NULL, updated_at BIGINT NOT NULL,
  PRIMARY KEY (org_id, server_name)
);
CREATE TABLE IF NOT EXISTS findings.org_settings (
  org_id TEXT PRIMARY KEY, mcp_strict_mode BOOLEAN NOT NULL DEFAULT FALSE
);
-- The sole intentionally-global (non-org-scoped) table: no org_id column.
-- See storage/port.ts StoragePort.getCveCache/putCveCache for the rationale.
CREATE TABLE IF NOT EXISTS findings.cve_cache (
  ecosystem TEXT NOT NULL, package TEXT NOT NULL, version TEXT NOT NULL,
  vuln_ids TEXT NOT NULL, details TEXT NOT NULL, fetched_at BIGINT NOT NULL, status TEXT NOT NULL,
  PRIMARY KEY (ecosystem, package, version)
);
`

// Least-privilege grants for the application role. Run once by an admin/owner
// role during provisioning (NOT by the API process itself). `agentguard_api`
// gets exactly the DML each schema's tables require and nothing else: no
// CREATE/DROP/ALTER, no ownership, no access to any other schema.
export const ROLE_GRANTS_DDL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agentguard_api') THEN
    CREATE ROLE agentguard_api LOGIN PASSWORD 'change-me';
  END IF;
END $$;

GRANT USAGE ON SCHEMA auth, findings TO agentguard_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO agentguard_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA findings TO agentguard_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth, findings TO agentguard_api;
`

export class PostgresStorage implements StoragePort {
  private nextIngestNoncePruneAt = 0

  constructor(private readonly db: PgQueryable) {}

  /** Idempotent: creates both schemas + all tables if they do not exist yet. */
  async migrate(): Promise<void> {
    await this.db.query(AUTH_SCHEMA_DDL)
    await this.db.query(FINDINGS_SCHEMA_DDL)
  }

  private async one<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
    const { rows } = await this.db.query<T>(text, params)
    return rows[0]
  }
  private async many<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const { rows } = await this.db.query<T>(text, params)
    return rows
  }
  private async exec(text: string, params: unknown[] = []): Promise<void> {
    await this.db.query(text, params)
  }

  // ── assets ──
  async createAsset(a: AssetRecord): Promise<void> {
    await this.exec(
      `INSERT INTO findings.assets (org_id, asset_id, label, kind, auth_kind, secret, subject, provider, last_seen_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (org_id, asset_id) DO UPDATE SET
         label = excluded.label, kind = excluded.kind, auth_kind = excluded.auth_kind, secret = excluded.secret,
         subject = excluded.subject, provider = excluded.provider, last_seen_at = excluded.last_seen_at, created_at = excluded.created_at`,
      [a.orgId, a.assetId, a.label, a.kind, a.authKind, a.secret ?? null, a.subject ?? null, a.provider ?? null, a.lastSeenAt, a.createdAt],
    )
  }
  async getAsset(orgId: string, assetId: string): Promise<AssetRecord | undefined> {
    const row = await this.one<AssetRow>(`SELECT * FROM findings.assets WHERE org_id = $1 AND asset_id = $2`, [orgId, assetId])
    return row ? toAsset(row) : undefined
  }
  async touchAsset(orgId: string, assetId: string, at: number): Promise<void> {
    await this.exec(`UPDATE findings.assets SET last_seen_at = $1 WHERE org_id = $2 AND asset_id = $3`, [at, orgId, assetId])
  }
  async listAssets(orgId: string): Promise<AssetRecord[]> {
    const rows = await this.many<AssetRow>(`SELECT * FROM findings.assets WHERE org_id = $1 ORDER BY asset_id`, [orgId])
    return rows.map(toAsset)
  }

  // ── findings ──
  async upsertFinding(orgId: string, assetId: string, finding: ReportFinding, at: number): Promise<UpsertFindingResult> {
    const existing = await this.one<{ fingerprint: string }>(
      `SELECT fingerprint FROM findings.findings WHERE org_id = $1 AND asset_id = $2 AND fingerprint = $3`,
      [orgId, assetId, finding.fingerprint],
    )
    if (existing) {
      await this.exec(
        `UPDATE findings.findings SET last_seen = $1, severity = $2, location = $3, evidence_redacted = $4, surface = $5, rule_id = $6, advisory = $7
         WHERE org_id = $8 AND asset_id = $9 AND fingerprint = $10`,
        [at, finding.severity, finding.location, finding.evidenceRedacted, finding.surface, finding.ruleId, finding.advisory ?? false, orgId, assetId, finding.fingerprint],
      )
      return { isNew: false }
    }
    await this.exec(
      `INSERT INTO findings.findings
       (org_id, asset_id, rule_id, surface, severity, location, evidence_redacted, fingerprint, first_seen, last_seen, status, cve_ids, cve_severity, advisory)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',NULL,NULL,$11)`,
      [orgId, assetId, finding.ruleId, finding.surface, finding.severity, finding.location, finding.evidenceRedacted, finding.fingerprint, at, at, finding.advisory ?? false],
    )
    return { isNew: true }
  }
  async listFindings(orgId: string, filter: FindingFilter = {}): Promise<FindingRecord[]> {
    const clauses = ['org_id = $1']
    const params: unknown[] = [orgId]
    if (filter.surface) {
      params.push(filter.surface)
      clauses.push(`surface = $${params.length}`)
    }
    if (filter.severity) {
      params.push(filter.severity)
      clauses.push(`severity = $${params.length}`)
    }
    if (filter.assetId) {
      params.push(filter.assetId)
      clauses.push(`asset_id = $${params.length}`)
    }
    const rows = await this.many<FindingRow>(`SELECT * FROM findings.findings WHERE ${clauses.join(' AND ')} ORDER BY first_seen`, params)
    return rows.map(toFinding)
  }

  // ── ingest audit ──
  async recordIngest(event: IngestEventRecord): Promise<void> {
    await this.exec(`INSERT INTO findings.ingest_events (org_id, asset_id, received_at, finding_count) VALUES ($1,$2,$3,$4)`, [
      event.orgId,
      event.assetId,
      event.receivedAt,
      event.findingCount,
    ])
  }

  async consumeIngestNonce(orgId: string, assetId: string, nonce: string, expiresAt: number, now: number): Promise<boolean> {
    if (now >= this.nextIngestNoncePruneAt) {
      this.nextIngestNoncePruneAt = now + 60_000
      await this.exec(`DELETE FROM findings.ingest_nonces WHERE expires_at <= $1`, [now])
    }
    await this.exec(
      `DELETE FROM findings.ingest_nonces WHERE org_id = $1 AND asset_id = $2 AND nonce = $3 AND expires_at <= $4`,
      [orgId, assetId, nonce, now],
    )
    try {
      await this.exec(
        `INSERT INTO findings.ingest_nonces (org_id, asset_id, nonce, expires_at) VALUES ($1,$2,$3,$4)`,
        [orgId, assetId, nonce, expiresAt],
      )
      return true
    } catch (error) {
      const err = error as { code?: string; message?: string }
      if (err.code === '23505' || /duplicate|unique/i.test(err.message ?? '')) return false
      throw error
    }
  }

  // ── alerts ──
  async alertExists(orgId: string, fingerprint: string): Promise<boolean> {
    const row = await this.one(`SELECT 1 FROM findings.alerts WHERE org_id = $1 AND fingerprint = $2`, [orgId, fingerprint])
    return row !== undefined
  }
  async recordAlert(alert: AlertRecord): Promise<void> {
    await this.exec(
      `INSERT INTO findings.alerts (org_id, fingerprint, severity, fired_at, channel) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (org_id, fingerprint) DO NOTHING`,
      [alert.orgId, alert.fingerprint, alert.severity, alert.firedAt, alert.channel],
    )
  }
  async listAlerts(orgId: string): Promise<AlertRecord[]> {
    const rows = await this.many<{ org_id: string; fingerprint: string; severity: string; fired_at: number; channel: string }>(
      `SELECT * FROM findings.alerts WHERE org_id = $1 ORDER BY fired_at`,
      [orgId],
    )
    return rows.map((r) => ({ orgId: r.org_id, fingerprint: r.fingerprint, severity: r.severity as Severity, firedAt: Number(r.fired_at), channel: r.channel }))
  }

  // ── enrollment codes ──
  async putEnrollmentCode(orgId: string, codeHash: string, expiresAt: number): Promise<void> {
    await this.exec(
      `INSERT INTO auth.enrollment_codes (org_id, code_hash, expires_at) VALUES ($1,$2,$3)
       ON CONFLICT (org_id, code_hash) DO UPDATE SET expires_at = excluded.expires_at`,
      [orgId, codeHash, expiresAt],
    )
  }
  async consumeEnrollmentCode(orgId: string, codeHash: string, now: number): Promise<boolean> {
    const row = await this.one<{ expires_at: number }>(`SELECT expires_at FROM auth.enrollment_codes WHERE org_id = $1 AND code_hash = $2`, [
      orgId,
      codeHash,
    ])
    if (row === undefined) return false
    await this.exec(`DELETE FROM auth.enrollment_codes WHERE org_id = $1 AND code_hash = $2`, [orgId, codeHash])
    return Number(row.expires_at) >= now
  }

  // ── OIDC grants ──
  async grantOidc(orgId: string, provider: string, subject: string): Promise<void> {
    await this.exec(`INSERT INTO auth.oidc_grants (org_id, provider, subject) VALUES ($1,$2,$3) ON CONFLICT (org_id, provider, subject) DO NOTHING`, [
      orgId,
      provider,
      subject,
    ])
  }
  async isOidcGranted(orgId: string, provider: string, subject: string): Promise<boolean> {
    const row = await this.one(`SELECT 1 FROM auth.oidc_grants WHERE org_id = $1 AND provider = $2 AND subject = $3`, [orgId, provider, subject])
    return row !== undefined
  }

  // ── orgs ──
  async createOrg(org: OrgRecord): Promise<void> {
    await this.exec(
      `INSERT INTO auth.orgs (id, name, webhook_secret, created_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, webhook_secret = excluded.webhook_secret, created_at = excluded.created_at`,
      [org.id, org.name, org.webhookSecret, org.createdAt],
    )
  }
  async getOrg(orgId: string): Promise<OrgRecord | undefined> {
    const row = await this.one<{ id: string; name: string; webhook_secret: string; created_at: number }>(`SELECT * FROM auth.orgs WHERE id = $1`, [orgId])
    return row ? { id: row.id, name: row.name, webhookSecret: row.webhook_secret, createdAt: Number(row.created_at) } : undefined
  }

  // ── users ──
  async createUser(user: UserRecord): Promise<void> {
    await this.exec(`INSERT INTO auth.users (id, org_id, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [
      user.id,
      user.orgId,
      user.email,
      user.passwordHash,
      user.role,
      user.createdAt,
    ])
  }
  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const row = await this.one<UserRow>(`SELECT * FROM auth.users WHERE email = $1`, [email])
    return row ? toUser(row) : undefined
  }
  async getUser(orgId: string, userId: string): Promise<UserRecord | undefined> {
    const row = await this.one<UserRow>(`SELECT * FROM auth.users WHERE org_id = $1 AND id = $2`, [orgId, userId])
    return row ? toUser(row) : undefined
  }
  async listUsers(orgId: string): Promise<UserRecord[]> {
    const rows = await this.many<UserRow>(`SELECT * FROM auth.users WHERE org_id = $1 ORDER BY created_at`, [orgId])
    return rows.map(toUser)
  }

  // ── invites ──
  async createInvite(invite: InviteRecord): Promise<void> {
    await this.exec(
      `INSERT INTO auth.invites (code, org_id, role, expires_at, used_by) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (code) DO UPDATE SET org_id = excluded.org_id, role = excluded.role, expires_at = excluded.expires_at, used_by = excluded.used_by`,
      [invite.code, invite.orgId, invite.role, invite.expiresAt, invite.usedBy ?? null],
    )
  }
  async consumeInvite(code: string, now: number): Promise<InviteRecord | undefined> {
    const row = await this.one<{ code: string; org_id: string; role: string; expires_at: number; used_by: string | null }>(
      `SELECT * FROM auth.invites WHERE code = $1`,
      [code],
    )
    if (!row) return undefined
    await this.exec(`DELETE FROM auth.invites WHERE code = $1`, [code])
    if (Number(row.expires_at) < now) return undefined
    return { code: row.code, orgId: row.org_id, role: row.role as Role, expiresAt: Number(row.expires_at), usedBy: row.used_by ?? undefined }
  }

  // ── sessions ──
  async createSession(session: SessionRecord): Promise<void> {
    await this.exec(
      `INSERT INTO auth.sessions (token, user_id, org_id, role, kind, csrf_token, created_at, expires_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [session.token, session.userId, session.orgId, session.role, session.kind, session.csrfToken, session.createdAt, session.expiresAt, session.lastSeenAt],
    )
  }
  async getSession(token: string): Promise<SessionRecord | undefined> {
    const row = await this.one<SessionRow>(`SELECT * FROM auth.sessions WHERE token = $1`, [token])
    return row ? toSession(row) : undefined
  }
  async deleteSession(token: string): Promise<void> {
    await this.exec(`DELETE FROM auth.sessions WHERE token = $1`, [token])
  }
  async touchSession(token: string, at: number): Promise<void> {
    await this.exec(`UPDATE auth.sessions SET last_seen_at = $1 WHERE token = $2`, [at, token])
  }

  // ── login rate-limiting ──
  async recordLoginFailure(email: string, at: number): Promise<void> {
    await this.exec(`INSERT INTO auth.login_failures (email, at) VALUES ($1,$2)`, [email, at])
  }
  async countRecentLoginFailures(email: string, sinceInclusive: number): Promise<number> {
    const row = await this.one<{ n: string | number }>(`SELECT COUNT(*) AS n FROM auth.login_failures WHERE email = $1 AND at >= $2`, [email, sinceInclusive])
    return Number(row?.n ?? 0)
  }

  // ── device-authorization flow ──
  async createDeviceAuth(record: DeviceAuthRecord): Promise<void> {
    await this.exec(
      `INSERT INTO auth.device_auths (device_code, user_code, status, user_id, org_id, role, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [record.deviceCode, record.userCode, record.status, record.userId ?? null, record.orgId ?? null, record.role ?? null, record.createdAt, record.expiresAt],
    )
  }
  async getDeviceAuthByDeviceCode(deviceCode: string): Promise<DeviceAuthRecord | undefined> {
    const row = await this.one<DeviceAuthRow>(`SELECT * FROM auth.device_auths WHERE device_code = $1`, [deviceCode])
    return row ? toDeviceAuth(row) : undefined
  }
  async approveDeviceAuthByUserCode(userCode: string, grant: { userId: string; orgId: string; role: Role }, now: number): Promise<boolean> {
    const row = await this.one<DeviceAuthRow>(`SELECT * FROM auth.device_auths WHERE user_code = $1`, [userCode])
    if (!row || row.status !== 'pending' || Number(row.expires_at) < now) return false
    await this.exec(`UPDATE auth.device_auths SET status = 'approved', user_id = $1, org_id = $2, role = $3 WHERE user_code = $4`, [
      grant.userId,
      grant.orgId,
      grant.role,
      userCode,
    ])
    return true
  }
  async consumeDeviceAuth(deviceCode: string, now: number): Promise<DeviceAuthRecord | undefined> {
    const row = await this.one<DeviceAuthRow>(`SELECT * FROM auth.device_auths WHERE device_code = $1`, [deviceCode])
    if (!row || row.status !== 'approved' || Number(row.expires_at) < now) return undefined
    await this.exec(`UPDATE auth.device_auths SET status = 'consumed' WHERE device_code = $1`, [deviceCode])
    return { ...toDeviceAuth(row), status: 'consumed' }
  }

  // ── offboarding tasks ──
  async createOffboardingTask(task: OffboardingTask): Promise<{ task: OffboardingTask; created: boolean }> {
    // Idempotency by (org_id, employee_id, effective_at): check-then-insert
    // rather than relying on `ON CONFLICT ... RETURNING` (pg-mem's RETURNING
    // semantics on a no-op conflict differ from real Postgres, so this path
    // is written to be correct against both). A genuine race is still caught
    // via the unique index (idx_offboarding_key) below.
    const existingBefore = await this.one<OffboardingRow>(
      `SELECT * FROM findings.offboarding_tasks WHERE org_id = $1 AND employee_id = $2 AND effective_at = $3`,
      [task.orgId, task.employee.id, task.effectiveAt],
    )
    if (existingBefore) return { task: toOffboarding(existingBefore), created: false }
    try {
      await this.exec(
        `INSERT INTO findings.offboarding_tasks
         (id, org_id, employee_id, employee_email, employee_name, asset_ids, unmatched, status, effective_at, created_at, updated_at, audit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          task.id,
          task.orgId,
          task.employee.id,
          task.employee.email,
          task.employee.name,
          JSON.stringify(task.assetIds),
          task.unmatched,
          task.status,
          task.effectiveAt,
          task.createdAt,
          task.updatedAt,
          JSON.stringify(task.audit),
        ],
      )
    } catch {
      // Unique-index violation: another writer won the race — return the
      // now-existing row rather than a duplicate.
      const row = await this.one<OffboardingRow>(
        `SELECT * FROM findings.offboarding_tasks WHERE org_id = $1 AND employee_id = $2 AND effective_at = $3`,
        [task.orgId, task.employee.id, task.effectiveAt],
      )
      if (row) return { task: toOffboarding(row), created: false }
      throw new Error('createOffboardingTask: insert failed and no existing row was found')
    }
    return {
      task: { ...task, employee: { ...task.employee }, assetIds: [...task.assetIds], audit: task.audit.map((a) => ({ ...a })) },
      created: true,
    }
  }
  async getOffboardingTask(orgId: string, id: string): Promise<OffboardingTask | undefined> {
    const row = await this.one<OffboardingRow>(`SELECT * FROM findings.offboarding_tasks WHERE org_id = $1 AND id = $2`, [orgId, id])
    return row ? toOffboarding(row) : undefined
  }
  async listOffboardingTasks(orgId: string): Promise<OffboardingTask[]> {
    const rows = await this.many<OffboardingRow>(`SELECT * FROM findings.offboarding_tasks WHERE org_id = $1 ORDER BY created_at`, [orgId])
    return rows.map(toOffboarding)
  }
  async transitionOffboardingTask(
    orgId: string,
    id: string,
    to: OffboardingStatus,
    actor: string,
    at: number,
  ): Promise<{ ok: true; task: OffboardingTask } | { ok: false; reason: 'not_found' | 'invalid_transition' }> {
    const row = await this.one<OffboardingRow>(`SELECT * FROM findings.offboarding_tasks WHERE org_id = $1 AND id = $2`, [orgId, id])
    if (!row) return { ok: false, reason: 'not_found' }
    const current = toOffboarding(row)
    if (!isLegalOffboardingTransition(current.status, to)) return { ok: false, reason: 'invalid_transition' }
    const audit = [...current.audit, { at, from: current.status, to, actor }]
    await this.exec(`UPDATE findings.offboarding_tasks SET status = $1, updated_at = $2, audit = $3 WHERE org_id = $4 AND id = $5`, [
      to,
      at,
      JSON.stringify(audit),
      orgId,
      id,
    ])
    return { ok: true, task: { ...current, status: to, updatedAt: at, audit } }
  }

  // ── policy sync ──
  async getPolicy(orgId: string): Promise<PolicyRecord | undefined> {
    const row = await this.one<PolicyRow>(`SELECT * FROM findings.policies WHERE org_id = $1`, [orgId])
    return row ? toPolicy(row) : undefined
  }
  async putPolicyRules(orgId: string, rules: string): Promise<PolicyRecord> {
    const existing = await this.one<{ rules_version: number; exceptions_version: number }>(
      `SELECT rules_version, exceptions_version FROM findings.policies WHERE org_id = $1`,
      [orgId],
    )
    const rulesVersion = (existing?.rules_version ? Number(existing.rules_version) : 0) + 1
    const exceptionsVersion = existing?.exceptions_version ? Number(existing.exceptions_version) : 0
    await this.exec(
      `INSERT INTO findings.policies (org_id, rules_version, rules, exceptions_version) VALUES ($1,$2,$3,$4)
       ON CONFLICT (org_id) DO UPDATE SET rules_version = excluded.rules_version, rules = excluded.rules, exceptions_version = excluded.exceptions_version`,
      [orgId, rulesVersion, rules, exceptionsVersion],
    )
    return { orgId, rulesVersion, rules, exceptionsVersion }
  }
  async listExceptions(orgId: string): Promise<PolicyExceptionRecord[]> {
    const rows = await this.many<PolicyExceptionRow>(`SELECT * FROM findings.policy_exceptions WHERE org_id = $1 ORDER BY created_at`, [orgId])
    return rows.map(toException)
  }
  async createException(record: PolicyExceptionRecord): Promise<void> {
    await this.exec(
      `INSERT INTO findings.policy_exceptions (id, org_id, rule_id, reason, status, created_at, resolved_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [record.id, record.orgId, record.ruleId, record.reason, record.status, record.createdAt, record.resolvedAt ?? null],
    )
  }
  async resolveException(
    orgId: string,
    id: string,
    status: Exclude<PolicyExceptionStatus, 'pending'>,
    now: number,
  ): Promise<PolicyExceptionRecord | undefined> {
    const row = await this.one<PolicyExceptionRow>(`SELECT * FROM findings.policy_exceptions WHERE id = $1 AND org_id = $2`, [id, orgId])
    if (!row || row.status !== 'pending') return undefined
    await this.exec(`UPDATE findings.policy_exceptions SET status = $1, resolved_at = $2 WHERE id = $3`, [status, now, id])
    const existing = await this.one<{ rules_version: number; rules: string; exceptions_version: number }>(
      `SELECT rules_version, rules, exceptions_version FROM findings.policies WHERE org_id = $1`,
      [orgId],
    )
    await this.exec(
      `INSERT INTO findings.policies (org_id, rules_version, rules, exceptions_version) VALUES ($1,$2,$3,$4)
       ON CONFLICT (org_id) DO UPDATE SET rules_version = excluded.rules_version, rules = excluded.rules, exceptions_version = excluded.exceptions_version`,
      [orgId, existing?.rules_version ?? 0, existing?.rules ?? '', (existing?.exceptions_version ? Number(existing.exceptions_version) : 0) + 1],
    )
    return { ...toException(row), status, resolvedAt: now }
  }

  // ── CVE cache (global, no org column) ──
  async getCveCache(ecosystem: string, pkg: string, version: string): Promise<CveCacheRecord | undefined> {
    const row = await this.one<{ vuln_ids: string; details: string; fetched_at: number; status: string }>(
      `SELECT * FROM findings.cve_cache WHERE ecosystem = $1 AND package = $2 AND version = $3`,
      [ecosystem, pkg, version],
    )
    if (!row) return undefined
    return {
      vulnIds: JSON.parse(row.vuln_ids) as string[],
      details: JSON.parse(row.details) as CveCacheRecord['details'],
      fetchedAt: Number(row.fetched_at),
      status: row.status as CveCacheRecord['status'],
    }
  }
  async putCveCache(ecosystem: string, pkg: string, version: string, record: CveCacheRecord): Promise<void> {
    await this.exec(
      `INSERT INTO findings.cve_cache (ecosystem, package, version, vuln_ids, details, fetched_at, status) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (ecosystem, package, version) DO UPDATE SET
         vuln_ids = excluded.vuln_ids, details = excluded.details, fetched_at = excluded.fetched_at, status = excluded.status`,
      [ecosystem, pkg, version, JSON.stringify(record.vulnIds), JSON.stringify(record.details), record.fetchedAt, record.status],
    )
  }
  async updateFindingCve(orgId: string, assetId: string, fingerprint: string, cveIds: string[], cveSeverity: CveSeverity): Promise<void> {
    await this.exec(`UPDATE findings.findings SET cve_ids = $1, cve_severity = $2 WHERE org_id = $3 AND asset_id = $4 AND fingerprint = $5`, [
      JSON.stringify(cveIds),
      cveSeverity,
      orgId,
      assetId,
      fingerprint,
    ])
  }

  // ── MCP catalog ──
  async getMcpCatalog(orgId: string): Promise<McpCatalogEntry[]> {
    const rows = await this.many<McpCatalogRow>(`SELECT * FROM findings.mcp_catalog WHERE org_id = $1 ORDER BY server_name`, [orgId])
    return rows.map(toMcpCatalogEntry)
  }
  async putMcpCatalog(orgId: string, entries: McpCatalogEntry[]): Promise<void> {
    await this.exec(`DELETE FROM findings.mcp_catalog WHERE org_id = $1`, [orgId])
    for (const e of entries) {
      await this.exec(
        `INSERT INTO findings.mcp_catalog (org_id, server_name, approved, risk_tags, note, updated_by, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orgId, e.serverName, e.approved, JSON.stringify(e.riskTags), e.note ?? null, e.updatedBy, e.updatedAt],
      )
    }
  }
  async getMcpStrictMode(orgId: string): Promise<boolean> {
    const row = await this.one<{ mcp_strict_mode: boolean }>(`SELECT mcp_strict_mode FROM findings.org_settings WHERE org_id = $1`, [orgId])
    return row ? row.mcp_strict_mode === true : false
  }
  async setMcpStrictMode(orgId: string, value: boolean): Promise<void> {
    await this.exec(
      `INSERT INTO findings.org_settings (org_id, mcp_strict_mode) VALUES ($1,$2)
       ON CONFLICT (org_id) DO UPDATE SET mcp_strict_mode = excluded.mcp_strict_mode`,
      [orgId, value],
    )
  }

  async close(): Promise<void> {
    // Pool lifecycle (pool.end()) is owned by whoever constructed the
    // injected PgQueryable, not by this adapter.
  }
}

// ── row shapes + mappers (mirror sqlite.ts 1:1) ──

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
function toAsset(r: AssetRow): AssetRecord {
  return {
    orgId: r.org_id,
    assetId: r.asset_id,
    label: r.label,
    kind: r.kind as AssetKind,
    authKind: r.auth_kind as AuthKind,
    secret: r.secret ?? undefined,
    subject: r.subject ?? undefined,
    provider: (r.provider as 'github' | 'gitlab' | null) ?? undefined,
    lastSeenAt: r.last_seen_at === null ? null : Number(r.last_seen_at),
    createdAt: Number(r.created_at),
  }
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
  advisory: boolean
}
function toFinding(r: FindingRow): FindingRecord {
  return {
    orgId: r.org_id,
    assetId: r.asset_id,
    ruleId: r.rule_id,
    surface: r.surface,
    severity: r.severity as Severity,
    location: r.location,
    evidenceRedacted: r.evidence_redacted,
    fingerprint: r.fingerprint,
    firstSeen: Number(r.first_seen),
    lastSeen: Number(r.last_seen),
    status: r.status as FindingRecord['status'],
    cveIds: r.cve_ids ? (JSON.parse(r.cve_ids) as string[]) : undefined,
    cveSeverity: (r.cve_severity as CveSeverity | null) ?? undefined,
    advisory: r.advisory === true,
  }
}

interface UserRow {
  id: string
  org_id: string
  email: string
  password_hash: string
  role: string
  created_at: number
}
function toUser(r: UserRow): UserRecord {
  return { id: r.id, orgId: r.org_id, email: r.email, passwordHash: r.password_hash, role: r.role as Role, createdAt: Number(r.created_at) }
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
function toSession(r: SessionRow): SessionRecord {
  return {
    token: r.token,
    userId: r.user_id,
    orgId: r.org_id,
    role: r.role as Role,
    kind: r.kind as SessionKind,
    csrfToken: r.csrf_token,
    createdAt: Number(r.created_at),
    expiresAt: Number(r.expires_at),
    lastSeenAt: Number(r.last_seen_at),
  }
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
function toDeviceAuth(r: DeviceAuthRow): DeviceAuthRecord {
  return {
    deviceCode: r.device_code,
    userCode: r.user_code,
    status: r.status as DeviceAuthStatus,
    userId: r.user_id ?? undefined,
    orgId: r.org_id ?? undefined,
    role: (r.role as Role | null) ?? undefined,
    createdAt: Number(r.created_at),
    expiresAt: Number(r.expires_at),
  }
}

interface OffboardingRow {
  id: string
  org_id: string
  employee_id: string
  employee_email: string
  employee_name: string
  asset_ids: string
  unmatched: boolean
  status: string
  effective_at: string
  created_at: number
  updated_at: number
  audit: string
}
function toOffboarding(r: OffboardingRow): OffboardingTask {
  return {
    id: r.id,
    orgId: r.org_id,
    employee: { id: r.employee_id, email: r.employee_email, name: r.employee_name },
    assetIds: JSON.parse(r.asset_ids) as string[],
    unmatched: r.unmatched === true,
    status: r.status as OffboardingStatus,
    effectiveAt: r.effective_at,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    audit: JSON.parse(r.audit) as OffboardingAuditEntry[],
  }
}

interface PolicyRow {
  org_id: string
  rules_version: number
  rules: string
  exceptions_version: number
}
function toPolicy(r: PolicyRow): PolicyRecord {
  return { orgId: r.org_id, rulesVersion: Number(r.rules_version), rules: r.rules, exceptionsVersion: Number(r.exceptions_version) }
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
function toException(r: PolicyExceptionRow): PolicyExceptionRecord {
  return {
    id: r.id,
    orgId: r.org_id,
    ruleId: r.rule_id,
    reason: r.reason,
    status: r.status as PolicyExceptionStatus,
    createdAt: Number(r.created_at),
    resolvedAt: r.resolved_at === null ? undefined : Number(r.resolved_at),
  }
}

interface McpCatalogRow {
  org_id: string
  server_name: string
  approved: boolean
  risk_tags: string
  note: string | null
  updated_by: string
  updated_at: number
}
function toMcpCatalogEntry(r: McpCatalogRow): McpCatalogEntry {
  return {
    orgId: r.org_id,
    serverName: r.server_name,
    approved: r.approved === true,
    riskTags: JSON.parse(r.risk_tags) as string[],
    note: r.note ?? undefined,
    updatedBy: r.updated_by,
    updatedAt: Number(r.updated_at),
  }
}
