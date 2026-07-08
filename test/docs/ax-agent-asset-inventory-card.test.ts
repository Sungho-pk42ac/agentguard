import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-agent-asset-inventory-card.md')

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
  'https://github.com/Tencent/AI-Infra-Guard',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i,
  /(?:OWASP|MCP|Tencent|AI-Infra-Guard)[^\r\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed)/i,
  /(?:feature|product|platform|기능|제품|플랫폼)[^\r\n|.]{0,80}(?:parity|동등|대체|replacement)/i,
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

test('AX agent asset inventory card exists and is linked from README docs list', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-agent-asset-inventory-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

  assert.match(rootReadme, /\[AX agent asset inventory card\]\(docs\/ax-agent-asset-inventory-card\.md\)/)
})

test('AX agent asset inventory card is Korean-first with required inventory sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 사용 목적',
    '## Company problem → Agent asset inventory → command → approval condition',
    '## Public reference borrow/avoid/action table',
    '## Evidence handling notes',
    '## Non-claim guardrails',
  ] as const

  assert.match(card, /^# AX agent asset inventory card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const requiredTerm of ['agent asset inventory', 'approval owner', 'approval condition'] as const) {
    expectLiteral(card, requiredTerm)
  }
})

test('AX agent asset inventory card maps company problems to inventory, commands, verdicts, and owners', () => {
  const card = readCard()

  assert.match(
    card,
    /\|\s*Company problem\s*\|\s*Agent asset inventory\s*\|\s*Exact AgentGuard command\s*\|\s*Expected verdict\s*\|\s*Approval owner\/condition\s*\|/,
  )
  assert.match(card, /PR diff/)
  assert.match(card, /MCP config/)
  assert.match(card, /agent transcript|transcript\/log/i)
  assert.match(card, /\bPASS\b/)
  assert.match(card, /\bREVIEW\b/)
  assert.match(card, /\bBLOCK\b/)
})

test('AX agent asset inventory card uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }
})

test('AX agent asset inventory card cites public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP Agentic AI/)
  assert.match(card, /MCP security best practices/)
  assert.match(card, /Tencent AI-Infra-Guard/)
})

test('AX agent asset inventory card preserves machine contracts and avoids unsupported claims', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'node dist/index.js',
    'Get-Content <fixture> -Raw | node dist/index.js <subcommand>',
    'JSON',
    'SARIF',
    'ruleId',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI|명령어|rule IDs?|ruleId|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(card, forbiddenClaimPattern)
  }
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
