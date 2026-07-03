import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-judge-evidence-ladder.md')

const fixturePaths = [
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const

const publicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://github.com/snyk/agent-scan',
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

test('AX judge evidence ladder exists and is linked from README AX docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-judge-evidence-ladder.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

  assert.match(rootReadme, /\[AX judge evidence ladder\]\(docs\/ax-judge-evidence-ladder\.md\)/)
})

test('AX judge evidence ladder maps exact commands to existing fixtures and verdicts', () => {
  const doc = readDoc()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(doc.includes(fixturePath), `${fixturePath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(doc.includes(command), `${command} should be documented exactly`)
  }

  for (const term of ['public reference', 'borrow', 'avoid', 'slice-shape', 'BLOCK', 'REVIEW', 'PASS', 'npm run build']) {
    assert.ok(doc.includes(term), `${term} should be present`)
  }

  assert.match(doc, /업무 승인 문장|business approval sentence/)
})

test('AX judge evidence ladder grounds each reference with borrow avoid and slice-shape columns', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*borrow\s*\|\s*avoid\s*\|\s*slice-shape\s*\|/)

  for (const reference of publicReferences) {
    assert.ok(doc.includes(reference), `${reference} should be cited`)
  }
})

test('AX judge evidence ladder avoids unsupported adoption certification and parity claims', () => {
  const doc = readDoc()

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(doc, /(?:GitHub\s+security\s+products?|Snyk)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
