import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-prompt-injection-evidence-routing-card.md')

const fixtureBackedCommands = [
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const publicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning',
  'https://github.com/splx-ai/agentic-radar',
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

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX prompt-injection evidence routing card exists and is linked from README', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-prompt-injection-evidence-routing-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(
    rootReadme,
    /\[AX prompt-injection evidence routing card\]\(docs\/ax-prompt-injection-evidence-routing-card\.md\)/,
  )
})

test('AX prompt-injection evidence routing card is Korean-first and preserves machine contracts', () => {
  const card = readCard()

  for (const heading of [
    '# AX prompt-injection evidence routing card',
    '## 30초 prompt-injection evidence route',
    '## Problem → surface → command → approval table',
    '## Public reference borrow/avoid/action rows',
    '## Fixture-backed command contract',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)
  assert.match(card, /prompt-influenced agent action/i)
  assert.match(card, /approval evidence/i)

  for (const machineContract of [
    'agentguard scan-log',
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'CLI',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
  ] as const) {
    expectLiteral(card, machineContract)
  }
})

test('AX prompt-injection evidence routing card maps risks to exact fixture-backed commands', () => {
  const card = readCard()

  assert.match(
    card,
    /\|\s*Prompt-injection\/tool-abuse problem\s*\|\s*AgentGuard surface\s*\|\s*Exact fixture-backed command\s*\|\s*Expected verdict\s*\|\s*Approval condition\s*\|/,
  )

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.match(card, /\bBLOCK\b/)
  assert.match(card, /\bREVIEW\b/)
  assert.match(card, /\bPASS\b/)
  assert.match(card, /expected nonzero/i)
  assert.match(card, /repository root/)
  assert.match(card, /상대경로 명령은 모두 repository root 기준/)
})

test('AX prompt-injection evidence routing card cites references with borrow avoid action framing', () => {
  const card = readCard()

  for (const reference of publicReferences) {
    expectLiteral(card, reference)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP Agentic AI threats and mitigations/)
  assert.match(card, /GitHub code scanning/)
  assert.match(card, /splx-ai `agentic-radar`/)
  assert.match(card, /Tencent `AI-Infra-Guard`/)
})

test('AX prompt-injection evidence routing card bans fake adoption certification and parity claims', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|audited\s+by/i)
  assert.doesNotMatch(card, /(?:OWASP|GitHub|splx-ai|agentic-radar|Tencent|AI-Infra-Guard)[^\n|.]{0,120}(?:검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등|대체)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+OWASP[^.\n|]{0,80}(?:coverage|covered|인증|준수\s*완료|전체\s*구현)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+GitHub[^.\n|]{0,80}(?:native app|product parity|replacement|동등|대체)/i)
  assert.doesNotMatch(card, /(?:dashboard|auth|SaaS|runtime monitoring|attack simulation|runtime prompt-injection detector)[^\n]*(?:implemented|available|지원|제공|구현|운영)/i)
  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF|API|machine fields?)[^\n]*(?:rename|renamed|이름\s*변경|표시용\s*변경|한국어로|한글로|번역)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
