import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { ResidualCredential, ResidualKind } from './residual.js'
import type { Severity } from './rules.js'

// Public contract for offboarding/audit-sweep reports. Persisted outputs
// (JSON) are validated against these zod schemas, so any change here is a
// breaking change. `schemaVersion` lets the contract evolve without a hard
// break (amendment 9).

export const AUDIT_REPORT_SCHEMA_VERSION = 1 as const

export type AuditReason = 'offboarding' | 'incident' | 'audit' | 'exploration'
export type CleanupActionKind = 'delete-file' | 'delete-dir' | 'remove-line' | 'advise'
export type CleanupActionStatus = 'applied' | 'skipped' | 'failed'

const severitySchema = z.enum(['low', 'medium', 'high', 'critical'])
const kindSchema = z.enum(['api-key', 'config', 'mcp-perm'])

export const residualCredentialSchema = z.object({
  id: z.string().min(1),
  kind: kindSchema,
  severity: severitySchema,
  surface: z.string().min(1),
  location: z.string().min(1),
  path: z.string().optional(),
  line: z.number().int().positive().optional(),
  evidence: z.string(),
  recommendation: z.string(),
})

export const cleanupActionRecordSchema = z.object({
  residualId: z.string().min(1),
  action: z.enum(['delete-file', 'delete-dir', 'remove-line', 'advise']),
  target: z.string().min(1),
  status: z.enum(['applied', 'skipped', 'failed']),
  backupPath: z.string().optional(),
  appliedAt: z.string().min(1),
  error: z.string().optional(),
})

export const auditReportSchema = z.object({
  schemaVersion: z.literal(AUDIT_REPORT_SCHEMA_VERSION),
  tool: z.literal('agentguard'),
  reason: z.enum(['offboarding', 'incident', 'audit', 'exploration']),
  generatedAt: z.string().min(1),
  target: z.object({
    os: z.string(),
    hostname: z.string().optional(),
    homeDir: z.string().optional(),
  }),
  operator: z.string().optional(),
  scope: z.array(z.string()),
  findings: z.array(residualCredentialSchema),
  actions: z.array(cleanupActionRecordSchema),
  summary: z.object({
    findingCount: z.number().int().nonnegative(),
    bySeverity: z.record(z.string(), z.number().int().nonnegative()),
    appliedActions: z.number().int().nonnegative(),
  }),
})

export type AuditReport = z.infer<typeof auditReportSchema>
export type CleanupActionRecord = z.infer<typeof cleanupActionRecordSchema>

export interface AuditReportInput {
  readonly reason: AuditReason
  readonly findings: readonly ResidualCredential[]
  readonly actions: readonly CleanupActionRecord[]
  readonly scope: readonly string[]
  readonly target: { readonly os: string; readonly hostname?: string; readonly homeDir?: string }
  readonly operator?: string
  readonly generatedAt?: string
}

const SEVERITIES: readonly Severity[] = ['low', 'medium', 'high', 'critical']

export function buildAuditReport(input: AuditReportInput): AuditReport {
  const bySeverity: Record<string, number> = {}
  for (const severity of SEVERITIES) bySeverity[severity] = 0
  for (const finding of input.findings) bySeverity[finding.severity] += 1

  const report: AuditReport = {
    schemaVersion: AUDIT_REPORT_SCHEMA_VERSION,
    tool: 'agentguard',
    reason: input.reason,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    target: input.target,
    ...(input.operator === undefined ? {} : { operator: input.operator }),
    scope: [...input.scope],
    findings: input.findings.map(normalizeFinding),
    actions: input.actions.map((action) => ({ ...action })),
    summary: {
      findingCount: input.findings.length,
      bySeverity,
      appliedActions: input.actions.filter((a) => a.status === 'applied').length,
    },
  }
  // Fail fast if we ever construct something off-contract.
  return auditReportSchema.parse(report)
}

function normalizeFinding(finding: ResidualCredential): z.infer<typeof residualCredentialSchema> {
  const kind: ResidualKind = finding.kind
  return {
    id: finding.id,
    kind,
    severity: finding.severity,
    surface: finding.surface,
    location: finding.location,
    ...(finding.path === undefined ? {} : { path: finding.path }),
    ...(finding.line === undefined ? {} : { line: finding.line }),
    evidence: finding.evidence,
    recommendation: finding.recommendation,
  }
}

export function auditReportToJson(report: AuditReport): string {
  return JSON.stringify(auditReportSchema.parse(report), null, 2)
}

export function parseAuditReport(json: string): AuditReport {
  return auditReportSchema.parse(JSON.parse(json))
}

const REASON_LABEL: Record<AuditReason, string> = {
  offboarding: '오프보딩 스윕 (Offboarding sweep)',
  incident: '긴급 유출 대응 (Incident response)',
  audit: '정기 점검 (Periodic audit)',
  exploration: '신규 도구 탐색 (New tool exploration)',
}

const ACTION_LABEL: Record<CleanupActionKind, string> = {
  'delete-file': 'delete file',
  'delete-dir': 'delete directory',
  'remove-line': 'remove line',
  advise: 'advise (manual)',
}

// Korean-first human report; machine-facing field names stay English.
export function auditReportToMarkdown(report: AuditReport): string {
  const lines: string[] = []
  lines.push('# AgentGuard 감사 리포트 (Audit report)')
  lines.push('')
  lines.push(`- 사유(reason): ${REASON_LABEL[report.reason]}`)
  lines.push(`- 생성 시각(generatedAt): ${report.generatedAt}`)
  lines.push(`- 대상 OS(target.os): ${report.target.os}`)
  if (report.target.hostname) lines.push(`- 호스트(hostname): ${report.target.hostname}`)
  if (report.operator) lines.push(`- 담당자(operator): ${report.operator}`)
  lines.push(`- 스캔 범위(scope): ${report.scope.length > 0 ? report.scope.join(', ') : '(none)'}`)
  lines.push('')
  lines.push('## 요약 (Summary)')
  lines.push('')
  lines.push(`- 발견 항목(findingCount): ${report.summary.findingCount}`)
  const severityLine = SEVERITIES.map((s) => `${s}=${report.summary.bySeverity[s] ?? 0}`).join(', ')
  lines.push(`- 심각도별(bySeverity): ${severityLine}`)
  lines.push(`- 적용된 정리 액션(appliedActions): ${report.summary.appliedActions}`)
  lines.push('')
  lines.push('## 발견 항목 (Findings)')
  lines.push('')
  if (report.findings.length === 0) {
    lines.push('- 발견된 잔여 자격증명이 없습니다.')
  } else {
    lines.push('| severity | surface | location | evidence |')
    lines.push('|----------|---------|----------|----------|')
    for (const f of report.findings) {
      lines.push(`| ${f.severity} | ${f.surface} | ${escapeCell(f.location)} | ${escapeCell(f.evidence)} |`)
    }
  }
  lines.push('')
  lines.push('## 적용된 정리 액션 (Cleanup actions)')
  lines.push('')
  if (report.actions.length === 0) {
    lines.push('- 적용된 액션이 없습니다.')
  } else {
    lines.push('| status | action | target | backup | when |')
    lines.push('|--------|--------|--------|--------|------|')
    for (const a of report.actions) {
      const label = ACTION_LABEL[a.action]
      lines.push(
        `| ${a.status} | ${label} | ${escapeCell(a.target)} | ${escapeCell(a.backupPath ?? '-')} | ${a.appliedAt} |`,
      )
    }
  }
  return lines.join('\n')
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export interface WriteAuditReportResult {
  readonly jsonPath: string
  readonly markdownPath: string
}

// Writes both machine (JSON) and human (MD) reports into a directory.
export function writeAuditReport(dir: string, report: AuditReport, baseName = 'agentguard-audit'): WriteAuditReportResult {
  mkdirSync(dir, { recursive: true })
  const jsonPath = join(dir, `${baseName}.json`)
  const markdownPath = join(dir, `${baseName}.md`)
  writeFileSync(jsonPath, auditReportToJson(report) + '\n')
  writeFileSync(markdownPath, auditReportToMarkdown(report) + '\n')
  return { jsonPath, markdownPath }
}
