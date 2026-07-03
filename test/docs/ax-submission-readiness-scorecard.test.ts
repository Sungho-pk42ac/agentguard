import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const scorecardPath = join(repoRoot, 'docs', 'ax-submission-readiness-scorecard.md')

const referencedPaths = [
  'docs/ax-prelim-submission-pack.md',
  'examples/enterprise-scenarios/commerce-voc-agent/README.md',
  'docs/ax-judge-evidence-index.md',
  'docs/ax-before-after-rollout-demo.md',
  'docs/ax-rule-compliance-checklist.md',
  'docs/ax-rollout-references.md',
  'docs/github-action.md',
  'README.md',
  'README.en.md',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
] as const

const readinessDimensions = [
  '현업 문제 적합성',
  '스캔 surface 명확성',
  '반복 가능한 증거',
  '판정/승인 조건',
  '심사자 안전 문구',
] as const

const publicReferences = [
  'https://hackathon.jocodingax.ai/',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i,
  /(?:AX|Snyk|Tencent|splx-ai|OWASP|MCP)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i,
  /(?:Snyk|Tencent|splx-ai|GitHub\s+security\s+products?)[^\n|.]{0,80}(?:대체|replacement)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team\s+)?(?:platform|coverage|플랫폼|커버리지)/i,
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

function readScorecard(): string {
  return readFileSync(scorecardPath, 'utf8')
}

test('AX submission readiness scorecard exists and is linked from Korean and English READMEs', () => {
  assert.ok(existsSync(scorecardPath), 'docs/ax-submission-readiness-scorecard.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const englishReadme = readFileSync(join(repoRoot, 'README.en.md'), 'utf8')

  assert.match(rootReadme, /\[AX submission readiness scorecard\]\(docs\/ax-submission-readiness-scorecard\.md\)/)
  assert.match(englishReadme, /\[AX submission readiness scorecard \(Korean\)\]\(docs\/ax-submission-readiness-scorecard\.md\)/)
})

test('AX submission readiness scorecard maps judging dimensions to current evidence and safe phrasing', () => {
  const scorecard = readScorecard()

  const requiredHeadings = [
    '## 심사 readiness scorecard',
    '## Fixture-backed smoke commands',
    '## Public reference guardrails',
    '## Non-claims',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(scorecard, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const dimension of readinessDimensions) {
    assert.match(scorecard, new RegExp(escapeRegExp(dimension)))
  }

  for (const requiredTerm of ['현재 repo evidence', 'exact command or file', 'status', 'remaining gap', 'judge-safe phrasing']) {
    assert.match(scorecard, new RegExp(escapeRegExp(requiredTerm)))
  }
})

test('AX submission readiness scorecard uses only existing referenced paths and fixture-backed smoke commands', () => {
  const scorecard = readScorecard()
  const normalizedScorecard = normalizeCommandText(scorecard)

  for (const referencedPath of referencedPaths) {
    assert.ok(existsSync(join(repoRoot, referencedPath)), `${referencedPath} should exist`)
    assert.ok(scorecard.includes(referencedPath), `${referencedPath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(normalizedScorecard.includes(command), `${command} should be documented exactly`)
  }
})

test('AX submission readiness scorecard cites public references with borrow, avoid, and non-claim guardrails', () => {
  const scorecard = readScorecard()

  for (const reference of publicReferences) {
    assert.ok(scorecard.includes(reference), `${reference} should be cited`)
  }

  for (const requiredTerm of ['Borrow', 'Avoid', 'Non-claim', 'public signals', 'unknown/gated facts']) {
    assert.match(scorecard, new RegExp(escapeRegExp(requiredTerm), 'i'))
  }

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(scorecard, forbiddenClaimPattern)
  }
})

function normalizeCommandText(value: string): string {
  return value
    .replace(/\\\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
