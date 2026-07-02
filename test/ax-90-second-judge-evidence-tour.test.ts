import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-90-second-judge-evidence-tour.md')

const fixturePaths = [
  'examples/risky-mcp.json',
  'examples/risky-pr.diff',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const exactCommands = [
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
] as const

const requiredReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
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

test('AX 90-second judge evidence tour exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-90-second-judge-evidence-tour.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX 90-second judge evidence tour\]\(docs\/ax-90-second-judge-evidence-tour\.md\)/)
  assert.match(examplesDoc, /\[AX 90-second judge evidence tour\]\(ax-90-second-judge-evidence-tour\.md\)/)
})

test('AX 90-second judge evidence tour maps exact fixture-backed commands to verdict semantics', () => {
  const doc = readDoc()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(doc.includes(fixturePath), `${fixturePath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(doc.includes(command), `${command} should be documented exactly`)
  }

  for (const term of ['90초', '회사 문제', 'MCP', 'PR diff', 'transcript/log', 'SARIF', 'BLOCK', 'REVIEW', 'PASS', '승인 문장', 'parent directory']) {
    assert.ok(doc.includes(term), `${term} should be present`)
  }

  assert.match(doc, /`BLOCK`[^.\n]*(?:출시|배포|rollout)[^.\n]*(?:멈|중단|차단)/i)
  assert.match(doc, /`REVIEW`[^.\n]*(?:사람|검토|승인자)/i)
  assert.match(doc, /`PASS`[^.\n]*(?:finding|위험|차단)[^.\n]*(?:없|없는|줄어든)/i)
})

test('AX 90-second judge evidence tour cites references with borrow avoid and action notes', () => {
  const doc = readDoc()

  for (const reference of requiredReferences) {
    assert.ok(doc.includes(reference), `${reference} should be cited`)
  }

  assert.match(doc, /빌릴 점|borrow/i)
  assert.match(doc, /피할 점|avoid/i)
  assert.match(doc, /AgentGuard action|적용|action/i)
})

test('AX 90-second judge evidence tour keeps fake claims and presentation renames out', () => {
  const doc = readDoc()

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(doc, /(?:GitHub\s+security\s+products?|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:대체|replacement)/i)
  assert.doesNotMatch(doc, /(?:CLI|command|rule IDs?)[^\n|.]{0,80}(?:rename|renamed|이름\s*변경|표시용\s*변경)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(doc, /fingerprint/i)
})
