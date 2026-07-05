/**
 * Pure mapping logic from AgentGuard CLI findings (see the main package's
 * src/rules.ts `Finding` interface) to VS Code-shaped diagnostics. This file
 * MUST NOT import 'vscode' so it stays unit-testable outside a running editor.
 */

export type ScanFindingSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ScanFinding {
  severity: ScanFindingSeverity
  file?: string
  line?: number
  ruleId: string
  evidenceRedacted?: string
  recommendation?: string
  message?: string
}

export type DiagnosticSeverityName = 'Error' | 'Warning' | 'Information' | 'Hint'

export interface DiagnosticRange {
  startLine: number
  startChar: number
  endLine: number
  endChar: number
}

export interface MappedDiagnostic {
  file: string
  range: DiagnosticRange
  severity: DiagnosticSeverityName
  message: string
  source: 'AgentGuard'
  code: string
}

const SEVERITY_MAP: Record<ScanFindingSeverity, DiagnosticSeverityName> = {
  critical: 'Error',
  high: 'Error',
  medium: 'Warning',
  low: 'Information',
}

/** 1-based CLI finding line -> 0-based VS Code line, clamped to >= 0. Missing line -> 0. */
function toZeroBasedLine(line: number | undefined): number {
  if (line === undefined || line === null || Number.isNaN(line)) return 0
  const zeroBased = line - 1
  return zeroBased < 0 ? 0 : zeroBased
}

function composeMessage(finding: ScanFinding): string {
  const evidence = finding.evidenceRedacted ?? finding.message ?? ''
  const recommendation = finding.recommendation ?? ''
  return `${finding.ruleId}: ${evidence} — ${recommendation}`
}

export function findingToDiagnostic(finding: ScanFinding): MappedDiagnostic {
  const line = toZeroBasedLine(finding.line)
  return {
    file: finding.file ?? '',
    range: { startLine: line, startChar: 0, endLine: line, endChar: 0 },
    severity: SEVERITY_MAP[finding.severity],
    message: composeMessage(finding),
    source: 'AgentGuard',
    code: finding.ruleId,
  }
}

/**
 * Tolerant parser for the CLI's `agentguard scan-files --json` output, which is
 * a plain JSON array of the main package's Finding objects:
 *   { id, title, severity, category, file?, line?, evidence, recommendation, advisory? }
 * Maps the real field names (`id` -> ruleId, `evidence` -> evidenceRedacted) and
 * tolerates empty/malformed input by returning an empty array instead of throwing.
 */
export function parseScanJson(stdout: string): ScanFinding[] {
  if (!stdout || !stdout.trim()) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const findings: ScanFinding[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>

    const severity = raw.severity
    if (severity !== 'low' && severity !== 'medium' && severity !== 'high' && severity !== 'critical') continue

    const ruleId = typeof raw.id === 'string' ? raw.id : typeof raw.ruleId === 'string' ? raw.ruleId : undefined
    if (!ruleId) continue

    const file = typeof raw.file === 'string' ? raw.file : undefined
    const line = typeof raw.line === 'number' ? raw.line : undefined
    const evidenceRedacted = typeof raw.evidence === 'string' ? raw.evidence : typeof raw.evidenceRedacted === 'string' ? raw.evidenceRedacted : undefined
    const recommendation = typeof raw.recommendation === 'string' ? raw.recommendation : undefined
    const message = typeof raw.message === 'string' ? raw.message : undefined

    findings.push({ severity, file, line, ruleId, evidenceRedacted, recommendation, message })
  }

  return findings
}
