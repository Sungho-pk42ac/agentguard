import { spawnSync } from 'node:child_process'
import { type ResidualCredential, residualId } from '../residual.js'

// npm global AI-CLI inventory detector (NEW in v0.3.0). A globally installed AI
// coding CLI usually means residual auth/config lives nearby, so its presence
// is reported as a `config` residual. Only AI CLIs on a small allowlist are
// reported — an unfiltered global inventory would be pure noise.

export const KNOWN_AI_CLIS: readonly string[] = [
  '@anthropic-ai/claude-code',
  '@openai/codex',
  '@google/gemini-cli',
  '@githubnext/github-copilot-cli',
  '@github/copilot',
  '@sourcegraph/cody',
  '@builder.io/ai-shell',
  'aider-chat',
  'aichat',
  'opencommit',
  'agentguard',
]

export interface NpmGlobalPackage {
  readonly name: string
  readonly version: string
}

export interface NpmRunResult {
  readonly stdout: string
  readonly status: number | null
  readonly error?: Error
}

export interface NpmGlobalScanOptions {
  readonly run?: () => NpmRunResult
  readonly platform?: NodeJS.Platform
  readonly timeoutMs?: number
}

// Parse `npm ls -g --json --depth=0` output into a flat package list. npm exits
// non-zero on peer/extraneous issues but still prints valid JSON, so callers
// should parse stdout regardless of exit status.
export function parseNpmGlobalList(stdout: string): NpmGlobalPackage[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const deps = (parsed as { dependencies?: unknown }).dependencies
  if (!deps || typeof deps !== 'object') return []
  const out: NpmGlobalPackage[] = []
  for (const [name, value] of Object.entries(deps as Record<string, unknown>)) {
    const version =
      value && typeof value === 'object' && typeof (value as { version?: unknown }).version === 'string'
        ? (value as { version: string }).version
        : 'unknown'
    out.push({ name, version })
  }
  return out
}

export function aiCliResiduals(packages: readonly NpmGlobalPackage[]): ResidualCredential[] {
  const allow = new Set(KNOWN_AI_CLIS)
  return packages
    .filter((pkg) => allow.has(pkg.name))
    .map((pkg) => {
      const location = `npm-global:${pkg.name}`
      return {
        id: residualId('npm-global', location),
        kind: 'config' as const,
        severity: 'medium' as const,
        surface: 'npm-global',
        location,
        evidence: `Global AI CLI installed: ${pkg.name}@${pkg.version}`,
        recommendation:
          'Confirm the departing user is signed out; uninstall the CLI and remove residual auth/config if offboarding.',
      }
    })
}

function defaultRun(platform: NodeJS.Platform, timeoutMs: number): NpmRunResult {
  const command = platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(command, ['ls', '-g', '--json', '--depth=0'], {
    // Static args make shell:true injection-safe; npm.cmd on win32 needs a shell.
    shell: true,
    timeout: timeoutMs,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  return { stdout: result.stdout ?? '', status: result.status, error: result.error }
}

export function scanNpmGlobal(options: NpmGlobalScanOptions = {}): ResidualCredential[] {
  const platform = options.platform ?? process.platform
  const timeoutMs = options.timeoutMs ?? 5000
  const run = options.run ?? (() => defaultRun(platform, timeoutMs))
  let result: NpmRunResult
  try {
    result = run()
  } catch {
    return []
  }
  // npm missing (ENOENT) or timed out → skip gracefully.
  if (result.error) return []
  return aiCliResiduals(parseNpmGlobalList(result.stdout))
}
