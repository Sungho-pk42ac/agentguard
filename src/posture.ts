import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { normalizePath, scanMcpConfig } from './scanner.js'

export interface PostureFinding {
  readonly id: string
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly surface: string
  readonly file?: string
  readonly evidence: string
  readonly recommendation: string
}

export interface PostureReport {
  readonly scannedPath: string
  readonly findingCount: number
  readonly findings: readonly PostureFinding[]
  readonly policyPresent: boolean
}

interface AgentConfigCandidate {
  readonly surface: string
  readonly path: string
}

const CANDIDATES: readonly AgentConfigCandidate[] = [
  { surface: 'claude mcp config', path: '.claude/mcp.json' },
  { surface: 'claude mcp config', path: '.mcp.json' },
  { surface: 'codex config', path: '.codex/config.json' },
  { surface: 'codex config', path: '.codex/config.toml' },
  { surface: 'gemini mcp config', path: '.gemini/settings.json' },
  { surface: 'gemini mcp config', path: '.gemini/settings.toml' },
  { surface: 'mcp config', path: 'mcp.json' },
]

const POLICY_FILES = ['agent-policy.yaml', 'agent-policy.yml', 'agent-policy.json']

export function scanAgentPosture(scannedPath: string): PostureReport {
  const rootStat = statSync(scannedPath)
  if (!rootStat.isDirectory()) {
    const error = new Error('posture path is not a directory') as NodeJS.ErrnoException
    error.code = 'ENOTDIR'
    throw error
  }

  const findings: PostureFinding[] = []
  const policyPresent = POLICY_FILES.some((file) => existsSync(join(scannedPath, file)))

  if (!policyPresent) {
    findings.push({
      id: 'agent-policy-missing',
      severity: 'medium',
      surface: 'policy guardrail',
      evidence: 'agent-policy.yaml|yml|json not found',
      recommendation: 'Add an agent-policy.yaml/json file to pin denied reads, denied commands, and approval-required operations.',
    })
  }

  for (const candidate of existingCandidates(scannedPath)) {
    const text = readFileSync(candidate.path, 'utf8')
    findings.push(...postureFindingsForConfig(scannedPath, candidate, text))
  }

  return {
    scannedPath,
    findingCount: findings.length,
    findings,
    policyPresent,
  }
}

export function postureReportToText(report: PostureReport): string {
  const lines = ['AgentGuard agent posture']
  if (report.policyPresent) lines.push('PASS policy guardrail - agent-policy found')
  for (const finding of report.findings) {
    lines.push(`REVIEW ${finding.surface} - ${finding.evidence}${finding.file ? ` (${finding.file})` : ''}`)
  }
  if (report.findings.length === 0) lines.push('No agent posture risks found')
  return lines.join('\n')
}

function existingCandidates(root: string): AgentConfigCandidate[] {
  const seen = new Set<string>()
  const candidates: AgentConfigCandidate[] = []
  for (const candidate of CANDIDATES) {
    const fullPath = join(root, candidate.path)
    if (seen.has(fullPath)) continue
    if (statSync(fullPath, { throwIfNoEntry: false })?.isFile() !== true) continue
    seen.add(fullPath)
    candidates.push({ surface: candidate.surface, path: fullPath })
  }
  return candidates
}

function postureFindingsForConfig(root: string, candidate: AgentConfigCandidate, text: string): PostureFinding[] {
  const file = normalizePath(relative(root, candidate.path)) || basename(candidate.path)
  const findings: PostureFinding[] = []
  const mcpFindings = scanMcpConfig(text)
  for (const finding of mcpFindings) {
    if (finding.id === 'mcp-filesystem-wide-root') {
      findings.push({
        id: 'agent-broad-filesystem-root',
        severity: 'critical',
        surface: candidate.surface,
        file,
        evidence: 'broad filesystem root',
        recommendation: 'Restrict agent filesystem roots to the repository or a dedicated read-only working directory.',
      })
    }
    if (finding.id === 'mcp-filesystem-writable-path') {
      findings.push({
        id: 'agent-writable-filesystem-path',
        severity: 'high',
        surface: candidate.surface,
        file,
        evidence: 'writable filesystem path',
        recommendation: 'Prefer read-only roots and require explicit approval before write-capable agent tools run.',
      })
    }
    if (finding.id === 'mcp-env-token') {
      findings.push({
        id: 'agent-credential-env',
        severity: 'high',
        surface: candidate.surface,
        file,
        evidence: 'credential env [REDACTED]',
        recommendation: 'Use least-privilege scoped tokens, avoid broad env passthrough, and rotate credentials after agent sessions.',
      })
    }
    if (finding.id === 'mcp-full-access') {
      findings.push({
        id: 'agent-full-access',
        severity: 'critical',
        surface: candidate.surface,
        file,
        evidence: 'full-access agent setting',
        recommendation: 'Disable full-access agent modes; use scoped workspace access and require approval for destructive operations.',
      })
    }
    if (finding.category === 'secret') {
      findings.push({
        id: 'agent-credential-secret',
        severity: 'critical',
        surface: candidate.surface,
        file,
        evidence: 'credential value [REDACTED]',
        recommendation: 'Remove inline credentials from agent-visible config, rotate the secret, and inject scoped credentials only at runtime.',
      })
    }
  }
  if (hasInlineCredentialValue(text)) {
    findings.push({
      id: 'agent-credential-secret',
      severity: 'critical',
      surface: candidate.surface,
      file,
      evidence: 'credential value [REDACTED]',
      recommendation: 'Remove inline credentials from agent-visible config, rotate the secret, and inject scoped credentials only at runtime.',
    })
  }
  return dedupeFindings(findings)
}

function hasInlineCredentialValue(text: string): boolean {
  return /["']?[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*["']?\s*[:=]\s*["'][^"'\n]{12,}["']/i.test(text)
}

function dedupeFindings(findings: readonly PostureFinding[]): PostureFinding[] {
  const out: PostureFinding[] = []
  const seen = new Set<string>()
  for (const finding of findings) {
    const key = `${finding.id}:${finding.surface}:${finding.file}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(finding)
  }
  return out
}
