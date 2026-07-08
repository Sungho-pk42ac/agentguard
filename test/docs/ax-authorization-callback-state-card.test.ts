import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-authorization-callback-state-card.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning',
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

test('AX authorization callback state card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-authorization-callback-state-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX authorization callback state card\]\(docs\/ax-authorization-callback-state-card\.md\)/)
  assert.match(examplesDoc, /\[AX authorization callback state card\]\(ax-authorization-callback-state-card\.md\)/)
})

test('AX authorization callback state card is Korean-first with required sections', () => {
  const card = readCard()

  for (const heading of [
    '# AX authorization callback state card',
    '## Company problem',
    '## Authorization callback risk',
    '## AgentGuard evidence command',
    '## Expected verdict',
    '## Approval question',
    '## Public reference borrow/avoid notes',
    '## Machine contract guardrails',
  ] as const) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    'authorization callback',
    'state mismatch',
    'trusted redirect URI',
    '정적 evidence',
    '승인 질문',
  ] as const) {
    expectLiteral(card, term)
  }
})

test('AX authorization callback state card uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.match(card, /\bBLOCK\b[\s\S]{0,900}mcp\.broad_filesystem_access/)
  assert.match(card, /\bREVIEW\b[\s\S]{0,900}(?:git push --force|rm -rf|denied command)/i)
  assert.match(card, /OAuth|authorization/i)
})

test('AX authorization callback state card cites public references with borrow avoid notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|/)
  assert.match(card, /OWASP Agentic AI threats and mitigations/)
  assert.match(card, /MCP Authorization spec/)
  assert.match(card, /GitHub code scanning/)
})

test('AX authorization callback state card preserves machine contracts and avoids fake claims', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-mcp',
    'agentguard scan-log',
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|rename)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub)[^\r\n|.]{0,100}(?:endorsed|validated|approved|공식\s*검증|검증\s*완료|인증\s*완료)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+MCP[^.\n|]{0,120}(?:OAuth|runtime authorization|authorization server|session control|state validation|redirect URI validation)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:is|has|provides|delivers)\s+(?:a\s+)?GitHub[^.\n|]{0,100}(?:native app|product parity|replacement|동등|대체)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
