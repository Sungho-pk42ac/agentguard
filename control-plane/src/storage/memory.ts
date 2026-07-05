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
  PolicyRecord,
  Role,
  SessionRecord,
  UserRecord,
} from '../model.js'
import type { ReportFinding } from '../contract.js'
import { isLegalOffboardingTransition } from '../model.js'
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
  private readonly oidcGrants = new Set<string>()
  private readonly orgs = new Map<string, OrgRecord>()
  private readonly users = new Map<string, UserRecord>()
  private readonly usersByEmail = new Map<string, string>()
  private readonly invites = new Map<string, InviteRecord>()
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly loginFailures = new Map<string, number[]>()
  private readonly deviceAuths = new Map<string, DeviceAuthRecord>()
  private readonly offboardingTasks = new Map<string, OffboardingTask>()
  private readonly offboardingTasksByKey = new Map<string, string>()
  private readonly deviceAuthsByUserCode = new Map<string, string>()
  private readonly policies = new Map<string, PolicyRecord>()
  private readonly exceptions = new Map<string, PolicyExceptionRecord>()
  private readonly cveCache = new Map<string, CveCacheRecord>()
  private readonly mcpCatalog = new Map<string, McpCatalogEntry[]>()
  private readonly mcpStrictMode = new Map<string, boolean>()

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
      existing.advisory = finding.advisory
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

  grantOidc(orgId: string, provider: string, subject: string): void {
    this.oidcGrants.add(`${orgId}\u0000${provider}\u0000${subject}`)
  }
  isOidcGranted(orgId: string, provider: string, subject: string): boolean {
    return this.oidcGrants.has(`${orgId}\u0000${provider}\u0000${subject}`)
  }


  createOrg(org: OrgRecord): void {
    this.orgs.set(org.id, { ...org })
  }
  getOrg(orgId: string): OrgRecord | undefined {
    const o = this.orgs.get(orgId)
    return o ? { ...o } : undefined
  }

  createUser(user: UserRecord): void {
    this.users.set(user.id, { ...user })
    this.usersByEmail.set(user.email, user.id)
  }
  getUserByEmail(email: string): UserRecord | undefined {
    const id = this.usersByEmail.get(email)
    const u = id ? this.users.get(id) : undefined
    return u ? { ...u } : undefined
  }
  getUser(orgId: string, userId: string): UserRecord | undefined {
    const u = this.users.get(userId)
    return u && u.orgId === orgId ? { ...u } : undefined
  }
  listUsers(orgId: string): UserRecord[] {
    return [...this.users.values()].filter((u) => u.orgId === orgId).map((u) => ({ ...u }))
  }

  createInvite(invite: InviteRecord): void {
    this.invites.set(invite.code, { ...invite })
  }
  consumeInvite(code: string, now: number): InviteRecord | undefined {
    const invite = this.invites.get(code)
    if (!invite) return undefined
    this.invites.delete(code) // single-use regardless of expiry outcome
    return invite.expiresAt >= now ? { ...invite } : undefined
  }

  createSession(session: SessionRecord): void {
    this.sessions.set(session.token, { ...session })
  }
  getSession(token: string): SessionRecord | undefined {
    const s = this.sessions.get(token)
    return s ? { ...s } : undefined
  }
  deleteSession(token: string): void {
    this.sessions.delete(token)
  }
  touchSession(token: string, at: number): void {
    const s = this.sessions.get(token)
    if (s) s.lastSeenAt = at
  }

  recordLoginFailure(email: string, at: number): void {
    const arr = this.loginFailures.get(email) ?? []
    arr.push(at)
    this.loginFailures.set(email, arr)
  }
  countRecentLoginFailures(email: string, sinceInclusive: number): number {
    const arr = this.loginFailures.get(email) ?? []
    return arr.filter((at) => at >= sinceInclusive).length
  }

  createDeviceAuth(record: DeviceAuthRecord): void {
    this.deviceAuths.set(record.deviceCode, { ...record })
    this.deviceAuthsByUserCode.set(record.userCode, record.deviceCode)
  }
  getDeviceAuthByDeviceCode(deviceCode: string): DeviceAuthRecord | undefined {
    const r = this.deviceAuths.get(deviceCode)
    return r ? { ...r } : undefined
  }
  approveDeviceAuthByUserCode(userCode: string, grant: { userId: string; orgId: string; role: Role }, now: number): boolean {
    const deviceCode = this.deviceAuthsByUserCode.get(userCode)
    const record = deviceCode ? this.deviceAuths.get(deviceCode) : undefined
    if (!record || record.status !== 'pending' || record.expiresAt < now) return false
    record.status = 'approved'
    record.userId = grant.userId
    record.orgId = grant.orgId
    record.role = grant.role
    return true
  }
  consumeDeviceAuth(deviceCode: string, now: number): DeviceAuthRecord | undefined {
    const record = this.deviceAuths.get(deviceCode)
    if (!record || record.status !== 'approved' || record.expiresAt < now) return undefined
    record.status = 'consumed'
    return { ...record }
  }
  createOffboardingTask(task: OffboardingTask): { task: OffboardingTask; created: boolean } {
    const key = this.offboardingKey(task.orgId, task.employee.id, task.effectiveAt)
    const existingId = this.offboardingTasksByKey.get(key)
    const existing = existingId ? this.offboardingTasks.get(existingId) : undefined
    if (existing) return { task: this.cloneOffboarding(existing), created: false }
    this.offboardingTasks.set(task.id, this.cloneOffboarding(task))
    this.offboardingTasksByKey.set(key, task.id)
    return { task: this.cloneOffboarding(task), created: true }
  }
  getOffboardingTask(orgId: string, id: string): OffboardingTask | undefined {
    const t = this.offboardingTasks.get(id)
    return t && t.orgId === orgId ? this.cloneOffboarding(t) : undefined
  }
  listOffboardingTasks(orgId: string): OffboardingTask[] {
    return [...this.offboardingTasks.values()].filter((t) => t.orgId === orgId).map((t) => this.cloneOffboarding(t))
  }
  transitionOffboardingTask(
    orgId: string,
    id: string,
    to: OffboardingStatus,
    actor: string,
    at: number,
  ): { ok: true; task: OffboardingTask } | { ok: false; reason: 'not_found' | 'invalid_transition' } {
    const t = this.offboardingTasks.get(id)
    if (!t || t.orgId !== orgId) return { ok: false, reason: 'not_found' }
    if (!isLegalOffboardingTransition(t.status, to)) return { ok: false, reason: 'invalid_transition' }
    t.audit.push({ at, from: t.status, to, actor })
    t.status = to
    t.updatedAt = at
    return { ok: true, task: this.cloneOffboarding(t) }
  }
  private offboardingKey(orgId: string, employeeId: string, effectiveAt: string): string {
    return `${orgId}\u0000${employeeId}\u0000${effectiveAt}`
  }
  private cloneOffboarding(t: OffboardingTask): OffboardingTask {
    return { ...t, employee: { ...t.employee }, assetIds: [...t.assetIds], audit: t.audit.map((a) => ({ ...a })) }
  }

  close(): void {
    // nothing to release
  }
  getPolicy(orgId: string): PolicyRecord | undefined {
    const p = this.policies.get(orgId)
    return p ? { ...p } : undefined
  }
  putPolicyRules(orgId: string, rules: string): PolicyRecord {
    const existing = this.policies.get(orgId)
    const record: PolicyRecord = {
      orgId,
      rulesVersion: (existing?.rulesVersion ?? 0) + 1,
      rules,
      exceptionsVersion: existing?.exceptionsVersion ?? 0,
    }
    this.policies.set(orgId, record)
    return { ...record }
  }
  listExceptions(orgId: string): PolicyExceptionRecord[] {
    return [...this.exceptions.values()].filter((e) => e.orgId === orgId).map((e) => ({ ...e }))
  }
  createException(record: PolicyExceptionRecord): void {
    this.exceptions.set(record.id, { ...record })
  }
  resolveException(orgId: string, id: string, status: 'approved' | 'rejected', now: number): PolicyExceptionRecord | undefined {
    const e = this.exceptions.get(id)
    if (!e || e.orgId !== orgId || e.status !== 'pending') return undefined
    e.status = status
    e.resolvedAt = now
    const existing = this.policies.get(orgId)
    this.policies.set(orgId, {
      orgId,
      rulesVersion: existing?.rulesVersion ?? 0,
      rules: existing?.rules ?? '',
      exceptionsVersion: (existing?.exceptionsVersion ?? 0) + 1,
    })
    return { ...e }
  }
  private cveCacheKey(ecosystem: string, pkg: string, version: string): string {
    return `${ecosystem}\u0000${pkg}\u0000${version}`
  }
  getCveCache(ecosystem: string, pkg: string, version: string): CveCacheRecord | undefined {
    const r = this.cveCache.get(this.cveCacheKey(ecosystem, pkg, version))
    return r ? { ...r, vulnIds: [...r.vulnIds], details: r.details.map((d) => ({ ...d })) } : undefined
  }
  putCveCache(ecosystem: string, pkg: string, version: string, record: CveCacheRecord): void {
    this.cveCache.set(this.cveCacheKey(ecosystem, pkg, version), {
      ...record,
      vulnIds: [...record.vulnIds],
      details: record.details.map((d) => ({ ...d })),
    })
  }
  updateFindingCve(orgId: string, assetId: string, fingerprint: string, cveIds: string[], cveSeverity: CveSeverity): void {
    const f = this.findings.get(this.findingKey(orgId, assetId, fingerprint))
    if (!f) return
    f.cveIds = [...cveIds]
    f.cveSeverity = cveSeverity
  }
  getMcpCatalog(orgId: string): McpCatalogEntry[] {
    return (this.mcpCatalog.get(orgId) ?? []).map((e) => ({ ...e, riskTags: [...e.riskTags] }))
  }
  putMcpCatalog(orgId: string, entries: McpCatalogEntry[]): void {
    this.mcpCatalog.set(
      orgId,
      entries.map((e) => ({ ...e, riskTags: [...e.riskTags] })),
    )
  }
  getMcpStrictMode(orgId: string): boolean {
    return this.mcpStrictMode.get(orgId) ?? false
  }
  setMcpStrictMode(orgId: string, value: boolean): void {
    this.mcpStrictMode.set(orgId, value)
  }
}
