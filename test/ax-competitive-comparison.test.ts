import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const comparisonDocPath = join(repoRoot, 'docs', 'ax-competitive-comparison.md')
const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i,
  /AgentGuard[^\n|.]{0,80}(?:실제\s*채택|채택\s*완료|운영\s*실적|레퍼런스\s*보유)/i,
  /(?:OWASP|MCP)[^\n|.]{0,40}(?:공식\s*인증|인증\s*완료|인증을\s*받은|검증\s*완료)/i,
  /(?:SOC\s*2|ISO\s*27001)[^\n|.]{0,40}(?:인증(?:\s*완료)?|준수(?:\s*완료)?|certified|compliant|verified)/i,
  /AgentGuard[^\n|.]{0,80}(?:전체\s*AI\s*(?:인프라\s*)?보안\s*플랫폼|종합\s*AI\s*보안\s*플랫폼)/i,
  /full-stack\s+AI\s+red[-\s]?team\s+platform|전체\s+AI\s+인프라\s+보안\s+플랫폼/i,
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

function readComparisonDoc(): string {
  return readFileSync(comparisonDocPath, 'utf8')
}

test('AX competitive comparison doc exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(comparisonDocPath), 'docs/ax-competitive-comparison.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  const readmeLinksComparison = /\[AX competitive comparison\]\(docs\/ax-competitive-comparison\.md\)/.test(rootReadme)
  const examplesLinksComparison = /\[AX competitive comparison\]\(ax-competitive-comparison\.md\)/.test(examplesDoc)

  assert.ok(readmeLinksComparison, 'README.md should link the competitive comparison')
  assert.ok(examplesLinksComparison, 'docs/examples.md should link the competitive comparison')
})

test('AX competitive comparison names required references and Korean judging terms', () => {
  const comparisonDoc = readComparisonDoc()

  const requiredTerms = [
    'Snyk agent-scan',
    'Tencent AI-Infra-Guard',
    'splx-ai agentic-radar',
    'OWASP',
    'MCP',
    'borrow',
    'avoid',
    'AgentGuard differentiator',
    '대상권',
    '현업성',
    '결과물성',
  ] as const

  for (const term of requiredTerms) {
    assert.match(comparisonDoc, new RegExp(escapeRegExp(term), 'i'))
  }
})

test('AX competitive comparison forbids unsupported trust and platform claims', () => {
  const comparisonDoc = readComparisonDoc()

  assert.match(comparisonDoc, /fake adoption/i)
  assert.match(comparisonDoc, /certification/i)
  assert.match(comparisonDoc, /broad-platform/i)
  assert.match(comparisonDoc, /rollout gate/i)
  assert.match(comparisonDoc, /full platform/i)

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(comparisonDoc, forbiddenClaimPattern)
  }
})

test('AX competitive comparison guardrail patterns reject common Korean overclaims', () => {
  const forbiddenExamples = [
    'AgentGuard는 실제 채택 완료된 도구입니다.',
    'OWASP 공식 인증을 받은 도구입니다.',
    'MCP 공식 인증 완료 상태입니다.',
    'SOC 2 인증 완료 제품입니다.',
    'ISO 27001 준수 완료 플랫폼입니다.',
    'AgentGuard는 전체 AI 보안 플랫폼입니다.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
