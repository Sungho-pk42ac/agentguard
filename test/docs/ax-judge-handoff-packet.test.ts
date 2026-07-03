import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const packetPath = join(repoRoot, 'docs', 'ax-judge-handoff-packet.md')

const orderedHeadings = [
  '# AX judge handoff packet',
  '## 1. 심사자용 30초 packet order',
  '## 2. Fixture-backed commands and expected verdicts',
  '## 3. Existing file path map',
  '## 4. Public reference borrow / avoid / action notes',
  '## 5. English-compatible machine contracts',
  '## 6. Non-claim guardrails',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
    fixturePaths: ['examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json'],
    expectedVerdict: 'BLOCK',
  },
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
    fixturePaths: ['examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json'],
    expectedVerdict: 'PASS',
  },
  {
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
    fixturePaths: ['examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff'],
    expectedVerdict: 'REVIEW',
  },
  {
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
    fixturePaths: ['examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff'],
    expectedVerdict: 'PASS',
  },
] as const

const requiredReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const requiredMachineContracts = [
  'agentguard scan-diff',
  'agentguard scan-mcp',
  'node dist/index.js scan-diff',
  'node dist/index.js scan-mcp',
  'secret.github_token',
  'mcp.broad_filesystem_access',
  'SARIF',
  'ruleId',
  'result',
  'location',
  'fingerprint',
  'BLOCK',
  'REVIEW',
  'PASS',
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

function readPacket(): string {
  return readFileSync(packetPath, 'utf8')
}

test('AX judge handoff packet exists and is linked from README docs list', () => {
  assert.ok(existsSync(packetPath), 'docs/ax-judge-handoff-packet.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX judge handoff packet\]\(docs\/ax-judge-handoff-packet\.md\)/)
})

test('AX judge handoff packet keeps the required ordered sections and states static handoff origin', () => {
  const packet = readPacket()
  let previousIndex = -1

  for (const heading of orderedHeadings) {
    const headingIndex = packet.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(packet, /자동 생성 산출물이 아니라|manual|정적 handoff guide/i)
})

test('AX judge handoff packet maps exact existing fixtures, commands, and verdicts', () => {
  const packet = readPacket()

  for (const { command, fixturePaths, expectedVerdict } of fixtureBackedCommands) {
    assert.ok(packet.includes(command), `${command} should be documented exactly`)
    assert.ok(packet.includes(expectedVerdict), `${expectedVerdict} should be documented as an expected verdict`)

    for (const fixturePath of fixturePaths) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(packet.includes(fixturePath), `${fixturePath} should be documented exactly`)
    }
  }

  for (const exactPath of [
    'README.md',
    'docs/ax-judge-evidence-index.md',
    'docs/ax-ci-reviewer-handoff.md',
    'docs/ax-rollout-references.md',
    'examples/agentguard.sarif',
  ] as const) {
    assert.ok(existsSync(join(repoRoot, exactPath)), `${exactPath} should exist`)
    assert.ok(packet.includes(exactPath), `${exactPath} should be documented exactly`)
  }
})

test('AX judge handoff packet cites public references with borrow avoid and action notes', () => {
  const packet = readPacket()

  for (const reference of requiredReferences) {
    assert.ok(packet.includes(reference), `${reference} should be cited`)
  }

  assert.match(packet, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(packet, /threat-to-control mapping/i)
  assert.match(packet, /machine-readable artifact handoff/i)
  assert.match(packet, /agent\/MCP security scanning category/i)
})

test('AX judge handoff packet preserves English-compatible machine contracts', () => {
  const packet = readPacket()

  for (const contract of requiredMachineContracts) {
    assert.ok(packet.includes(contract), `${contract} should stay documented`)
  }

  assert.doesNotMatch(packet, /(?:CLI commands?|rule IDs?|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜)/i)
})

test('AX judge handoff packet bans fake adoption certification and parity claims', () => {
  const packet = readPacket()

  assert.doesNotMatch(packet, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(packet, /(?:OWASP|MCP|GitHub|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(packet, /(?:GitHub\s+security\s+products?|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(packet, /(?:full|complete|전체)\s+(?:AI\s+)?(?:security|red[-\s]?team)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
