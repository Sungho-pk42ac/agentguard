import type { Finding } from './rules.js'

// `agentguard hook install|uninstall` manages a git pre-commit hook that
// scans staged files and blocks the commit when a critical (non-advisory)
// finding is present. Kept pure + injectable (no direct `node:fs`/git
// coupling) so it is testable without a real git repository.

/** Marks a hook file as agentguard-managed so re-install/uninstall are safe. */
export const HOOK_SENTINEL = '# agentguard:managed-hook'

const BACKUP_SUFFIX = '.agentguard.bak'

/**
 * The POSIX-sh body written to `.git/hooks/pre-commit` (or `core.hooksPath`).
 * Scans staged files with `agentguard scan-files --json` and blocks the
 * commit (non-zero exit) on any critical, non-advisory finding.
 */
export function hookScriptContents(): string {
  return `#!/bin/sh
${HOOK_SENTINEL} (do not edit by hand — managed by \`agentguard hook install\`)
#
# Scans staged files for secrets, PII, dangerous commands, and other risky
# agent behavior, and blocks the commit when a critical finding is present.
#
# Windows note: Git for Windows runs hooks through its bundled sh (MSYS/Git
# Bash), so this POSIX script works unmodified there too. If you use
# \`core.hooksPath\` pointing outside .git/hooks, re-run
# \`agentguard hook install\` after changing it so the hook lands in the
# right place.

set -eu

if ! command -v agentguard >/dev/null 2>&1; then
  echo "agentguard: 'agentguard' CLI not found on PATH, skipping pre-commit scan" >&2
  exit 0
fi

staged_files=$(git diff --cached --name-only --diff-filter=ACM)
if [ -z "\${staged_files}" ]; then
  exit 0
fi

findings_json=$(printf '%s\\n' "\${staged_files}" | xargs agentguard scan-files --json 2>/dev/null || echo '[]')

critical_count=$(printf '%s' "\${findings_json}" | grep -o '"severity":"critical"' | wc -l | tr -d ' ')

if [ "\${critical_count}" != "0" ]; then
  echo "agentguard: blocking commit — \${critical_count} critical finding(s) in staged files" >&2
  echo "\${findings_json}" >&2
  exit 1
fi

exit 0
`
}

export interface HookIo {
  readonly gitDir: string
  readonly hooksPath?: string
  readonly existsSync: (path: string) => boolean
  readonly readFile: (path: string) => string
  readonly writeFile: (path: string, contents: string) => void
  readonly mkdir?: (path: string) => void
  readonly chmod?: (path: string, mode: number) => void
  readonly unlink?: (path: string) => void
}

export interface InstallHookResult {
  readonly installed: boolean
  readonly path: string
  readonly backedUp?: string
}

export interface UninstallHookResult {
  readonly removed: boolean
  readonly restored?: boolean
}

/** Resolves the pre-commit hook path, honoring `core.hooksPath` when set. */
export function resolveHookPath(gitDir: string, hooksPath?: string): string {
  const dir = hooksPath && hooksPath.length > 0 ? hooksPath : `${gitDir}/hooks`
  return `${dir}/pre-commit`
}

function isAgentguardManaged(contents: string): boolean {
  return contents.includes(HOOK_SENTINEL)
}

export function installHook(io: HookIo): InstallHookResult {
  const path = resolveHookPath(io.gitDir, io.hooksPath)
  io.mkdir?.(path.slice(0, path.lastIndexOf('/')))

  let backedUp: string | undefined
  if (io.existsSync(path)) {
    const existing = io.readFile(path)
    if (!isAgentguardManaged(existing)) {
      const backupPath = `${path}${BACKUP_SUFFIX}`
      io.writeFile(backupPath, existing)
      backedUp = backupPath
    }
  }

  io.writeFile(path, hookScriptContents())
  io.chmod?.(path, 0o755)

  return backedUp ? { installed: true, path, backedUp } : { installed: true, path }
}

export function uninstallHook(io: HookIo): UninstallHookResult {
  const path = resolveHookPath(io.gitDir, io.hooksPath)
  if (!io.existsSync(path)) return { removed: false }

  const existing = io.readFile(path)
  if (!isAgentguardManaged(existing)) return { removed: false }

  const backupPath = `${path}${BACKUP_SUFFIX}`
  if (io.existsSync(backupPath)) {
    io.writeFile(path, io.readFile(backupPath))
    io.unlink?.(backupPath)
    return { removed: true, restored: true }
  }

  if (io.unlink) {
    io.unlink(path)
  } else {
    io.writeFile(path, '')
  }
  return { removed: true }
}

/**
 * Decides whether a set of scan findings should block a commit: any
 * non-advisory 'critical' finding blocks; advisory findings never count.
 */
export function classifyStagedScan(findings: readonly Finding[]): { block: boolean; criticalCount: number } {
  const criticalCount = findings.filter((f) => f.severity === 'critical' && !f.advisory).length
  return { block: criticalCount > 0, criticalCount }
}
