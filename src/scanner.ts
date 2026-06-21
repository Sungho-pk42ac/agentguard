import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { DEFAULT_POLICY, type Finding, PII_PATTERNS, SECRET_PATTERNS, SENSITIVE_FILE_RE } from './rules.js'

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache'])
const MAX_FILE_BYTES = 512_000

export function walkFiles(root: string): string[] {
  const out: string[] = []
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (st.isFile() && st.size <= MAX_FILE_BYTES) out.push(full)
    }
  }
  walk(root)
  return out
}

export function scanText(text: string, file = 'stdin'): Finding[] {
  const findings: Finding[] = []
  for (const p of SECRET_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      findings.push({
        id: p.id,
        title: p.title,
        severity: 'critical',
        category: 'secret',
        file,
        evidence: redact(m[0]),
        recommendation: 'Remove the secret, rotate it, and load it from a secret manager or environment variable.',
      })
    }
  }
  for (const p of PII_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      findings.push({
        id: p.id,
        title: p.title,
        severity: p.id === 'email' ? 'medium' : 'high',
        category: 'pii',
        file,
        evidence: redact(m[0]),
        recommendation: 'Avoid logging or sending PII to agents/LLMs; pseudonymize or hash before use.',
      })
    }
  }
  for (const cmd of DEFAULT_POLICY.denyCommands) {
    if (text.includes(cmd)) {
      findings.push({
        id: 'denied-command',
        title: `Denied command pattern: ${cmd}`,
        severity: 'high',
        category: 'dangerous-command',
        file,
        evidence: cmd,
        recommendation: 'Require human approval or replace with a safer scoped command.',
      })
    }
  }
  return findings
}

export function scanFiles(root: string): Finding[] {
  const findings: Finding[] = []
  for (const file of walkFiles(root)) {
    const rel = relative(root, file)
    if (SENSITIVE_FILE_RE.test(rel)) {
      findings.push({
        id: 'sensitive-file-present',
        title: 'Sensitive credential file present in workspace',
        severity: 'critical',
        category: 'sensitive-file',
        file: rel,
        evidence: rel,
        recommendation: 'Remove from repository/workspace scans and ensure it is ignored by git.',
      })
      continue
    }
    if (/\.(png|jpg|jpeg|webp|gif|pdf|pptx|docx|hwpx|zip|sqlite|db)$/i.test(rel)) continue
    const text = readFileSync(file, 'utf8')
    findings.push(...scanText(text, rel))
  }
  return findings
}

export function scanDiff(diff: string): Finding[] {
  const added = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n')
  return scanText(added, 'diff')
}

export function scanMcpConfig(text: string): Finding[] {
  const findings: Finding[] = []
  const lowered = text.toLowerCase()
  const risky = ['filesystem', 'postgres', 'supabase', 'github', 'slack', 'google', 'drive']
  for (const name of risky) {
    if (lowered.includes(name)) {
      findings.push({
        id: `mcp-${name}`,
        title: `Potentially sensitive MCP integration: ${name}`,
        severity: ['postgres', 'supabase', 'filesystem'].includes(name) ? 'high' : 'medium',
        category: 'mcp-risk',
        evidence: name,
        recommendation: 'Scope MCP permissions to read-only/minimal resources and log all tool calls.',
      })
    }
  }
  if (lowered.includes('danger-full-access') || lowered.includes('full disk')) {
    findings.push({
      id: 'mcp-full-access',
      title: 'Full-access agent/MCP setting detected',
      severity: 'critical',
      category: 'mcp-risk',
      evidence: 'full access',
      recommendation: 'Use workspace-scoped access and require approval for destructive operations.',
    })
  }
  return findings
}

export function redact(s: string): string {
  if (s.length <= 8) return '<redacted>'
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}
