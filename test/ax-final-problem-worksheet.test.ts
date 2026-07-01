import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const worksheetPath = join(repoRoot, 'docs', 'ax-final-problem-worksheet.md')
const riskyMcpFixturePath = 'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json'
const fixedMcpFixturePath = 'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json'
const riskyDiffFixturePath = 'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff'
const fixedDiffFixturePath = 'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff'
const transcriptFixturePath = 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'
const referencedFixturePaths = [
  riskyMcpFixturePath,
  fixedMcpFixturePath,
  riskyDiffFixturePath,
  fixedDiffFixturePath,
  transcriptFixturePath,
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

function readWorksheet(): string {
  return readFileSync(worksheetPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX final problem worksheet exists and is linked from public docs', () => {
  assert.ok(existsSync(worksheetPath), 'docs/ax-final-problem-worksheet.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX final company-problem worksheet\]\(docs\/ax-final-problem-worksheet\.md\)/)
  assert.match(examplesDoc, /\[AX final company-problem worksheet\]\(ax-final-problem-worksheet\.md\)/)
})

test('AX final problem worksheet has required Korean-first sections', () => {
  const worksheet = readWorksheet()

  const requiredHeadings = [
    '## 사용 목적',
    '## 10분 작성 순서',
    '## 회사 문제 입력 카드',
    '## 위험 언어 매핑',
    '## Evidence commands',
    '## 승인 조건 템플릿',
    '## 10분 데모 플랜',
    '## 금지 주장',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(worksheet, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    '회사 문제',
    'PR diff',
    'MCP config',
    'agent transcript',
    'BLOCK → REVIEW/PASS',
    '승인 조건',
    '10분',
  ] as const) {
    expectLiteral(worksheet, term)
  }
})

test('AX final problem worksheet pins existing fixture-backed commands', () => {
  const worksheet = readWorksheet()

  for (const fixturePath of referencedFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(worksheet, fixturePath)
  }

  const requiredCommands = [
    `node dist/index.js scan-mcp < ${riskyMcpFixturePath}`,
    `node dist/index.js scan-mcp < ${fixedMcpFixturePath}`,
    `node dist/index.js scan-diff < ${riskyDiffFixturePath}`,
    `node dist/index.js scan-diff < ${fixedDiffFixturePath}`,
    `node dist/index.js scan-log < ${transcriptFixturePath}`,
  ] as const

  for (const command of requiredCommands) {
    expectLiteral(worksheet, command)
  }
})

test('AX final problem worksheet cites public references without overclaiming them', () => {
  const worksheet = readWorksheet()

  const requiredReferenceUrls = [
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
    'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
    'https://github.com/snyk/agent-scan',
  ] as const

  for (const referenceUrl of requiredReferenceUrls) {
    expectLiteral(worksheet, referenceUrl)
  }

  assert.match(worksheet, /OWASP/)
  assert.match(worksheet, /MCP/)
  assert.match(worksheet, /agent\/MCP scanner category|agent scanner category|MCP scanner category/i)
  assert.match(worksheet, /참고|reference/i)

  assert.doesNotMatch(worksheet, /(?:certified|verified|audited)\s+(?:by|for)\s+OWASP/i)
  assert.doesNotMatch(worksheet, /OWASP\s*(?:인증|검증|감사|공식\s*승인)/i)
  assert.doesNotMatch(worksheet, /(?:MCP|Model Context Protocol)\s*(?:인증|검증|공식\s*승인)/i)
})

test('AX final problem worksheet avoids fake adoption and replacement claims', () => {
  const worksheet = readWorksheet()

  assert.doesNotMatch(worksheet, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(worksheet, /(?:SOC\s*2|ISO\s*27001)\s*(?:certified|compliant|인증|준수)/i)
  assert.doesNotMatch(worksheet, /(?:replace|replaces|대체|대신한다)[^\n]*(?:Snyk|scanner|platform|플랫폼)/i)
  assert.doesNotMatch(worksheet, /(?:Snyk|scanner|platform|플랫폼)[^\n]*(?:replace|replaces|대체|대신한다)/i)
  assert.doesNotMatch(worksheet, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+platform/i)
  assert.doesNotMatch(worksheet, /(?:executes|enforces|실행|강제)[^\n]*(?:MCP runtime|런타임\s*제어|runtime controls)/i)
  assert.doesNotMatch(worksheet, /(?:real\s+customer\s+data|운영\s*고객\s*데이터|고객\s*원천자료)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
