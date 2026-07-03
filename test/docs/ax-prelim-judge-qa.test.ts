import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const judgeQaPath = join(repoRoot, 'docs', 'ax-prelim-judge-qa.md')
const fixturePaths = [
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
] as const
const evidenceCommands = [
  'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const
const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i,
  /(?:최종|final)[^\n|.]{0,80}(?:문제|problem|round)[^\n|.]{0,80}(?:확인|반영|해결|known|solved)/i,
  /(?:OWASP|MCP)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved|compliant|standard\s+compliance)/i,
  /(?:Snyk|agent-scan|broad\s+scanner)[^\n|.]{0,80}(?:대체|replacement)/i,
  /(?:full|complete|전체)\s+(?:agent|agentic|AI)?\s*(?:security\s+)?(?:scanner|platform|coverage|커버리지|플랫폼)/i,
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

function readJudgeQa(): string {
  return readFileSync(judgeQaPath, 'utf8')
}

test('AX prelim judge Q&A answer bank exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(judgeQaPath), 'docs/ax-prelim-judge-qa.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX prelim judge Q&A\]\(docs\/ax-prelim-judge-qa\.md\)/)
  assert.match(examplesDoc, /\[AX prelim judge Q&A\]\(ax-prelim-judge-qa\.md\)/)
})

test('AX prelim judge Q&A answer bank covers public signals, hard questions, evidence, and guardrails', () => {
  const judgeQa = readJudgeQa()
  const requiredHeadings = [
    '## Public reference signals',
    '## Hard judge questions',
    '## Evidence commands',
    '## Non-claim guardrails',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(judgeQa, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const requiredTerm of ['기업 실제 문제', '성과를 증명', 'tool misuse', 'excessive agency', 'confused deputy', 'token passthrough', 'synthetic', 'adaptable']) {
    assert.match(judgeQa, new RegExp(escapeRegExp(requiredTerm), 'i'))
  }
})

test('AX prelim judge Q&A answer bank maps copy-paste commands to existing fixtures', () => {
  const judgeQa = readJudgeQa()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.match(judgeQa, new RegExp(escapeRegExp(fixturePath)))
  }

  for (const command of evidenceCommands) {
    assert.match(judgeQa, new RegExp(escapeRegExp(command)))
  }
})

test('AX prelim judge Q&A answer bank cites public references and avoids fake claims', () => {
  const judgeQa = readJudgeQa()
  const requiredLinks = [
    'https://hackathon.jocodingax.ai/',
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
    'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
    'https://github.com/snyk/agent-scan',
  ] as const

  for (const link of requiredLinks) {
    assert.match(judgeQa, new RegExp(escapeRegExp(link)))
  }

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(judgeQa, forbiddenClaimPattern)
  }
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
