import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-mcp-third-party-server-trust-boundary.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp --out .agentguard-demo/mcp-third-party-server-trust-boundary.md < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-mcp --sarif --out .agentguard-demo/mcp-third-party-server-trust-boundary.sarif < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'agentguard scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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

test('AX MCP third-party server trust boundary card exists and is linked from the root README', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-mcp-third-party-server-trust-boundary.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(
    rootReadme,
    /\[AX MCP third-party server trust boundary card\]\(docs\/ax-mcp-third-party-server-trust-boundary\.md\)/,
  )
})

test('AX MCP third-party server trust boundary card is Korean-first with required approval sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## Company problem',
    '## Third-party MCP server risk',
    '## AgentGuard evidence commands',
    '## Approval condition',
    '## Public reference borrow/avoid/action notes',
    '## Current scope and non-claims',
    '## Machine contract preservation',
  ] as const

  assert.match(card, /^# AX MCP third-party server trust boundary card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const requiredTerm of [
    '회사 문제',
    '외부 MCP server',
    'untrusted MCP server command',
    'root',
    'env',
    'human approver',
    'go/no-go',
    '정적 preflight evidence',
  ] as const) {
    expectLiteral(card, requiredTerm)
  }
})

test('AX MCP third-party server trust boundary card uses exact fixture-backed commands', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.match(card, /Markdown/)
  assert.match(card, /SARIF/)
  assert.match(card, /mcp-filesystem-wide-root/)
  assert.match(card, /mcp-env-token/)
  assert.match(card, /credential-like environment passthrough/)
  assert.match(card, /\bBLOCK\b|\bREVIEW\b/)
})

test('AX MCP third-party server trust boundary card cites references with borrow avoid and action framing', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP Agentic AI threats and mitigations/)
  assert.match(card, /MCP Security Best Practices/)
  assert.match(card, /GitHub SARIF upload/)
  assert.match(card, /agent autonomy|tool misuse|excessive agency/i)
  assert.match(card, /confused deputy|token passthrough|least privilege|explicit user consent/i)
  assert.match(card, /reviewer handoff artifact|configured workflow/i)
})

test('AX MCP third-party server trust boundary card preserves machine contracts and blocks fake claims', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-mcp',
    'node dist/index.js scan-mcp',
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'mcp-filesystem-wide-root',
    'mcp-env-token',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub)[^\r\n|.]{0,100}(?:endorsed|validated|approved|공식\s*검증|검증\s*완료|인증\s*완료)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:executes|runs|launches)\s+(?:external|third-party|untrusted)?\s*MCP\s+servers?/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:enforces|implements|provides|delivers)[^.\n|]{0,100}(?:runtime OAuth|runtime authorization|session control|consent UI)/i)
  assert.doesNotMatch(card, /GitHub[^.\n|]{0,100}(?:upload|approval|code scanning)[^.\n|]{0,100}automatic/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:agentic|AI|MCP)?\s*(?:threat|security|보안)\s+(?:coverage|platform|커버리지|플랫폼)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
