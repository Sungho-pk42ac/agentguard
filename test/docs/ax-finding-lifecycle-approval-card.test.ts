import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-finding-lifecycle-approval-card.md')

const requiredHeadings = [
  '# AX finding lifecycle approval card',
  '## 사용 목적',
  '## Finding → evidence → owner → condition → rerun → approval',
  '## 승인 카드 템플릿',
  '## Fixture-backed commands',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract preservation',
  '## Non-claim guardrails',
] as const

const fixtureBackedCommands = [
  {
    command: 'agentguard scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'agentguard scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'agentguard scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command: 'agentguard scan-log --policy examples/agent-policy.yaml --json < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command: 'approval report',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/expected-approval-report.md'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/llmrisk/llm01-prompt-injection/',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://github.com/splx-ai/agentic-radar',
  'https://github.com/tencent/AI-Infra-Guard',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX finding lifecycle approval card exists and is linked from operator-facing docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-finding-lifecycle-approval-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX finding lifecycle approval card\]\(docs\/ax-finding-lifecycle-approval-card\.md\)/)
  assert.match(examplesReadme, /\[AX finding lifecycle approval card\]\(\.\.\/docs\/ax-finding-lifecycle-approval-card\.md\)/)
  assert.match(examplesDoc, /\[AX finding lifecycle approval card\]\(ax-finding-lifecycle-approval-card\.md\)/)
})

test('AX finding lifecycle approval card contains Korean-first lifecycle sections', () => {
  const card = readCard()

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)
  assert.match(card, /finding\s*→\s*source evidence\s*→\s*owner\s*→\s*fix\/policy condition\s*→\s*rerun command\/artifact\s*→\s*approval decision/i)

  for (const term of ['finding', 'source evidence', 'owner', 'fix/policy condition', 'rerun command/artifact', 'approval decision'] as const) {
    expectLiteral(card, term)
  }
})

test('AX finding lifecycle approval card uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  for (const artifact of ['agentguard.sarif', 'JSON', 'SARIF', 'approval report'] as const) {
    expectLiteral(card, artifact)
  }
})

test('AX finding lifecycle approval card cites public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP LLM Top 10/)
  assert.match(card, /MCP security best practices/)
  assert.match(card, /GitHub SARIF/)
  assert.match(card, /agentic-radar/)
  assert.match(card, /AI-Infra-Guard/)
})

test('AX finding lifecycle approval card preserves machine contracts and fake-claim guardrails', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'agent.dangerous_command',
    'JSON',
    'SARIF',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  assert.doesNotMatch(card, /runtime\s+MCP\s+enforcement|MCP\s+서버를\s*(?:시작|제어|강제)|starts?\s+MCP\s+servers?|controls?\s+MCP\s+servers?/i)
  assert.doesNotMatch(card, /automatic\s+(?:approval|upload|triage)|자동\s*(?:승인|업로드|triage|분류)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /OWASP[^\r\n|.]{0,80}(?:certified|certification|인증|verified|approved|공식\s*검증)/i)
  assert.doesNotMatch(card, /(?:agentic-radar|AI-Infra-Guard|GitHub|SARIF)[^\r\n|.]{0,80}(?:replacement|parity|동등|대체|공식\s*검증|검증\s*완료|인증\s*완료)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security|보안)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
