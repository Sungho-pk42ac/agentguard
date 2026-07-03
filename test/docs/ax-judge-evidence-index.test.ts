import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-judge-evidence-index.md')

const fixturePaths = [
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
] as const

const exactCommands = [
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

test('AX judge evidence index exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-judge-evidence-index.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX judge evidence index\]\(docs\/ax-judge-evidence-index\.md\)/)
  assert.match(examplesDoc, /\[AX judge evidence index\]\(ax-judge-evidence-index\.md\)/)
})

test('AX judge evidence index maps exact existing fixtures and commands', () => {
  const doc = readDoc()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(doc.includes(fixturePath), `${fixturePath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(doc.includes(command), `${command} should be documented exactly`)
  }

  for (const term of ['회사 문제', '증거 카드', '예상 판정', '업무 영향', '승인 조건', '30초', 'BLOCK', 'REVIEW', 'PASS']) {
    assert.ok(doc.includes(term), `${term} should be present`)
  }
})

test('AX judge evidence index cites public references with borrow and avoid guidance', () => {
  const doc = readDoc()
  const requiredReferences = [
    'https://github.com/snyk/agent-scan',
    'https://github.com/Tencent/AI-Infra-Guard',
    'https://github.com/splx-ai/agentic-radar',
    'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  ] as const

  for (const reference of requiredReferences) {
    assert.ok(doc.includes(reference), `${reference} should be cited`)
  }

  assert.match(doc, /빌릴 점|borrow/i)
  assert.match(doc, /피할 점|avoid/i)
})

test('AX judge evidence index avoids unsupported adoption, certification, and replacement claims', () => {
  const doc = readDoc()

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(doc, /(?:GitHub\s+security\s+products?|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:대체|replacement)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
