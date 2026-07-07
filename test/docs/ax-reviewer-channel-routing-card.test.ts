import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-reviewer-channel-routing-card.md')

const fixturePaths = [
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const

const requiredReferences = [
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/affaan-m/agentshield',
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

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX reviewer channel routing card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-reviewer-channel-routing-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX reviewer channel routing card\]\(docs\/ax-reviewer-channel-routing-card\.md\)/)
  assert.match(examplesDoc, /\[AX reviewer channel routing card\]\(ax-reviewer-channel-routing-card\.md\)/)
})

test('AX reviewer channel routing card is Korean-first and maps reviewer channels', () => {
  const card = readCard()

  for (const heading of [
    '# AX reviewer channel routing card',
    '## 30초 reviewer channel map',
    '## Channel routing table',
    '## Fixture-backed command contract',
    '## Public reference borrow/avoid/action rows',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const channel of [
    'Markdown',
    'SARIF/GitHub code scanning',
    'PR/CI artifact',
    'terminal/local operator review',
    'security approver memo',
  ] as const) {
    expectLiteral(card, channel)
  }

  assert.match(card, /한국어 우선/)
  assert.match(card, /어느 stakeholder가 어떤 artifact를 검토하는지/)
})

test('AX reviewer channel routing card uses exact existing fixture-backed commands', () => {
  const card = readCard()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(card, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(card, command)
  }

  assert.match(card, /`BLOCK`[\s\S]{0,900}(?:중지|stop|block)/i)
  assert.match(card, /`REVIEW`[\s\S]{0,900}(?:승인|approver|reviewer)/i)
  assert.match(card, /`PASS`[\s\S]{0,900}(?:진행|proceed|gate)/i)
})

test('AX reviewer channel routing card cites public references with borrow avoid action rows', () => {
  const card = readCard()

  for (const reference of requiredReferences) {
    expectLiteral(card, reference)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /GitHub SARIF\/code scanning/i)
  assert.match(card, /Agentshield-style GitHub Action\/App packaging/i)
  assert.match(card, /Tencent `AI-Infra-Guard`/)
  assert.match(card, /splx-ai `agentic-radar`/)
})

test('AX reviewer channel routing card bans fake adoption certification and parity claims', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|audited\s+by|conformance/i)
  assert.doesNotMatch(card, /(?:GitHub|Agentshield|Tencent|AI-Infra-Guard|splx-ai|agentic-radar)[^\n|.]{0,100}(?:검증\s*완료|인증\s*완료|approved|verified|replacement|parity)/i)
  assert.doesNotMatch(card, /(?:GitHub\s+App|dashboard|auth|SaaS|runtime monitoring|attack simulation)[^\n]*(?:implemented|available|지원|제공|구현|운영)/i)
  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|machine fields?)[^\n]*(?:rename|renamed|이름\s*변경|표시용\s*변경)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
