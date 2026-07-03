import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-pilot-responsibility-card.md')

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
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
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

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX pilot responsibility card exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-pilot-responsibility-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX pilot responsibility card\]\(docs\/ax-pilot-responsibility-card\.md\)/)
  assert.match(examplesDoc, /\[AX pilot responsibility card\]\(ax-pilot-responsibility-card\.md\)/)
})

test('AX pilot responsibility card contains required Korean-first handoff sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 사용 목적',
    '## 책임 분장 카드',
    '## 운영 책임자별 판단',
    '## Fixture-backed evidence commands',
    '## Public reference borrow/avoid/action table',
    '## Re-run and residual-risk rules',
    '## Non-claim guardrails',
  ] as const

  assert.match(card, /^# AX pilot responsibility card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const requiredTerm of ['business approval', 'residual risk', 'rollback', 'evidence rerun'] as const) {
    expectLiteral(card, requiredTerm)
  }
})

test('AX pilot responsibility card uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.match(card, /PASS|REVIEW|BLOCK/)
  assert.match(card, /PR diff/)
  assert.match(card, /MCP/)
  assert.match(card, /transcript|로그/i)
})

test('AX pilot responsibility card includes public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP Agentic AI/)
  assert.match(card, /MCP security best practices/)
  assert.match(card, /Snyk agent-scan/)
  assert.match(card, /Tencent AI-Infra-Guard/)
  assert.match(card, /splx-ai agentic-radar/)
})

test('AX pilot responsibility card preserves machine contracts and avoids unsupported claims', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'secret.github_token',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|Snyk|Tencent|AI-Infra-Guard|agentic-radar)[^\r\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security|보안)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
