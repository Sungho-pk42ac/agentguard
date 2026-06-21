import { type Finding, severityScore } from './rules.js'

export function riskScore(findings: Finding[]): number {
  return findings.reduce((sum, f) => sum + severityScore(f.severity), 0)
}

export function toMarkdown(findings: Finding[], title = 'AgentGuard Risk Report'): string {
  const sorted = [...findings].sort((a, b) => severityScore(b.severity) - severityScore(a.severity))
  const score = riskScore(sorted)
  const verdict = score === 0 ? 'PASS' : score >= 8 ? 'BLOCK' : 'REVIEW'
  const lines = [`# ${title}`, '', `**Verdict:** ${verdict}`, `**Risk score:** ${score}`, `**Findings:** ${sorted.length}`, '']
  if (!sorted.length) {
    lines.push('No risky agent behavior, secrets, PII, or high-risk MCP patterns were detected.')
    return lines.join('\n')
  }
  lines.push('| Severity | Category | File | Finding | Evidence |', '|---|---|---|---|---|')
  for (const f of sorted) {
    lines.push(`| ${f.severity} | ${f.category} | ${f.file ?? '-'} | ${escapePipe(f.title)} | \`${escapePipe(f.evidence)}\` |`)
  }
  lines.push('', '## Recommendations')
  for (const f of sorted) lines.push(`- **${f.title}:** ${f.recommendation}`)
  return lines.join('\n')
}

function escapePipe(s: string): string {
  return s.replaceAll('|', '\\|').replaceAll('\n', ' ')
}
