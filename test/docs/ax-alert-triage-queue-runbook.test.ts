import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const runbookPath = join(repoRoot, 'docs', 'ax-alert-triage-queue-runbook.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
  },
] as const

const publicReferenceUrls = [
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
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

function readRunbook(): string {
  return readFileSync(runbookPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX alert triage queue runbook exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(runbookPath), 'docs/ax-alert-triage-queue-runbook.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  assert.match(rootReadme, /\[AX alert triage queue runbook\]\(docs\/ax-alert-triage-queue-runbook\.md\)/)
  assert.match(examplesDoc, /\[AX alert triage queue runbook\]\(ax-alert-triage-queue-runbook\.md\)/)
})

test('AX alert triage queue runbook contains Korean-first owner decision sections', () => {
  const runbook = readRunbook()
  const requiredHeadings = [
    '## 사용 목적',
    '## Alert queue triage card',
    '## Command execution boundary',
    '## Decision owner handoff',
    '## Rerun evidence trigger',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const

  assert.match(runbook, /^# AX alert triage queue runbook/m)
  assert.match(runbook, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(runbook, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    'alert queue owner',
    'decision owner',
    'expected verdict',
    'rerun trigger',
    'finding',
    'reviewer handoff',
    'static pre-rollout evidence command',
    'PowerShell',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(runbook, term)
  }
})

test('AX alert triage queue runbook uses exact existing fixture-backed commands', () => {
  const runbook = readRunbook()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(runbook, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(runbook, fixturePath)
    }
  }

  assert.match(runbook, /커머스 VOC/)
  assert.match(runbook, /MCP/)
  assert.match(runbook, /PR diff/)
  assert.match(runbook, /transcript\/log/)
})

test('AX alert triage queue runbook cites public references with borrow avoid action notes', () => {
  const runbook = readRunbook()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(runbook, referenceUrl)
  }

  assert.match(runbook, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(runbook, /빌릴 점|Borrow/i)
  assert.match(runbook, /피할 점|Avoid/i)
  assert.match(runbook, /AgentGuard action|조치/i)
})

test('AX alert triage queue runbook preserves English-compatible machine contracts', () => {
  const runbook = readRunbook()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'machine fields',
    'mcp.broad_filesystem_access',
    'generic-secret-assignment',
  ] as const) {
    expectLiteral(runbook, contract)
  }

  assert.doesNotMatch(runbook, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX alert triage queue runbook bans unsupported auth SaaS adoption and parity claims', () => {
  const runbook = readRunbook()

  assert.doesNotMatch(runbook, /실제\s*고객|실고객|고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(runbook, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(runbook, /(?:OAuth|authorization server|consent UI|runtime auth|런타임 인증)[^\n]*(?:구현|제공|enforce|available|지원)/i)
  assert.doesNotMatch(runbook, /(?:GitHub Advanced Security|CodeQL|Snyk|Tencent|agentic-radar)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(runbook, /(?:SaaS|dashboard|auth|customer data|고객\s*데이터)[^\n]*(?:available|지원|제공|운영|production)/i)
  assert.doesNotMatch(runbook, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
