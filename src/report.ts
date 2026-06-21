import { type Finding, severityScore } from './rules.js'

type SarifLevel = 'note' | 'warning' | 'error'

type SarifReportingDescriptor = {
  readonly id: string
  readonly name: string
  readonly shortDescription: {
    readonly text: string
  }
  readonly help: {
    readonly text: string
  }
}

type SarifResult = {
  readonly ruleId: string
  readonly level: SarifLevel
  readonly message: {
    readonly text: string
  }
  readonly locations: readonly [
    {
      readonly physicalLocation: {
        readonly artifactLocation: {
          readonly uri: string
        }
        readonly region?: {
          readonly startLine: number
        }
      }
    },
  ]
}

type SarifLog = {
  readonly version: '2.1.0'
  readonly $schema: 'https://json.schemastore.org/sarif-2.1.0.json'
  readonly runs: readonly [
    {
      readonly tool: {
        readonly driver: {
          readonly name: 'AgentGuard'
          readonly informationUri: 'https://github.com/agentguard/agentguard'
          readonly rules: readonly SarifReportingDescriptor[]
        }
      }
      readonly results: readonly SarifResult[]
    },
  ]
}

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

export function toSarif(findings: Finding[]): string {
  const log: SarifLog = {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'AgentGuard',
            informationUri: 'https://github.com/agentguard/agentguard',
            rules: sarifRules(findings),
          },
        },
        results: findings.map(toSarifResult),
      },
    ],
  }
  return JSON.stringify(log, null, 2)
}

function sarifRules(findings: Finding[]): SarifReportingDescriptor[] {
  const rules: SarifReportingDescriptor[] = []
  for (const finding of findings) {
    if (rules.some((rule) => rule.id === finding.id)) continue
    rules.push({
      id: finding.id,
      name: finding.category,
      shortDescription: { text: finding.title },
      help: { text: finding.recommendation },
    })
  }
  return rules
}

function toSarifResult(finding: Finding): SarifResult {
  return {
    ruleId: finding.id,
    level: sarifLevel(finding),
    message: {
      text: `${finding.title}: ${finding.recommendation} Evidence: ${finding.evidence}`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.file ?? 'stdin',
          },
          ...(finding.line ? { region: { startLine: finding.line } } : {}),
        },
      },
    ],
  }
}

function sarifLevel(finding: Finding): SarifLevel {
  switch (finding.severity) {
    case 'critical':
    case 'high':
      return 'error'
    case 'medium':
      return 'warning'
    case 'low':
      return 'note'
  }
}
