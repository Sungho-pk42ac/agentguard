import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-rollout-control-map.md')

const fixturePaths = [
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const

const publicReferences = [
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

function readControlMap(): string {
  return readFileSync(docPath, 'utf8')
}

test('AX rollout control map exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-rollout-control-map.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX rollout control map\]\(docs\/ax-rollout-control-map\.md\)/)
  assert.match(examplesDoc, /\[AX rollout control map\]\(ax-rollout-control-map\.md\)/)
})

test('AX rollout control map is Korean-first and keeps the requested headings', () => {
  const controlMap = readControlMap()

  for (const heading of [
    '# AX rollout control map',
    '## Public reference control map',
    '## Fixture-backed rollout checks',
    '## Approval condition',
    '## Residual risk',
    '## Honesty guardrails',
  ] as const) {
    assert.ok(controlMap.includes(heading), `${heading} should be present`)
  }

  assert.match(controlMap, /한국어 우선|대상권|현업성|발표력|정직성/)
  assert.match(controlMap, /AgentGuard -> AX Rollout Guard/)
})

test('AX rollout control map cites public references with borrow avoid and action language', () => {
  const controlMap = readControlMap()

  assert.match(controlMap, /\|\s*Public reference\s*\|\s*borrow\s*\|\s*avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const reference of publicReferences) {
    assert.ok(controlMap.includes(reference), `${reference} should be cited`)
  }

  const referenceRows = controlMap
    .split('\n')
    .filter((line) => line.startsWith('| ') && publicReferences.some((reference) => line.includes(reference)))
  assert.ok(referenceRows.length >= 3, 'at least three public references should be mapped')

  for (const row of referenceRows) {
    assert.match(row, /borrow|빌린다/i)
    assert.match(row, /avoid|피한다/i)
    assert.match(row, /action|AgentGuard|scan-/i)
  }
})

test('AX rollout control map uses exact fixture-backed commands and existing fixtures', () => {
  const controlMap = readControlMap()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(controlMap.includes(fixturePath), `${fixturePath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(controlMap.includes(command), `${command} should be documented exactly`)
  }

  for (const verdict of ['BLOCK', 'REVIEW', 'PASS'] as const) {
    assert.ok(controlMap.includes(verdict), `${verdict} should be present`)
  }
})

test('AX rollout control map documents approval conditions residual risks and claim guardrails', () => {
  const controlMap = readControlMap()

  assert.match(controlMap, /승인 조건|approval condition/i)
  assert.match(controlMap, /잔여 위험|residual risk/i)
  assert.match(controlMap, /운영 연결|rollout/i)
  assert.match(controlMap, /합성 fixture|fixture-backed/i)

  assert.doesNotMatch(controlMap, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(controlMap, /(?:SOC\s*2|ISO\s*27001|certified|certification|공식\s*인증|인증\s*완료)/i)
  assert.doesNotMatch(controlMap, /(?:OWASP|Tencent|AI-Infra-Guard|splx|Agentic Radar|GitHub)[^\n|.]{0,80}(?:verified|approved|endorsed|검증\s*완료|보증|대체|동등)/i)
  assert.doesNotMatch(controlMap, /(?:hosted|production)\s+SaaS|auth|billing|customer upload/i)
  assert.doesNotMatch(controlMap, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
