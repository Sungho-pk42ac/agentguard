import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-mcp-consent-token-handoff.md')

const fixtureBackedCommands = [
  {
    command: 'agentguard scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
] as const

const publicReferenceUrls = [
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
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

test('AX MCP consent token handoff card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-mcp-consent-token-handoff.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX MCP consent\/token handoff card\]\(docs\/ax-mcp-consent-token-handoff\.md\)/)
  assert.match(examplesDoc, /\[AX MCP consent\/token handoff card\]\(ax-mcp-consent-token-handoff\.md\)/)
})

test('AX MCP consent token handoff card is Korean-first with the required handoff sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## Company problem',
    '## MCP risk',
    '## AgentGuard evidence command',
    '## Static execution-safety boundary',
    '## Expected verdict',
    '## Approval question',
    '## Public reference borrow/avoid notes',
    '## Machine contract guardrails',
  ] as const

  assert.match(card, /^# AX MCP consent\/token handoff card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const requiredTerm of [
    '회사 문제',
    '동의',
    'token passthrough',
    'confused deputy',
    'tool misuse',
    'human approver',
    '승인 질문',
    '정적 preflight',
    'MCP server를 실행하지 않는다',
  ] as const) {
    expectLiteral(card, requiredTerm)
  }
})

test('AX MCP consent token handoff card uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.match(card, /\bBLOCK\b|\bREVIEW\b/)
  assert.match(card, /broad filesystem access/i)
  assert.match(card, /credential-like environment passthrough/i)
  assert.match(card, /static/i)
  assert.match(card, /no MCP server execution|MCP server를 실행하지 않는다/i)
})

test('AX MCP consent token handoff card cites public references without claiming validation', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|/)
  assert.match(card, /MCP security best practices/)
  assert.match(card, /OWASP Agentic AI threats and mitigations/)
  assert.match(card, /Snyk `agent-scan`/)
  assert.match(card, /Tencent `AI-Infra-Guard`/)
  assert.match(card, /GitHub SARIF upload/)
})

test('AX MCP consent token handoff card preserves English-compatible machine contracts and avoids fake claims', () => {
  const card = readCard()

  for (const machineContract of [
    'agentguard scan-mcp',
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(card, machineContract)
  }

  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF|API)[^\r\n]*(?:한국어로|한글로|번역|변경|rename)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP)[^\r\n|.]{0,100}(?:endorsed|validated|approved|공식\s*검증|검증\s*완료|인증\s*완료)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:has|provides|delivers|implements)\s+MCP[^.\n|]{0,100}(?:consent UI|runtime authorization|OAuth|session control|conformance)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:is|has|provides|delivers)\s+(?:a\s+)?GitHub[^.\n|]{0,100}(?:native app|product parity|replacement|동등|대체)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:replaces|matches|is equivalent to|is at parity with)\s+(?:Snyk|Tencent|OWASP|GitHub)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
