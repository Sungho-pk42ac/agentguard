import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { scanShellRc } from './detectors/shell-rc.js'
import { scanNpmGlobal, type NpmRunResult } from './detectors/npm-global.js'
import { scanAgentPosture } from './posture.js'
import { type ResidualCredential, residualId } from './residual.js'
import type { Finding } from './rules.js'
import { normalizePath, scanFiles, scanText } from './scanner.js'

// Composes the five required offboarding/audit detection surfaces into a single
// ResidualCredential[]. Guided flows call the existing scanners/detectors
// directly — there is no reimplemented scan logic here, only aggregation.

export type ScopeKey = 'ai-tool-dir' | 'agent-config' | 'shell-rc' | 'npm-global' | 'project-files'

export interface ScopeItem {
  readonly key: ScopeKey
  readonly label: string
}

export const SCOPE_ITEMS: readonly ScopeItem[] = [
  { key: 'ai-tool-dir', label: 'AI tool config dirs (~/.claude, ~/.codex, …)' },
  { key: 'agent-config', label: 'Agent MCP config (Claude Desktop / Cursor / …)' },
  { key: 'shell-rc', label: 'Shell rc keys (.bashrc / .zshrc / PowerShell $PROFILE)' },
  { key: 'npm-global', label: 'npm global AI CLI inventory' },
  { key: 'project-files', label: 'Project .env / source secrets' },
]

export const ALL_SCOPES: readonly ScopeKey[] = SCOPE_ITEMS.map((item) => item.key)

// Home-relative AI tool locations. Files are content-scanned for keys; the
// presence of any is itself reported as residual config.
const AI_TOOL_ENTRIES: readonly string[] = [
  '.claude',
  '.claude.json',
  '.codex',
  '.codex/auth.json',
  '.gemini',
  '.cursor',
  '.config/claude',
  '.config/github-copilot',
  '.aider.conf.yml',
]

export interface ResidualScanOptions {
  readonly homeDir?: string
  readonly platform?: NodeJS.Platform
  readonly projectPath?: string
  readonly scope?: readonly ScopeKey[]
  readonly npmRun?: () => NpmRunResult
}

export function collectResiduals(options: ResidualScanOptions = {}): ResidualCredential[] {
  const home = options.homeDir ?? homedir()
  const platform = options.platform ?? process.platform
  const scope = new Set(options.scope ?? ALL_SCOPES)
  const out: ResidualCredential[] = []

  if (scope.has('shell-rc')) out.push(...scanShellRc({ homeDir: home, platform }))
  if (scope.has('npm-global')) out.push(...scanNpmGlobal({ run: options.npmRun, platform }))
  if (scope.has('ai-tool-dir')) out.push(...scanAiToolDirs(home))
  if (scope.has('agent-config')) out.push(...scanAgentConfigResiduals(home, platform))
  if (scope.has('project-files') && options.projectPath) out.push(...scanProjectFiles(options.projectPath))

  return out
}

function scanAiToolDirs(home: string): ResidualCredential[] {
  const out: ResidualCredential[] = []
  for (const entry of AI_TOOL_ENTRIES) {
    const full = join(home, entry)
    const stat = statSync(full, { throwIfNoEntry: false })
    if (!stat) continue
    const location = normalizePath(full)
    if (stat.isFile()) {
      let text = ''
      try {
        text = readFileSync(full, 'utf8')
      } catch {
        text = ''
      }
      const secrets = scanText(text, location).filter((f) => f.category === 'secret')
      for (const secret of secrets) {
        out.push({
          id: residualId('ai-tool-dir', location, secret.line, secret.id),
          kind: 'api-key',
          severity: 'critical',
          surface: 'ai-tool-dir',
          location,
          path: full,
          line: secret.line,
          evidence: `${secret.title}: ${secret.evidence}`,
          recommendation: 'Remove the residual credential from the AI tool config and rotate it.',
        })
      }
    }
    out.push({
      id: residualId('ai-tool-dir', location),
      kind: 'config',
      severity: 'medium',
      surface: 'ai-tool-dir',
      location,
      path: full,
      evidence: `AI tool configuration present: ${location}`,
      recommendation: 'Remove the departing user’s AI tool configuration if offboarding.',
    })
  }
  return out
}

function agentConfigRoots(home: string, platform: NodeJS.Platform): string[] {
  const roots = [home]
  if (platform === 'win32') roots.push(join(home, 'AppData', 'Roaming', 'Claude'))
  else if (platform === 'darwin') roots.push(join(home, 'Library', 'Application Support', 'Claude'))
  else roots.push(join(home, '.config', 'Claude'))
  return roots.filter((root) => statSync(root, { throwIfNoEntry: false })?.isDirectory() === true)
}

function scanAgentConfigResiduals(home: string, platform: NodeJS.Platform): ResidualCredential[] {
  const out: ResidualCredential[] = []
  const seen = new Set<string>()
  for (const root of agentConfigRoots(home, platform)) {
    let report
    try {
      report = scanAgentPosture(root)
    } catch {
      continue
    }
    for (const finding of report.findings) {
      // Posture's "no agent-policy" note is not a residual credential.
      if (finding.id === 'agent-policy-missing') continue
      const fileRel = finding.file
      const absolute = fileRel ? join(root, fileRel) : undefined
      const location = absolute ? normalizePath(absolute) : `${finding.surface}`
      const isCredential = /credential|secret/i.test(finding.evidence)
      const id = residualId('agent-config', location, undefined, finding.id)
      if (seen.has(id)) continue
      seen.add(id)
      out.push({
        id,
        kind: isCredential ? 'api-key' : 'mcp-perm',
        severity: finding.severity,
        surface: 'agent-config',
        location,
        ...(absolute ? { path: absolute } : {}),
        evidence: `${finding.surface}: ${finding.evidence}`,
        recommendation: finding.recommendation,
      })
    }
  }
  return out
}

function scanProjectFiles(projectPath: string): ResidualCredential[] {
  let findings: Finding[]
  try {
    findings = scanFiles(projectPath)
  } catch {
    return []
  }
  return findings.map((finding) => residualFromFinding(projectPath, finding))
}

function residualFromFinding(projectRoot: string, finding: Finding): ResidualCredential {
  const location = finding.file ? normalizePath(finding.file) : finding.id
  const absolute = finding.file ? join(projectRoot, finding.file) : undefined
  const kind =
    finding.category === 'secret' || finding.category === 'sensitive-file'
      ? 'api-key'
      : finding.category === 'mcp-risk'
        ? 'mcp-perm'
        : 'config'
  return {
    id: residualId('project-file', location, finding.line, finding.id),
    kind,
    severity: finding.severity,
    surface: 'project-file',
    location,
    ...(absolute ? { path: absolute } : {}),
    ...(finding.line === undefined ? {} : { line: finding.line }),
    evidence: `${finding.title}: ${finding.evidence}`,
    recommendation: finding.recommendation,
  }
}
