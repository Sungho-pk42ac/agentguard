import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-onsite-pivot-guide.md')

const requiredDocLinks = [
  'docs/ax-onsite-pivot-guide.md',
  'docs/ax-company-problem-intake-kit.md',
  'docs/ax-judge-evidence-index.md',
  'docs/ax-before-after-rollout-demo.md',
  'docs/ax-live-demo-runbook.md',
] as const

const requiredFixturePaths = [
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const exactCommands = [
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
] as const

const publicReferences = [
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
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

test('AX onsite pivot guide exists and is linked from reviewer-facing entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-onsite-pivot-guide.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.ok(rootReadme.includes('[AX onsite pivot guide](docs/ax-onsite-pivot-guide.md)'))
  assert.ok(examplesDoc.includes('[AX onsite pivot guide](ax-onsite-pivot-guide.md)'))

  for (const link of requiredDocLinks.slice(1)) {
    assert.ok(existsSync(join(repoRoot, link)), `${link} should remain an existing handoff target`)
  }
})

test('AX onsite pivot guide maps company problem signals to exact existing evidence commands', () => {
  const doc = readDoc()

  for (const term of ['현장 피벗', 'company problem', 'PR diff', 'MCP config', 'agent transcript', 'BLOCK', 'REVIEW', 'PASS', '30초']) {
    assert.ok(doc.includes(term), `${term} should be present`)
  }

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(doc.includes(fixturePath), `${fixturePath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(doc.includes(command), `${command} should be documented exactly`)
  }
})

test('AX onsite pivot guide includes public-reference borrow and avoid guidance', () => {
  const doc = readDoc()

  for (const reference of publicReferences) {
    assert.ok(doc.includes(reference), `${reference} should be cited`)
  }

  assert.match(doc, /빌릴 점|borrow/i)
  assert.match(doc, /피할 점|avoid/i)
  assert.match(doc, /company problem/i)
  assert.match(doc, /evidence boundary/i)
})

test('AX onsite pivot guide avoids unsupported adoption, certification, and replacement claims', () => {
  const doc = readDoc()

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(doc, /(?:GitHub\s+security\s+products?|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:대체|replacement)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
