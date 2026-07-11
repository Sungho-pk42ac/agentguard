import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-rollout-acceptance-contract-card.md')

const fixturePaths = [
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/enterprise-scenarios/commerce-voc-agent/expected-approval-report.md',
  'examples/agent-policy.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const

const publicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql',
  'https://github.com/Tencent/AI-Infra-Guard',
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

test('AX rollout acceptance contract card exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-rollout-acceptance-contract-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX rollout acceptance contract card\]\(docs\/ax-rollout-acceptance-contract-card\.md\)/)
  assert.match(examplesDoc, /\[AX rollout acceptance contract card\]\(ax-rollout-acceptance-contract-card\.md\)/)
})

test('AX rollout acceptance contract card has the Korean-first acceptance sections', () => {
  const card = readCard()

  for (const heading of [
    '## 사용 목적',
    '## Acceptance-contract matrix',
    '## Exact evidence commands',
    '## Approver decision',
    '## Rerun trigger',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    'Korean-first',
    'unknown company problem',
    '승인',
    '잔여 위험',
    '재실행',
    'acceptance contract',
  ] as const) {
    assert.ok(card.includes(term), `${term} should be present`)
  }
})

test('AX rollout acceptance contract card maps exact existing fixtures and commands', () => {
  const card = readCard()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(card.includes(fixturePath), `${fixturePath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(card.includes(command), `${command} should be documented exactly`)
  }
})

test('AX rollout acceptance contract card cites public references with borrow, avoid, and action notes', () => {
  const card = readCard()

  for (const reference of publicReferences) {
    assert.ok(card.includes(reference), `${reference} should be cited`)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /Borrow|빌릴 점/)
  assert.match(card, /Avoid|피할 점/)
  assert.match(card, /AgentGuard action|실행/)
})

test('AX rollout acceptance contract card preserves machine contracts and bans unsupported claims', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'PR diff',
    'MCP config',
    'agent transcript/log',
    'JSON',
    'SARIF',
    'PASS',
    'REVIEW',
    'BLOCK',
  ] as const) {
    assert.ok(card.includes(contract), `${contract} should stay documented`)
  }

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|reference customer/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:SaaS|dashboard|auth|login|tenant|runtime enforcement|runtime consent|runtime MCP authorization)/i)
  assert.doesNotMatch(card, /(?:GitHub|CodeQL|AI-Infra-Guard|OWASP|MCP)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:OWASP|MCP|SARIF|AI-Infra-Guard|coverage|conformance|준수|커버리지)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+platform/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
