import type {
  CveCacheRecord,
  CveSeverity,
  AlertRecord,
  AssetRecord,
  DeviceAuthRecord,
  FindingFilter,
  FindingRecord,
  IngestEventRecord,
  InviteRecord,
  McpCatalogEntry,
  OffboardingStatus,
  OffboardingTask,
  OrgRecord,
  PolicyExceptionRecord,
  PolicyExceptionStatus,
  PolicyRecord,
  Role,
  SessionRecord,
  UserRecord,
} from '../model.js'
import type { ReportFinding } from '../contract.js'

// Multi-tenant storage boundary. EVERY method takes orgId (except lookups that
// key by a globally-unique row id); there is no unscoped read path. Every
// method is async: MemoryStorage and SqliteStorage wrap synchronous bodies in
// Promises (unchanged behavior, just an async shape), while PostgresStorage
// (control-plane/src/storage/postgres.ts) issues real async network queries
// against a Postgres server via an injected PgQueryable. There is no honest
// synchronous adapter for a networked database, so the whole port is async.

export interface UpsertFindingResult {
  /** True when this (orgId, assetId, fingerprint) was not previously stored. */
  readonly isNew: boolean
}

export interface StoragePort {
  // ── assets ──
  createAsset(asset: AssetRecord): Promise<void>
  getAsset(orgId: string, assetId: string): Promise<AssetRecord | undefined>
  touchAsset(orgId: string, assetId: string, at: number): Promise<void>
  listAssets(orgId: string): Promise<AssetRecord[]>

  // ── findings ──
  upsertFinding(orgId: string, assetId: string, finding: ReportFinding, at: number): Promise<UpsertFindingResult>
  listFindings(orgId: string, filter?: FindingFilter): Promise<FindingRecord[]>

  // ── ingest audit ──
  recordIngest(event: IngestEventRecord): Promise<void>
  consumeIngestNonce(orgId: string, assetId: string, nonce: string, expiresAt: number, now: number): Promise<boolean>

  // ── alerts (dedup keyed on (orgId, fingerprint)) ──
  alertExists(orgId: string, fingerprint: string): Promise<boolean>
  recordAlert(alert: AlertRecord): Promise<void>
  listAlerts(orgId: string): Promise<AlertRecord[]>

  // ── enrollment codes (one-time, hashed, expiring) ──
  putEnrollmentCode(orgId: string, codeHash: string, expiresAt: number): Promise<void>
  consumeEnrollmentCode(orgId: string, codeHash: string, now: number): Promise<boolean>

  // ── OIDC enrollment grants (which provider:subject may enroll into an org) ──
  grantOidc(orgId: string, provider: string, subject: string): Promise<void>
  isOidcGranted(orgId: string, provider: string, subject: string): Promise<boolean>

  // ── auth: orgs ──
  createOrg(org: OrgRecord): Promise<void>
  getOrg(orgId: string): Promise<OrgRecord | undefined>

  // ── auth: users (email is globally unique for login-by-email) ──
  createUser(user: UserRecord): Promise<void>
  getUserByEmail(email: string): Promise<UserRecord | undefined>
  getUser(orgId: string, userId: string): Promise<UserRecord | undefined>
  listUsers(orgId: string): Promise<UserRecord[]>

  // ── auth: invites (single-use, expiring — like enrollment codes) ──
  createInvite(invite: InviteRecord): Promise<void>
  consumeInvite(code: string, now: number): Promise<InviteRecord | undefined>

  // ── auth: sessions ──
  createSession(session: SessionRecord): Promise<void>
  getSession(token: string): Promise<SessionRecord | undefined>
  deleteSession(token: string): Promise<void>
  touchSession(token: string, at: number): Promise<void>

  // ── auth: login rate-limiting (per-email failure counter) ──
  recordLoginFailure(email: string, at: number): Promise<void>
  countRecentLoginFailures(email: string, sinceInclusive: number): Promise<number>

  // ── auth: CLI device-authorization flow ──
  createDeviceAuth(record: DeviceAuthRecord): Promise<void>
  getDeviceAuthByDeviceCode(deviceCode: string): Promise<DeviceAuthRecord | undefined>
  approveDeviceAuthByUserCode(userCode: string, grant: { userId: string; orgId: string; role: Role }, now: number): Promise<boolean>
  consumeDeviceAuth(deviceCode: string, now: number): Promise<DeviceAuthRecord | undefined>

  // ── offboarding tasks (org-scoped; idempotent by (orgId, employee.id, effectiveAt)) ──
  // createOffboardingTask: if a task with the same idempotency key already
  // exists, the passed-in record is discarded and the EXISTING task is
  // returned with created:false — the caller never observes a duplicate.
  createOffboardingTask(task: OffboardingTask): Promise<{ task: OffboardingTask; created: boolean }>
  getOffboardingTask(orgId: string, id: string): Promise<OffboardingTask | undefined>
  listOffboardingTasks(orgId: string): Promise<OffboardingTask[]>
  transitionOffboardingTask(
    orgId: string,
    id: string,
    to: OffboardingStatus,
    actor: string,
    at: number,
  ): Promise<{ ok: true; task: OffboardingTask } | { ok: false; reason: 'not_found' | 'invalid_transition' }>

  // ── policy sync (org-scoped rules doc + exceptions) ──
  getPolicy(orgId: string): Promise<PolicyRecord | undefined>
  /** Upsert the org's rules text and bump rulesVersion (1 on first write). */
  putPolicyRules(orgId: string, rules: string): Promise<PolicyRecord>
  listExceptions(orgId: string): Promise<PolicyExceptionRecord[]>
  createException(record: PolicyExceptionRecord): Promise<void>
  /** Resolve a pending exception; bumps the org's exceptionsVersion. Returns undefined if unknown or not pending. */
  resolveException(orgId: string, id: string, status: Exclude<PolicyExceptionStatus, 'pending'>, now: number): Promise<PolicyExceptionRecord | undefined>

  // ── CVE cache (`cve_cache`, M2d) — the SOLE intentionally-global
  // (non-org-scoped) StoragePort surface. Keyed by (ecosystem, package,
  // version); carries
  // ONLY public osv.dev advisory data (vuln ids, CVSS-derived severity,
  // summary) — no org, asset, or finding identity. Sharing this cache across
  // every org that happens to run the same package@version is intentional:
  // it is public knowledge, not tenant data. tenancy-invariant.test.ts
  // explicitly whitelists exactly this surface; every other StoragePort
  // method must stay orgId-scoped.
  getCveCache(ecosystem: string, pkg: string, version: string): Promise<CveCacheRecord | undefined>
  putCveCache(ecosystem: string, pkg: string, version: string, record: CveCacheRecord): Promise<void>

  // ── CVE enrichment result projected onto a finding (org-scoped: identifies
  // WHICH org's finding matched a globally-cached CVE). ──
  updateFindingCve(orgId: string, assetId: string, fingerprint: string, cveIds: string[], cveSeverity: CveSeverity): Promise<void>

  // ── MCP catalog (M2e/§6.6): org-scoped approval list + strict-mode toggle ──
  getMcpCatalog(orgId: string): Promise<McpCatalogEntry[]>
  putMcpCatalog(orgId: string, entries: McpCatalogEntry[]): Promise<void>
  getMcpStrictMode(orgId: string): Promise<boolean>
  setMcpStrictMode(orgId: string, value: boolean): Promise<void>

  close(): Promise<void>
}
