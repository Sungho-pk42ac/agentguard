import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-onsite-triage-card.md')

const requiredHeadings = [
  '## 5-minute onsite triage',
  '## Company problem signal map',
  '## Fixture-backed evidence commands',
  '## Public reference grounding',
  '## English-compatible machine contract',
  '## Non-claims',
] as const

const requiredFixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'examples/agentguard.sarif',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff',
] as const

const publicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://www.npmjs.com/package/agent-scan',
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

test('AX onsite triage card exists and is linked from the root README', () => {
  assert.ok(existsSync(docPath), 'docs/ax-onsite-triage-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX onsite triage card\]\(docs\/ax-onsite-triage-card\.md\)/)
})

test('AX onsite triage card maps company problem signals to fixture-backed verdict evidence', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['회사 문제 신호', 'PR diff', 'MCP config', 'agent transcript', 'SARIF', 'PASS', 'REVIEW', 'BLOCK']) {
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

test('AX onsite triage card cites public references with borrow, avoid, and blocked-fetch boundaries', () => {
  const doc = readDoc()

  for (const reference of publicReferences) {
    assert.ok(doc.includes(reference), `${reference} should be cited`)
  }

  assert.match(doc, /빌릴 점|borrow/i)
  assert.match(doc, /피할 점|avoid/i)
  assert.match(doc, /403|blocked normal fetch/i)
  assert.match(doc, /threats? to controls?|위협.*통제|mitigations?/i)
})

test('AX onsite triage card keeps machine fields English-compatible and avoids unsupported claims', () => {
  const doc = readDoc()

  for (const term of ['CLI commands', 'rule IDs', 'JSON', 'SARIF', 'API', 'machine fields', 'English-compatible']) {
    assert.ok(doc.includes(term), `${term} should be present`)
  }

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(doc, /(?:GitHub\s+security\s+products?|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
