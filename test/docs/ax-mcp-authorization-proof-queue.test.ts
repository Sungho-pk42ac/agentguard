import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-mcp-authorization-proof-queue.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/snyk/agent-scan',
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

test('AX MCP authorization proof queue exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-mcp-authorization-proof-queue.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX MCP authorization proof queue\]\(docs\/ax-mcp-authorization-proof-queue\.md\)/)
  assert.match(examplesReadme, /\[AX MCP authorization proof queue\]\(\.\.\/docs\/ax-mcp-authorization-proof-queue\.md\)/)
  assert.match(examplesDoc, /\[AX MCP authorization proof queue\]\(ax-mcp-authorization-proof-queue\.md\)/)
})

test('AX MCP authorization proof queue is Korean-first with required sections and terms', () => {
  const card = readCard()

  for (const heading of [
    '# AX MCP authorization proof queue',
    '## Purpose',
    '## Proof queue',
    '## Exact fixture-backed commands',
    '## Public reference borrow/avoid/action table',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    '대상권',
    'MCP/OAuth callback/session risk',
    'state mismatch',
    'trusted redirect URI',
    'authorization boundary',
    'named owner review',
    '승인 증거',
    '승인자 결정',
  ] as const) {
    expectLiteral(card, term)
  }
})

test('AX MCP authorization proof queue uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.match(card, /\bBLOCK\b[\s\S]{0,1200}mcp\.broad_filesystem_access/)
  assert.match(card, /\bREVIEW\b[\s\S]{0,1200}(?:scan-log|agent-transcript\.log|denied command)/i)
  assert.match(card, /SARIF[\s\S]{0,1200}(?:reviewer|handoff|artifact)/i)
})

test('AX MCP authorization proof queue cites public references with borrow avoid action rows', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /MCP Authorization spec/)
  assert.match(card, /OWASP Agentic AI threats and mitigations/)
  assert.match(card, /GitHub SARIF upload/)
  assert.match(card, /Snyk `agent-scan`/)
  assert.match(card, /Tencent `AI-Infra-Guard`/)
})

test('AX MCP authorization proof queue preserves English machine contracts and bans unsupported claims', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-mcp',
    'agentguard scan-log',
    'CLI commands',
    'rule IDs',
    'verdict values',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|verdict values?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|rename)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance|assurance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|Snyk|Tencent)[^\r\n|.]{0,100}(?:endorsed|validated|approved|공식\s*검증|검증\s*완료|인증\s*완료|replacement|대체)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements|performs)\s+MCP[^.\n|]{0,140}(?:OAuth|runtime authorization|authorization server|consent UI|session binding|state validation|redirect URI validation)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:replaces|matches|is equivalent to|is at parity with)\s+(?:Snyk|Tencent|OWASP|GitHub)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
