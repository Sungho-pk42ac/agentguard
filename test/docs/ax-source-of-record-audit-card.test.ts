import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-source-of-record-audit-card.md')

const requiredHeadings = [
  '# AX source-of-record audit card',
  '## 사용 목적',
  '## Source-of-record principle',
  '## Fixture-backed audit commands',
  '## Public reference borrow/avoid/action table',
  '## Non-claim guardrails',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://github.com/snyk/agent-scan',
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

test('AX source-of-record audit card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-source-of-record-audit-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX source-of-record audit card\]\(docs\/ax-source-of-record-audit-card\.md\)/)
  assert.match(examplesDoc, /\[AX source-of-record audit card\]\(ax-source-of-record-audit-card\.md\)/)
})

test('AX source-of-record audit card is Korean-first and preserves machine contracts', () => {
  const card = readCard()

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)
  assert.match(card, /agent self-report is not authoritative evidence/i)
  assert.match(card, /source-of-record is repo\/CI\/host artifact plus rerunnable command/i)

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'machine contracts',
  ] as const) {
    expectLiteral(card, contract)
  }
})

test('AX source-of-record audit card uses exact fixture-backed commands with existing paths', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  for (const surface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF output'] as const) {
    assert.match(card, new RegExp(escapeRegExp(surface), 'i'))
  }
})

test('AX source-of-record audit card maps public references with borrow avoid action rows', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  const referenceRows = card
    .split('\n')
    .filter((line) => line.startsWith('| [') && publicReferenceUrls.some((referenceUrl) => line.includes(referenceUrl)))
  assert.equal(referenceRows.length, publicReferenceUrls.length)

  for (const row of referenceRows) {
    assert.match(row, /Borrow|빌릴 점/i)
    assert.match(row, /Avoid|피할 점/i)
    assert.match(row, /AgentGuard/)
  }
})

test('AX source-of-record audit card states non-claims without making fake claims', () => {
  const card = readCard()

  for (const requiredNonClaim of [
    'no external certification',
    'no MCP conformance/runtime auth',
    'no vendor-scale coverage',
    'no real customer/adoption claim',
  ] as const) {
    assert.match(card, new RegExp(escapeRegExp(requiredNonClaim), 'i'))
  }

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /(?:SOC\s*2|ISO\s*27001|external certification)[^.\n|]{0,80}(?:achieved|complete|보유|획득|완료)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+OWASP[^.\n|]{0,80}(?:coverage|covered|인증|준수\s*완료|전체\s*구현)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+MCP[^.\n|]{0,80}(?:conformance|runtime authorization|적합성|런타임\s*권한\s*통제)/i)
  assert.doesNotMatch(card, /(?:Snyk|agent-scan|GitHub code scanning)[^.\n|]{0,80}(?:replacement|parity|대체|동등)/i)
  assert.doesNotMatch(
    card,
    /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:are|were|will be|must be|should be|를|을|는)\s*(?:한국어로|한글로|번역|변경|renamed?)/i,
  )
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
