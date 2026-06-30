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
  readonly properties: {
    readonly 'security-severity': string
    readonly precision: 'high'
    readonly tags: readonly ['security', 'agentguard']
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
          readonly informationUri: 'https://github.com/Sungho-pk42ac/agentguard'
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

export type MarkdownLanguage = 'ko' | 'en'

interface MarkdownOptions {
  readonly lang?: MarkdownLanguage
  readonly title?: string
}

export function toMarkdown(findings: Finding[], options: MarkdownOptions | string = {}): string {
  const markdownOptions = typeof options === 'string' ? { title: options, lang: 'en' as const } : options
  const lang = markdownOptions.lang ?? 'ko'
  const sorted = [...findings].sort((a, b) => severityScore(b.severity) - severityScore(a.severity))
  const score = riskScore(sorted)
  const verdict = score === 0 ? 'PASS' : score >= 8 ? 'BLOCK' : 'REVIEW'
  const title = markdownOptions.title ?? (lang === 'ko' ? 'AgentGuard 위험 리포트' : 'AgentGuard Risk Report')
  const lines = [
    `# ${title}`,
    '',
    lang === 'ko' ? `**판정:** ${verdict}` : `**Verdict:** ${verdict}`,
    lang === 'ko' ? `**위험 점수:** ${score}` : `**Risk score:** ${score}`,
    lang === 'ko' ? `**탐지 건수:** ${sorted.length}` : `**Findings:** ${sorted.length}`,
    '',
  ]
  if (!sorted.length) {
    lines.push(lang === 'ko' ? '위험한 에이전트 동작, 비밀 값, PII, 고위험 MCP 패턴이 탐지되지 않았습니다.' : 'No risky agent behavior, secrets, PII, or high-risk MCP patterns were detected.')
    return lines.join('\n')
  }
  lines.push(
    lang === 'ko' ? '| 심각도 | 분류 | 파일 | 탐지 내용 | 증거 |' : '| Severity | Category | File | Finding | Evidence |',
    '|---|---|---|---|---|',
  )
  for (const f of sorted) {
    lines.push(`| ${f.severity} | ${f.category} | ${f.file ?? '-'} | ${escapePipe(localizeTitle(f, lang))} | \`${escapePipe(f.evidence)}\` |`)
  }
  lines.push('', lang === 'ko' ? '## 권장 조치' : '## Recommendations')
  for (const f of sorted) lines.push(`- **${localizeTitle(f, lang)}:** ${localizeRecommendation(f, lang)}`)
  return lines.join('\n')
}

function localizeTitle(finding: Finding, lang: MarkdownLanguage): string {
  if (lang === 'en') return finding.title
  const exact: Record<string, string> = {
    'openai-key': 'OpenAI 형식 API 키',
    'anthropic-api-key': 'Anthropic API 키',
    'github-token': 'GitHub 토큰',
    'npm-token': 'npm access token',
    'google-api-key': 'Google API 키',
    'aws-access-key': 'AWS access key id',
    'private-key': 'Private key block',
    'generic-secret-assignment': '하드코딩된 secret assignment',
    'pii-kr-phone': '한국 전화번호',
    'pii-email': '이메일 주소',
    'pii-kr-rrn-like': '주민등록번호 형식으로 보이는 값',
    'sensitive-file': '민감한 credential 파일이 workspace에 존재함',
    'policy-denied-read': '정책상 금지된 read path가 workspace에 존재함',
    'mcp-full-access': 'Full-access agent/MCP 설정이 감지됨',
    'mcp-filesystem-wide-root': 'MCP filesystem 서버가 넓은 root path를 노출함',
    'mcp-filesystem-writable-path': 'MCP filesystem 서버가 writable path를 허용함',
    'mcp-env-token': 'MCP 서버가 credential-like 환경 변수를 전달받음',
  }
  if (exact[finding.id]) return exact[finding.id]
  const deniedCommand = finding.title.match(/^Denied command pattern: (.+)$/)
  if (deniedCommand) return `금지된 command pattern: ${deniedCommand[1]}`
  const approvalOperation = finding.title.match(/^Approval-required operation: (.+)$/)
  if (approvalOperation) return `승인이 필요한 operation: ${approvalOperation[1]}`
  const sensitiveMcp = finding.title.match(/^Potentially sensitive MCP integration: (.+)$/)
  if (sensitiveMcp) return `민감할 수 있는 MCP integration: ${sensitiveMcp[1]}`
  const deniedMcpTool = finding.title.match(/^MCP tool denied by policy: (.+)$/)
  if (deniedMcpTool) return `정책상 금지된 MCP tool: ${deniedMcpTool[1]}`
  const approvalMcpTool = finding.title.match(/^MCP tool requires approval: (.+)$/)
  if (approvalMcpTool) return `승인이 필요한 MCP tool: ${approvalMcpTool[1]}`
  return finding.title
}

function localizeRecommendation(finding: Finding, lang: MarkdownLanguage): string {
  if (lang === 'en') return finding.recommendation
  const exact: Record<string, string> = {
    'Remove the secret, rotate it, and load it from a secret manager or environment variable.': '비밀 값을 제거하고 회전한 뒤 secret manager나 환경 변수에서 불러오세요.',
    'Avoid logging or sending PII to agents/LLMs; pseudonymize or hash before use.': 'PII를 agent/LLM 로그나 입력으로 보내지 말고, 사용 전 가명화하거나 해시 처리하세요.',
    'Require human approval or replace with a safer scoped command.': '사람의 승인을 요구하거나 더 안전하게 scope가 제한된 command로 대체하세요.',
    'Require explicit human approval before running this operation.': '이 작업을 실행하기 전에 명시적인 사람 승인을 요구하세요.',
    'Exclude this path from agent-readable workspace scans.': '이 경로를 agent가 읽을 수 있는 workspace scan 범위에서 제외하세요.',
    'Remove from repository/workspace scans and ensure it is ignored by git.': 'repository/workspace scan 범위에서 제거하고 git ignore가 적용됐는지 확인하세요.',
    'Scope MCP permissions to read-only/minimal resources and log all tool calls.': 'MCP 권한을 read-only/minimal resource로 제한하고 모든 tool call을 기록하세요.',
    'Remove this MCP tool from the agent configuration or isolate it behind a separate approval workflow.': '이 MCP tool을 agent 설정에서 제거하거나 별도 승인 workflow 뒤로 격리하세요.',
    'Require explicit human approval before allowing this MCP tool call.': '이 MCP tool call을 허용하기 전에 명시적인 사람 승인을 요구하세요.',
    'Use workspace-scoped access and require approval for destructive operations.': 'workspace 범위 access를 사용하고 destructive operation에는 승인을 요구하세요.',
    'Restrict filesystem MCP roots to the repository or a dedicated read-only working directory.': 'filesystem MCP root를 repository나 전용 read-only 작업 디렉터리로 제한하세요.',
    'Prefer read-only filesystem MCP roots and require approval for write-capable paths.': 'read-only filesystem MCP root를 우선 사용하고 write-capable path에는 승인을 요구하세요.',
    'Use least-privilege tokens, avoid write scopes, and rotate credentials after agent sessions.': '최소 권한 token을 사용하고 write scope를 피하며 agent session 후 credential을 회전하세요.',
  }
  return exact[finding.recommendation] ?? finding.recommendation
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
            informationUri: 'https://github.com/Sungho-pk42ac/agentguard',
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
      properties: {
        'security-severity': sarifSecuritySeverity(finding),
        precision: 'high',
        tags: ['security', 'agentguard'],
      },
    })
  }
  return rules
}

function sarifSecuritySeverity(finding: Finding): string {
  switch (finding.severity) {
    case 'critical':
      return '9.0'
    case 'high':
      return '7.0'
    case 'medium':
      return '5.0'
    case 'low':
      return '3.0'
  }
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
