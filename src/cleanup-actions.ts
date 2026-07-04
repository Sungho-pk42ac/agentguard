import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { CleanupActionKind, CleanupActionRecord } from './audit-report.js'
import type { ResidualCredential } from './residual.js'
import { SENSITIVE_FILE_RE } from './rules.js'

// Approval-gated remediation. The safety invariant (Seed weight 0.25): NO file
// is modified or deleted without explicit approval. Deletions are recoverable —
// the target is moved to ~/.agentguard/trash/<timestamp>/ (a backup), never
// hard-deleted, and the backup path is recorded in the audit report.

export interface CleanupPlanItem {
  readonly residualId: string
  readonly action: CleanupActionKind
  readonly target: string
  readonly line?: number
  // Human-facing description of exactly what would happen ("diff/대상 명시").
  readonly reason: string
}

function isSensitiveFile(location: string): boolean {
  return SENSITIVE_FILE_RE.test(location)
}

// Pure planner: derives a conservative, safe cleanup action per residual.
// Auto-mutating actions are limited to dedicated credential surfaces; anything
// structural or inside shared source code is downgraded to `advise` (manual).
export function planCleanup(residuals: readonly ResidualCredential[]): CleanupPlanItem[] {
  return residuals.map((residual) => planOne(residual))
}

function planOne(residual: ResidualCredential): CleanupPlanItem {
  const { path, line, surface, location } = residual

  if (surface === 'shell-rc' && path !== undefined && line !== undefined) {
    return {
      residualId: residual.id,
      action: 'remove-line',
      target: path,
      line,
      reason: `Remove line ${line} (exported credential) from ${location} after backing the file up.`,
    }
  }

  if (surface === 'ai-tool-dir' && path !== undefined) {
    const stat = statSync(path, { throwIfNoEntry: false })
    if (stat?.isDirectory()) {
      return { residualId: residual.id, action: 'delete-dir', target: path, reason: `Move AI tool directory ${location} to the recoverable trash.` }
    }
    if (stat?.isFile()) {
      return { residualId: residual.id, action: 'delete-file', target: path, reason: `Move AI tool credential file ${location} to the recoverable trash.` }
    }
  }

  if (surface === 'project-file' && path !== undefined && line === undefined && isSensitiveFile(location)) {
    return { residualId: residual.id, action: 'delete-file', target: path, reason: `Move credential-bearing file ${location} to the recoverable trash.` }
  }

  // Everything else (npm-global, agent-config MCP settings, secrets inside
  // shared source files) is advise-only: auto-editing it is unsafe.
  return {
    residualId: residual.id,
    action: 'advise',
    target: path ?? location,
    reason: `Manual review recommended: ${residual.recommendation}`,
  }
}

// Injectable filesystem seam so cross-volume (EXDEV) and locked-file (EBUSY)
// paths can be exercised deterministically in tests.
export interface FsMoveDeps {
  readonly rename: (from: string, to: string) => void
  readonly copyPath: (from: string, to: string) => void
  readonly removePath: (target: string) => void
  readonly mkdirp: (dir: string) => void
  readonly readText: (target: string) => string
  readonly writeText: (target: string, content: string) => void
}

const defaultFsDeps: FsMoveDeps = {
  rename: (from, to) => renameSync(from, to),
  copyPath: (from, to) => cpSync(from, to, { recursive: true }),
  removePath: (target) => rmSync(target, { recursive: true, force: true }),
  mkdirp: (dir) => mkdirSync(dir, { recursive: true }),
  readText: (target) => readFileSync(target, 'utf8'),
  writeText: (target, content) => writeFileSync(target, content),
}

export interface ApplyCleanupOptions {
  readonly approved: boolean
  readonly homeDir?: string
  readonly now?: Date
  readonly fs?: Partial<FsMoveDeps>
}

export interface ApplyCleanupResult {
  readonly records: CleanupActionRecord[]
  readonly trashDir?: string
}

function trashDirFor(homeDir: string, now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return join(homeDir, '.agentguard', 'trash', stamp)
}

function relocate(target: string, backupPath: string, deps: FsMoveDeps): void {
  try {
    deps.rename(target, backupPath)
    return
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === 'EXDEV') {
      // Cross-volume: copy then remove instead of an atomic rename.
      deps.copyPath(target, backupPath)
      deps.removePath(target)
      return
    }
    if (code === 'EBUSY') {
      // Locked file: retry once, then surface the failure to the caller.
      deps.rename(target, backupPath)
      return
    }
    throw error
  }
}

export function applyCleanup(plan: readonly CleanupPlanItem[], options: ApplyCleanupOptions): ApplyCleanupResult {
  const now = options.now ?? new Date()
  const appliedAt = now.toISOString()
  const deps: FsMoveDeps = { ...defaultFsDeps, ...options.fs }

  // SAFETY INVARIANT: without explicit approval, perform ZERO filesystem
  // mutation and mark every planned action as skipped.
  if (!options.approved) {
    return {
      records: plan.map((item) => ({
        residualId: item.residualId,
        action: item.action,
        target: normalizeTarget(item.target),
        status: 'skipped',
        appliedAt,
      })),
    }
  }

  const homeDir = options.homeDir ?? homedir()
  const trashDir = trashDirFor(homeDir, now)
  const records: CleanupActionRecord[] = []
  let backupIndex = 0

  for (const item of plan) {
    if (item.action === 'advise') {
      records.push({ residualId: item.residualId, action: 'advise', target: normalizeTarget(item.target), status: 'skipped', appliedAt })
      continue
    }
    const backupPath = join(trashDir, `${backupIndex}-${basename(item.target)}`)
    backupIndex += 1
    try {
      deps.mkdirp(trashDir)
      if (item.action === 'remove-line' && item.line !== undefined) {
        // Back up the whole file, then rewrite it without the offending line.
        deps.copyPath(item.target, backupPath)
        const rewritten = removeLine(deps.readText(item.target), item.line)
        deps.writeText(item.target, rewritten)
      } else {
        // delete-file / delete-dir: move to trash (recoverable).
        relocate(item.target, backupPath, deps)
      }
      records.push({
        residualId: item.residualId,
        action: item.action,
        target: normalizeTarget(item.target),
        status: 'applied',
        backupPath: normalizeTarget(backupPath),
        appliedAt,
      })
    } catch (error) {
      records.push({
        residualId: item.residualId,
        action: item.action,
        target: normalizeTarget(item.target),
        status: 'failed',
        appliedAt,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { records, trashDir }
}

function removeLine(text: string, line: number): string {
  const usesCrlf = text.includes('\r\n')
  const eol = usesCrlf ? '\r\n' : '\n'
  const hadTrailingEol = /\r?\n$/.test(text)
  const lines = text.split(/\r?\n/)
  if (hadTrailingEol && lines[lines.length - 1] === '') lines.pop()
  if (line >= 1 && line <= lines.length) lines.splice(line - 1, 1)
  const body = lines.join(eol)
  return hadTrailingEol && body.length > 0 ? body + eol : body
}

function normalizeTarget(target: string): string {
  return target.replace(/\\/g, '/')
}
