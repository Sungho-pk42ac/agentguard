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

  async createAsset(asset: AssetRecord): Promise<void> {
    this.assets.set(this.assetKey(asset.orgId, asset.assetId), { ...asset })
  }
  async getAsset(orgId: string, assetId: string): Promise<AssetRecord | undefined> {
    const a = this.assets.get(this.assetKey(orgId, assetId))
    return a ? { ...a } : undefined
  }
  async touchAsset(orgId: string, assetId: string, at: number): Promise<void> {
    const a = this.assets.get(this.assetKey(orgId, assetId))
    if (a) a.lastSeenAt = at
  }
  async listAssets(orgId: string): Promise<AssetRecord[]> {
    return [...this.assets.values()].filter((a) => a.orgId === orgId).map((a) => ({ ...a }))
  }

  async upsertFinding(orgId: string, assetId: string, finding: ReportFinding, at: number): Promise<UpsertFindingResult> {
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
  async listFindings(orgId: string, filter: FindingFilter = {}): Promise<FindingRecord[]> {
    return [...this.findings.values()]
      .filter((f) => f.orgId === orgId)
      .filter((f) => (filter.surface ? f.surface === filter.surface : true))
      .filter((f) => (filter.severity ? f.severity === filter.severity : true))
      .filter((f) => (filter.assetId ? f.assetId === filter.assetId : true))
      .map((f) => ({ ...f }))
  }

  async recordIngest(event: IngestEventRecord): Promise<void> {
    this.ingests.push({ ...event })
  }

  async alertExists(orgId: string, fingerprint: string): Promise<boolean> {
    return this.alerts.has(this.alertKey(orgId, fingerprint))
  }
  async recordAlert(alert: AlertRecord): Promise<void> {
    const key = this.alertKey(alert.orgId, alert.fingerprint)
    if (!this.alerts.has(key)) this.alerts.set(key, { ...alert })
  }
  async listAlerts(orgId: string): Promise<AlertRecord[]> {
    return [...this.alerts.values()].filter((a) => a.orgId === orgId).map((a) => ({ ...a }))
  }

  async putEnrollmentCode(orgId: string, codeHash: string, expiresAt: number): Promise<void> {
    this.codes.set(this.alertKey(orgId, codeHash), expiresAt)
  }
  async consumeEnrollmentCode(orgId: string, codeHash: string, now: number): Promise<boolean> {
    const key = this.alertKey(orgId, codeHash)
    const expiresAt = this.codes.get(key)
    if (expiresAt === undefined) return false
    this.codes.delete(key) // single-use regardless of expiry outcome
    return expiresAt >= now
  }

  async grantOidc(orgId: string, provider: string, subject: string): Promise<void> {
    this.oidcGrants.add(`${orgId}\u0000${provider}\u0000${subject}`)
  }
  async isOidcGranted(orgId: string, provider: string, subject: string): Promise<boolean> {
    return this.oidcGrants.has(`${orgId}\u0000${provider}\u0000${subject}`)
  }


  async createOrg(org: OrgRecord): Promise<void> {
    this.orgs.set(org.id, { ...org })
  }
  async getOrg(orgId: string): Promise<OrgRecord | undefined> {
    const o = this.orgs.get(orgId)
    return o ? { ...o } : undefined
  }

  async createUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, { ...user })
    this.usersByEmail.set(user.email, user.id)
  }
  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const id = this.usersByEmail.get(email)
    const u = id ? this.users.get(id) : undefined
    return u ? { ...u } : undefined
  }
  async getUser(orgId: string, userId: string): Promise<UserRecord | undefined> {
    const u = this.users.get(userId)
    return u && u.orgId === orgId ? { ...u } : undefined
  }
  async listUsers(orgId: string): Promise<UserRecord[]> {
    return [...this.users.values()].filter((u) => u.orgId === orgId).map((u) => ({ ...u }))
  }

  async createInvite(invite: InviteRecord): Promise<void> {
    this.invites.set(invite.code, { ...invite })
  }
  async consumeInvite(code: string, now: number): Promise<InviteRecord | undefined> {
    const invite = this.invites.get(code)
    if (!invite) return undefined
    this.invites.delete(code) // single-use regardless of expiry outcome
    return invite.expiresAt >= now ? { ...invite } : undefined
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.sessions.set(session.token, { ...session })
  }
  async getSession(token: string): Promise<SessionRecord | undefined> {
    const s = this.sessions.get(token)
    return s ? { ...s } : undefined
  }
  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token)
  }
  async touchSession(token: string, at: number): Promise<void> {
    const s = this.sessions.get(token)
    if (s) s.lastSeenAt = at
  }

  async recordLoginFailure(email: string, at: number): Promise<void> {
    const arr = this.loginFailures.get(email) ?? []
    arr.push(at)
    this.loginFailures.set(email, arr)
  }
  async countRecentLoginFailures(email: string, sinceInclusive: number): Promise<number> {
    const arr = this.loginFailures.get(email) ?? []
    return arr.filter((at) => at >= sinceInclusive).length
  }

  async createDeviceAuth(record: DeviceAuthRecord): Promise<void> {
    this.deviceAuths.set(record.deviceCode, { ...record })
    this.deviceAuthsByUserCode.set(record.userCode, record.deviceCode)
  }
  async getDeviceAuthByDeviceCode(deviceCode: string): Promise<DeviceAuthRecord | undefined> {
    const r = this.deviceAuths.get(deviceCode)
    return r ? { ...r } : undefined
  }
  async approveDeviceAuthByUserCode(userCode: string, grant: { userId: string; orgId: string; role: Role }, now: number): Promise<boolean> {
    const deviceCode = this.deviceAuthsByUserCode.get(userCode)
    const record = deviceCode ? this.deviceAuths.get(deviceCode) : undefined
    if (!record || record.status !== 'pending' || record.expiresAt < now) return false
    record.status = 'approved'
    record.userId = grant.userId
    record.orgId = grant.orgId
    record.role = grant.role
    return true
  }
  async consumeDeviceAuth(deviceCode: string, now: number): Promise<DeviceAuthRecord | undefined> {
    const record = this.deviceAuths.get(deviceCode)
    if (!record || record.status !== 'approved' || record.expiresAt < now) return undefined
    record.status = 'consumed'
    return { ...record }
  }
  async createOffboardingTask(task: OffboardingTask): Promise<{ task: OffboardingTask; created: boolean }> {
    const key = this.offboardingKey(task.orgId, task.employee.id, task.effectiveAt)
    const existingId = this.offboardingTasksByKey.get(key)
    const existing = existingId ? this.offboardingTasks.get(existingId) : undefined
    if (existing) return { task: this.cloneOffboarding(existing), created: false }
    this.offboardingTasks.set(task.id, this.cloneOffboarding(task))
    this.offboardingTasksByKey.set(key, task.id)
    return { task: this.cloneOffboarding(task), created: true }
  }
  async getOffboardingTask(orgId: string, id: string): Promise<OffboardingTask | undefined> {
    const t = this.offboardingTasks.get(id)
    return t && t.orgId === orgId ? this.cloneOffboarding(t) : undefined
  }
  async listOffboardingTasks(orgId: string): Promise<OffboardingTask[]> {
    return [...this.offboardingTasks.values()].filter((t) => t.orgId === orgId).map((t) => this.cloneOffboarding(t))
  }
  async transitionOffboardingTask(
    orgId: string,
    id: string,
    to: OffboardingStatus,
    actor: string,
    at: number,
  ): Promise<{ ok: true; task: OffboardingTask } | { ok: false; reason: 'not_found' | 'invalid_transition' }> {
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

  async close(): Promise<void> {
    // nothing to release
  }
  async getPolicy(orgId: string): Promise<PolicyRecord | undefined> {
    const p = this.policies.get(orgId)
    return p ? { ...p } : undefined
  }
  async putPolicyRules(orgId: string, rules: string): Promise<PolicyRecord> {
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
  async listExceptions(orgId: string): Promise<PolicyExceptionRecord[]> {
    return [...this.exceptions.values()].filter((e) => e.orgId === orgId).map((e) => ({ ...e }))
  }
  async createException(record: PolicyExceptionRecord): Promise<void> {
    this.exceptions.set(record.id, { ...record })
  }
  async resolveException(orgId: string, id: string, status: 'approved' | 'rejected', now: number): Promise<PolicyExceptionRecord | undefined> {
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
  async getCveCache(ecosystem: string, pkg: string, version: string): Promise<CveCacheRecord | undefined> {
    const r = this.cveCache.get(this.cveCacheKey(ecosystem, pkg, version))
    return r ? { ...r, vulnIds: [...r.vulnIds], details: r.details.map((d) => ({ ...d })) } : undefined
  }
  async putCveCache(ecosystem: string, pkg: string, version: string, record: CveCacheRecord): Promise<void> {
    this.cveCache.set(this.cveCacheKey(ecosystem, pkg, version), {
      ...record,
      vulnIds: [...record.vulnIds],
      details: record.details.map((d) => ({ ...d })),
    })
  }
  async updateFindingCve(orgId: string, assetId: string, fingerprint: string, cveIds: string[], cveSeverity: CveSeverity): Promise<void> {
    const f = this.findings.get(this.findingKey(orgId, assetId, fingerprint))
    if (!f) return
    f.cveIds = [...cveIds]
    f.cveSeverity = cveSeverity
  }
  async getMcpCatalog(orgId: string): Promise<McpCatalogEntry[]> {
    return (this.mcpCatalog.get(orgId) ?? []).map((e) => ({ ...e, riskTags: [...e.riskTags] }))
  }
  async putMcpCatalog(orgId: string, entries: McpCatalogEntry[]): Promise<void> {
    this.mcpCatalog.set(
      orgId,
      entries.map((e) => ({ ...e, riskTags: [...e.riskTags] })),
    )
  }
  async getMcpStrictMode(orgId: string): Promise<boolean> {
    return this.mcpStrictMode.get(orgId) ?? false
  }
  async setMcpStrictMode(orgId: string, value: boolean): Promise<void> {
    this.mcpStrictMode.set(orgId, value)
  }
}
