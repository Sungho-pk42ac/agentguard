import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { scanStructuredMcpConfig } from './mcp-structured-scan.js'
import { DEFAULT_POLICY, type Finding, PII_PATTERNS, type Policy, SECRET_PATTERNS, SENSITIVE_FILE_RE } from './rules.js'

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.cache'])
export const MAX_FILE_BYTES = 512_000
const MCP_WIDE_FILESYSTEM_ROOT_RE =
  /["']?(?:root|roots|args|allow(?:ed)?_directories|directories|paths?)["']?\s*[:=]\s*(?:\[[^\]]*?(?:"\/"|'\/'|[A-Za-z]:[\\/](?=["'\],\s]))|(?:"\/"|'\/'|[A-Za-z]:[\\/](?=["'\],\s])))/i
const MCP_WRITABLE_PATH_RE =
  /["']?(?:root|roots|args|allow(?:ed)?_directories|directories|paths?)["']?\s*[:=]\s*\[[^\]]*?(?:"--(?:allow-write|writable)(?:=[^"]*)?"|'--(?:allow-write|writable)(?:=[^']*)?'|--(?:allow-write|writable)(?:=\S*)?)/i
const MCP_ENV_TOKEN_RE = /(?:^|\n)\s*[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=/i

export function walkFiles(root: string): string[] {
  const out: string[] = []
  function walk(dir: string, isRoot: boolean) {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch (error) {
      // A missing/not-a-dir/unreadable ROOT is a real error the caller reports;
      // an unreadable NESTED dir (e.g. Windows-protected home subdirs) is skipped
      // so one locked entry never aborts the whole scan.
      if (isRoot) throw error
      return
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      let st: ReturnType<typeof statSync>
      try {
        if (lstatSync(full).isSymbolicLink()) continue
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(full, false)
      else if (st.isFile() && st.size <= MAX_FILE_BYTES) out.push(full)
    }
  }
  walk(root, true)
  return out
}

export function scanText(text: string, file = 'stdin', policy: Policy = DEFAULT_POLICY): Finding[] {
  const findings: Finding[] = []
  for (const p of SECRET_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      if (p.id === 'generic-secret-assignment' && /(?<![0-9A-Za-z_])npm_[A-Za-z0-9]{36}(?![0-9A-Za-z_])/.test(m[0])) continue
      findings.push({
        id: p.id,
        title: p.title,
        severity: 'critical',
        category: 'secret',
        file,
        line: lineAt(text, m.index ?? 0),
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
        line: lineAt(text, m.index ?? 0),
        evidence: redact(m[0]),
        recommendation: 'Avoid logging or sending PII to agents/LLMs; pseudonymize or hash before use.',
      })
    }
  }
  for (const cmd of policy.denyCommands) {
    const index = text.indexOf(cmd)
    if (index !== -1) {
      const displayCommand = redactPolicyValue(cmd)
      findings.push({
        id: 'denied-command',
        title: `Denied command pattern: ${displayCommand}`,
        severity: 'high',
        category: 'dangerous-command',
        file,
        line: lineAt(text, index),
        evidence: displayCommand,
        recommendation: 'Require human approval or replace with a safer scoped command.',
      })
    }
  }
  for (const operation of policy.requireApproval) {
    const index = text.indexOf(operation)
    if (index !== -1) {
      const displayOperation = redactPolicyValue(operation)
      findings.push({
        id: 'approval-required',
        title: `Approval-required operation: ${displayOperation}`,
        severity: 'medium',
        category: 'agent-behavior',
        file,
        line: lineAt(text, index),
        evidence: displayOperation,
        recommendation: 'Require explicit human approval before running this operation.',
      })
    }
  }
  return findings
}

// 매치 위치(index)를 1-based 라인 번호로 변환한다 (SARIF region.startLine용)
function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

export function scanFiles(root: string, policy: Policy = DEFAULT_POLICY): Finding[] {
  const findings: Finding[] = []
  for (const file of walkFiles(root)) {
    const rel = normalizePath(relative(root, file))
    if (matchesPolicyPattern(rel, policy.denyRead)) {
      findings.push({
        id: 'denied-read-path',
        title: 'Policy-denied read path present in workspace',
        severity: 'critical',
        category: 'sensitive-file',
        file: rel,
        evidence: rel,
        recommendation: 'Exclude this path from agent-readable workspace scans.',
      })
      continue
    }
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
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    findings.push(...scanText(text, rel, policy))
  }
  return findings
}

const MAX_TRANSCRIPT_DEPTH = 8

// Codex/Hermes 스타일 JSONL 에이전트 트랜스크립트를 인식해 원문(raw) 스캔에 더해
// 각 줄을 JSON으로 디코딩한 문자열 값도 함께 스캔한다. JSON 이스케이프(예: \uXXXX)가
// 평문 정규식의 문자 클래스를 끊어놓는 경우를 잡아낸다. JSONL이 아니면 원문 스캔과
// 완전히 동일한 결과를 돌려준다(평문 입력은 오늘과 바이트 단위로 동일해야 함).
export function scanTranscript(text: string, file = 'agent-log', policy: Policy = DEFAULT_POLICY): Finding[] {
  const rawFindings = scanText(text, file, policy)
  const objects = parseJsonl(text)
  if (!objects) return rawFindings

  const strings: string[] = []
  for (const obj of objects) collectStrings(obj, 0, strings)
  if (strings.length === 0) return rawFindings

  const decodedFindings = scanText(strings.join('\n'), file, policy)
  const seen = new Set(rawFindings.map((f) => `${f.id}:${f.evidence}`))
  const extra = decodedFindings.filter((f) => !seen.has(`${f.id}:${f.evidence}`))
  return [...rawFindings, ...extra]
}

// 비어있지 않은 모든 줄이 JSON 객체로 파싱되면 그 객체 배열을 반환하고, 아니면 null(= JSONL 아님)
function parseJsonl(text: string): unknown[] | null {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length === 0) return null

  const objects: unknown[] = []
  for (const line of lines) {
    if (!line.startsWith('{')) return null
    try {
      const parsed: unknown = JSON.parse(line)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      objects.push(parsed)
    } catch {
      return null
    }
  }
  return objects
}

// depth 상한을 두고 재귀적으로 모든 문자열 값을 수집한다 (필드명은 가리지 않는다: content/text/message 등 전부 포함)
function collectStrings(value: unknown, depth: number, out: string[]): void {
  if (depth > MAX_TRANSCRIPT_DEPTH) return
  if (typeof value === 'string') {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, depth + 1, out)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, depth + 1, out)
  }
}

export function scanDiff(diff: string, policy: Policy = DEFAULT_POLICY): Finding[] {
  const chunks = addedDiffChunks(diff)
  const added = chunks.join('\n')
  const findings = scanText(added, 'diff', policy)
  for (const chunk of chunks) {
    findings.push(...structuredMcpRiskFindings(chunk, 'diff'))
  }
  return findings
}

function addedDiffChunks(diff: string): string[] {
  // Structured MCP parsing is context-sensitive: do not let an `args` key from one
  // file or hunk combine with root/write tokens from another unrelated diff chunk.
  // This intentionally favors fewer false positives over reconstructing configs
  // across distant hunks.
  const chunks: string[] = []
  let current: string[] = []
  const lines = diff.split('\n')
  let inHunk = !lines.some((line) => line.startsWith('diff --git ') || line.startsWith('@@ '))

  function flush(): void {
    if (current.length === 0) return
    chunks.push(current.join('\n'))
    current = []
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flush()
      inHunk = false
      continue
    }
    if (line.startsWith('@@ ')) {
      flush()
      inHunk = true
      continue
    }
    if (inHunk && line.startsWith('+')) current.push(line.slice(1).replace(/\r$/, ''))
  }

  flush()
  return chunks
}

export function scanMcpConfig(text: string, policy: Policy = DEFAULT_POLICY): Finding[] {
  const findings: Finding[] = scanText(text, 'mcp-config', policy)
  const lowered = text.toLowerCase()
  for (const name of policy.mcp.denyServers) {
    if (lowered.includes(name)) {
      const displayName = redactPolicyValue(name)
      findings.push({
        id: `mcp-${displayName === name ? name : 'redacted'}`,
        title: `Potentially sensitive MCP integration: ${displayName}`,
        severity: ['postgres', 'supabase', 'filesystem'].includes(name) ? 'high' : 'medium',
        category: 'mcp-risk',
        evidence: displayName,
        recommendation: 'Scope MCP permissions to read-only/minimal resources and log all tool calls.',
      })
    }
  }
  for (const tool of policy.mcp.denyTools) {
    if (lowered.includes(tool.toLowerCase())) {
      const displayTool = redactPolicyValue(tool)
      findings.push({
        id: 'mcp-tool-denied',
        title: `MCP tool denied by policy: ${displayTool}`,
        severity: 'critical',
        category: 'mcp-risk',
        file: 'mcp-config',
        evidence: displayTool,
        recommendation: 'Remove this MCP tool from the agent configuration or isolate it behind a separate approval workflow.',
      })
    }
  }
  for (const tool of policy.mcp.requireApprovalTools) {
    if (lowered.includes(tool.toLowerCase())) {
      const displayTool = redactPolicyValue(tool)
      findings.push({
        id: 'mcp-tool-approval-required',
        title: `MCP tool requires approval: ${displayTool}`,
        severity: 'high',
        category: 'mcp-risk',
        file: 'mcp-config',
        evidence: displayTool,
        recommendation: 'Require explicit human approval before allowing this MCP tool call.',
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
  findings.push(...structuredMcpRiskFindings(text, 'mcp-config'))
  return findings
}

function structuredMcpRiskFindings(text: string, file: string): Finding[] {
  const findings: Finding[] = []
  const structured = scanStructuredMcpConfig(text)

  if (structured.hasWideFilesystemRoot || MCP_WIDE_FILESYSTEM_ROOT_RE.test(text)) {
    findings.push({
      id: 'mcp-filesystem-wide-root',
      title: 'MCP filesystem server exposes a broad root path',
      severity: 'critical',
      category: 'mcp-risk',
      file,
      evidence: 'filesystem root',
      recommendation: 'Restrict filesystem MCP roots to the repository or a dedicated read-only working directory.',
    })
  }
  if (structured.hasWritablePath || MCP_WRITABLE_PATH_RE.test(text)) {
    findings.push({
      id: 'mcp-filesystem-writable-path',
      title: 'MCP filesystem server allows writable paths',
      severity: 'high',
      category: 'mcp-risk',
      file,
      evidence: 'writable filesystem path',
      recommendation: 'Prefer read-only filesystem MCP roots and require approval for write-capable paths.',
    })
  }
  if (structured.hasCredentialEnv || MCP_ENV_TOKEN_RE.test(text)) {
    findings.push({
      id: 'mcp-env-token',
      title: 'MCP server receives credential-like environment variables',
      severity: 'high',
      category: 'mcp-risk',
      file,
      evidence: 'credential env',
      recommendation: 'Use least-privilege tokens, avoid write scopes, and rotate credentials after agent sessions.',
    })
  }
  return findings
}

export function redact(s: string): string {
  if (s.length <= 8) return '<redacted>'
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

function redactPolicyValue(value: string): string {
  let redacted = value
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern.re, (match) => redact(match))
  }
  return redacted
}

function matchesPolicyPattern(path: string, patterns: readonly string[]): boolean {
  const normalizedPath = normalizePath(path)
  return patterns.some((pattern) => globToRegExp(normalizePath(pattern)).test(normalizedPath))
}

// Windows의 백슬래시 경로를 리포트/글롭 매칭용 슬래시 경로로 통일한다
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const globbed = escaped.replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*')
  const rootAwareGlobbed = globbed.replace(/^\.\*\//, '(?:.*/)?')
  return new RegExp(`(^|/)${rootAwareGlobbed}$`)
}
