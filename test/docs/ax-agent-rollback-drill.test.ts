import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const drillPath = join(repoRoot, 'docs', 'ax-agent-rollback-drill.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff'],
  },
  {
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
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

function readDrill(): string {
  return readFileSync(drillPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX agent rollback drill exists and is linked from the root README', () => {
  assert.ok(existsSync(drillPath), 'docs/ax-agent-rollback-drill.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX agent rollback drill\]\(docs\/ax-agent-rollback-drill\.md\)/)
})

test('AX agent rollback drill contains the required Korean-first sections', () => {
  const drill = readDrill()
  const requiredHeadings = [
    '## Purpose',
    '## 30-second drill',
    '## Rollback decision table',
    '## Fixture-backed evidence commands',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const

  assert.match(drill, /^# AX agent rollback drill/m)
  assert.match(drill, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(drill, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX agent rollback drill uses only existing fixture-backed evidence commands', () => {
  const drill = readDrill()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(drill, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(drill, fixturePath)
    }
  }

  assert.match(drill, /BLOCK[\s\S]{0,900}rollback|rollback[\s\S]{0,900}BLOCK/i)
  assert.match(drill, /PASS[\s\S]{0,900}approval|approval[\s\S]{0,900}PASS/i)
  assert.match(drill, /SARIF/)
  assert.match(drill, /Markdown/)
})

test('AX agent rollback drill cites public references with borrow avoid action notes', () => {
  const drill = readDrill()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(drill, referenceUrl)
  }

  assert.match(drill, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(drill, /빌릴 점|Borrow/i)
  assert.match(drill, /피할 점|Avoid/i)
  assert.match(drill, /AgentGuard action|조치/i)
})

test('AX agent rollback drill preserves English-compatible machine contracts', () => {
  const drill = readDrill()

  for (const contract of [
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
    'generic-secret-assignment',
  ] as const) {
    expectLiteral(drill, contract)
  }

  assert.doesNotMatch(drill, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX agent rollback drill bans unsupported adoption certification and parity claims', () => {
  const drill = readDrill()

  assert.doesNotMatch(drill, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(drill, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(drill, /(?:OWASP|GitHub|Tencent|AI-Infra-Guard|agentic-radar)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(drill, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(drill, /(?:SaaS|dashboard|auth|customer data|고객\s*데이터)[^\n]*(?:available|지원|제공|운영|production)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
