import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const ledgerPath = join(repoRoot, 'docs', 'ax-assumption-ledger.md')

const requiredFixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
    fixturePath: 'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  },
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
    fixturePath: 'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  },
  {
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
    fixturePath: 'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  },
  {
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
    fixturePath: 'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixturePath: 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  },
] as const

const requiredPublicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    const hasPackage = existsSync(join(currentDir, 'package.json'))
    const hasDocs = existsSync(join(currentDir, 'docs'))
    const hasTests = existsSync(join(currentDir, 'test'))
    if (hasPackage && hasDocs && hasTests) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

function readLedger(): string {
  return readFileSync(ledgerPath, 'utf8')
}

test('AX assumption ledger exists and is linked from README', () => {
  assert.ok(existsSync(ledgerPath), 'docs/ax-assumption-ledger.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX assumption ledger\]\(docs\/ax-assumption-ledger\.md\)/)
})

test('AX assumption ledger uses public references with borrow avoid action language', () => {
  const ledger = readLedger()

  for (const referenceUrl of requiredPublicReferences) {
    assert.match(ledger, new RegExp(escapeRegExp(referenceUrl)))
  }

  assert.match(ledger, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(ledger, /OWASP/)
  assert.match(ledger, /Snyk `agent-scan`/)
  assert.match(ledger, /Tencent `AI-Infra-Guard`/)
  assert.match(ledger, /splx-ai `agentic-radar`/)
})

test('AX assumption ledger covers unknown company problem readiness sections', () => {
  const ledger = readLedger()

  const requiredHeadings = [
    '## 확인된 공개 사실',
    '## Assumptions ledger',
    '## Evidence commands',
    '## Pivot triggers',
    '## Honesty guardrails',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(ledger, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['unknown/gated facts', 'public signals', 'synthetic evidence', '대상권', '기업 문제형 본선']) {
    assert.match(ledger, new RegExp(escapeRegExp(term)))
  }
})

test('AX assumption ledger uses exact existing fixture-backed commands', () => {
  const ledger = readLedger()

  for (const { command, fixturePath } of requiredFixtureBackedCommands) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.match(ledger, new RegExp(escapeRegExp(command)))
  }

  assert.match(ledger, /examples\/agent-policy\.yaml/)
  assert.ok(existsSync(join(repoRoot, 'examples', 'agent-policy.yaml')), 'examples/agent-policy.yaml should exist')
})

test('AX assumption ledger bans fake claims and labels synthetic fixtures honestly', () => {
  const ledger = readLedger()

  assert.match(ledger, /synthetic fixture/)
  assert.match(ledger, /synthetic evidence/)
  assert.match(ledger, /No fake adoption/)
  assert.match(ledger, /No customer claim/)
  assert.match(ledger, /No certification claim/)
  assert.match(ledger, /No parity claim/)
  assert.match(ledger, /No broad-platform claim/)

  assert.doesNotMatch(ledger, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(ledger, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|audited\s+by/i)
  assert.doesNotMatch(ledger, /(?:업계\s*)?(?:최초|유일)|first[-\s]?mover|first and only|only\s+(?:scanner|solution|tool)/i)
  assert.doesNotMatch(ledger, /full(?:-stack)?\s+AI\s+red[-\s]?team\s+platform/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
