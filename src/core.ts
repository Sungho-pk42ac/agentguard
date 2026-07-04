import { riskScore, toMarkdown, type MarkdownLanguage } from './report.js'
import { scanDiff, scanFiles, scanMcpConfig, scanText, scanTranscript } from './scanner.js'
import { DEFAULT_POLICY, type Finding, type Policy } from './rules.js'

export type ScanMode = 'diff' | 'mcp' | 'log' | 'text'
export type ScanVerdict = 'PASS' | 'REVIEW' | 'BLOCK'

export interface ScanResult {
  readonly verdict: ScanVerdict
  readonly findingCount: number
  readonly findings: readonly Finding[]
  readonly markdown: string
}

interface ScanOptions {
  readonly lang?: MarkdownLanguage
  readonly policy?: Policy
}

interface CliScanOptions {
  readonly input: string
  readonly workspacePath?: string
  readonly policy?: Policy
}

export function scanInput(mode: ScanMode, input: string, options: ScanOptions = {}): ScanResult {
  const policy = options.policy ?? DEFAULT_POLICY
  const findings = scanByMode(mode, input, policy)
  return scanResult(findings, options.lang ?? 'ko')
}

export function scanCliCommand(command: string, options: CliScanOptions): Finding[] {
  const policy = options.policy ?? DEFAULT_POLICY
  switch (command) {
    case 'scan-files':
      return scanFiles(options.workspacePath ?? process.cwd(), policy)
    case 'scan-diff':
      return scanByMode('diff', options.input, policy)
    case 'scan-log':
      return scanByMode('log', options.input, policy)
    case 'scan-mcp':
      return scanByMode('mcp', options.input, policy)
    case 'report':
      return scanByMode('text', options.input, policy)
    default:
      return []
  }
}

export function verdictForFindings(findings: readonly Finding[]): ScanVerdict {
  const score = riskScore([...findings])
  if (score === 0) return 'PASS'
  return score >= 8 ? 'BLOCK' : 'REVIEW'
}

function scanByMode(mode: ScanMode, input: string, policy: Policy): Finding[] {
  switch (mode) {
    case 'diff':
      return scanDiff(input, policy)
    case 'mcp':
      return scanMcpConfig(input, policy)
    case 'log':
      return scanTranscript(input, 'agent-log', policy)
    case 'text':
      return scanText(input, 'stdin', policy)
  }
}

function scanResult(findings: readonly Finding[], lang: MarkdownLanguage): ScanResult {
  return {
    verdict: verdictForFindings(findings),
    findingCount: findings.length,
    findings,
    markdown: toMarkdown([...findings], { lang }),
  }
}
