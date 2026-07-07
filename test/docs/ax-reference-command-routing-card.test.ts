import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-reference-command-routing-card.md')

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

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
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

test('AX reference command routing card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-reference-command-routing-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8')

  assert.match(rootReadme, /\[AX reference command routing card\]\(docs\/ax-reference-command-routing-card\.md\)/)
  assert.match(examplesDoc, /\[AX reference command routing card\]\(ax-reference-command-routing-card\.md\)/)
  assert.match(gitignore, /^agentguard\.sarif$/m)
})

test('AX reference command routing card is Korean-first and keeps machine contracts English-compatible', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 사용 목적',
    '## Public reference → AgentGuard command routing',
    '## Judge-safe routing script',
    '## Non-claim guardrails',
  ] as const

  assert.match(card, /^# AX reference command routing card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const machineContract of [
    'agentguard scan-log',
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'CLI',
    'rule IDs',
    'SARIF',
    'JSON',
    'API',
  ] as const) {
    expectLiteral(card, machineContract)
  }
})

test('AX reference command routing card maps public references to exact fixture-backed commands', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.match(
    card,
    /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*Evidence command\s*\|\s*Expected verdict\s*\|\s*Judge-safe sentence\s*\|/,
  )
  assert.match(card, /\bPASS\b/)
  assert.match(card, /\bREVIEW\b/)
  assert.match(card, /\bBLOCK\b/)
  assert.match(card, /expected nonzero/i)
})

test('AX reference command routing card preserves fake-claim guardrails', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+OWASP[^.\n|]{0,80}(?:coverage|covered|인증|준수\s*완료|전체\s*구현)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+MCP[^.\n|]{0,80}(?:conformance|runtime authorization|적합성|런타임\s*권한\s*통제)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:is|has|provides|delivers)\s+(?:a\s+)?GitHub[^.\n|]{0,80}(?:native app|product parity|replacement|동등|대체)/i)
  assert.doesNotMatch(card, /(?:CLI|rule IDs?|JSON|SARIF|API)[^\r\n]*(?:한국어로|한글로|번역|변경|rename)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
