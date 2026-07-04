import { hostname } from 'node:os'
import { join } from 'node:path'
import {
  type AuditReason,
  type AuditReport,
  type CleanupActionRecord,
  buildAuditReport,
  writeAuditReport,
  type WriteAuditReportResult,
} from '../audit-report.js'
import { applyCleanup, planCleanup, type CleanupPlanItem } from '../cleanup-actions.js'
import { ALL_SCOPES, collectResiduals, type ScopeKey } from '../residual-scan.js'
import type { NpmRunResult } from '../detectors/npm-global.js'
import type { ResidualCredential } from '../residual.js'

// Pure orchestration of the guided offboarding sweep. Scan+plan is separated
// from apply+report so the interactive component can render the plan and gate
// on explicit approval before anything is mutated. (Amendment 10 — logic lives
// outside React.)

export interface OffboardScanOptions {
  readonly scope?: readonly ScopeKey[]
  readonly homeDir?: string
  readonly platform?: NodeJS.Platform
  readonly projectPath?: string
  readonly npmRun?: () => NpmRunResult
}

export interface OffboardScanResult {
  readonly findings: ResidualCredential[]
  readonly plan: CleanupPlanItem[]
}

export function scanForOffboard(options: OffboardScanOptions = {}): OffboardScanResult {
  const findings = collectResiduals(options)
  return { findings, plan: planCleanup(findings) }
}

export interface OffboardApplyOptions {
  readonly approved: boolean
  readonly reason?: AuditReason
  readonly scope?: readonly ScopeKey[]
  readonly homeDir?: string
  readonly platform?: NodeJS.Platform
  readonly operator?: string
  readonly hostname?: string
  readonly now?: Date
  readonly reportDir?: string
  readonly writeReport?: boolean
}

export interface OffboardApplyResult {
  readonly records: CleanupActionRecord[]
  readonly report: AuditReport
  readonly reportPaths?: WriteAuditReportResult
  readonly trashDir?: string
}

export function applyOffboard(
  findings: readonly ResidualCredential[],
  plan: readonly CleanupPlanItem[],
  options: OffboardApplyOptions,
): OffboardApplyResult {
  const now = options.now ?? new Date()
  const { records, trashDir } = applyCleanup(plan, {
    approved: options.approved,
    homeDir: options.homeDir,
    now,
  })
  const report = buildAuditReport({
    reason: options.reason ?? 'offboarding',
    findings,
    actions: records,
    scope: [...(options.scope ?? ALL_SCOPES)],
    target: {
      os: options.platform ?? process.platform,
      hostname: options.hostname ?? safeHostname(),
      ...(options.homeDir ? { homeDir: options.homeDir } : {}),
    },
    ...(options.operator ? { operator: options.operator } : {}),
    generatedAt: now.toISOString(),
  })

  let reportPaths: WriteAuditReportResult | undefined
  if (options.writeReport !== false) {
    const dir = options.reportDir ?? defaultReportDir(options.homeDir)
    const stamp = now.toISOString().replace(/[:.]/g, '-')
    reportPaths = writeAuditReport(dir, report, `agentguard-audit-${stamp}`)
  }

  return { records, report, reportPaths, trashDir }
}

export interface OffboardSweepOptions extends OffboardScanOptions, Omit<OffboardApplyOptions, 'scope' | 'homeDir' | 'platform'> {}

export function runOffboardSweep(options: OffboardSweepOptions): OffboardScanResult & OffboardApplyResult {
  const { findings, plan } = scanForOffboard(options)
  const applied = applyOffboard(findings, plan, {
    ...options,
    scope: options.scope,
    homeDir: options.homeDir,
    platform: options.platform,
  })
  return { findings, plan, ...applied }
}

function defaultReportDir(homeDir?: string): string {
  if (homeDir) return join(homeDir, '.agentguard', 'reports')
  return join(safeHome(), '.agentguard', 'reports')
}

function safeHome(): string {
  try {
    // Lazily require to keep this module free of side effects at import time.
    return process.env.HOME ?? process.env.USERPROFILE ?? '.'
  } catch {
    return '.'
  }
}

function safeHostname(): string {
  try {
    return hostname()
  } catch {
    return 'unknown-host'
  }
}
