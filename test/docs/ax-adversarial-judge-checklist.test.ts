import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistPath = join(repoRoot, 'docs', 'ax-adversarial-judge-checklist.md')

const requiredFixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://github.com/snyk/agent-scan',
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

function readChecklist(): string {
  return readFileSync(checklistPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX adversarial judge checklist exists and is linked from public docs', () => {
  assert.ok(existsSync(checklistPath), 'docs/ax-adversarial-judge-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX adversarial judge checklist\]\(docs\/ax-adversarial-judge-checklist\.md\)/)
  assert.match(examplesDoc, /\[AX adversarial judge checklist\]\(ax-adversarial-judge-checklist\.md\)/)
})

test('AX adversarial judge checklist contains Korean-first judge sections', () => {
  const checklist = readChecklist()
  const requiredHeadings = [
    '## Purpose',
    '## Public references',
    '## Adversarial questions',
    '## Exact fixture-backed commands',
    '## Expected verdicts',
    '## Approval / hold conditions',
    '## Non-claim guardrails',
  ] as const

  assert.match(checklist, /^# AX adversarial judge checklist/m)
  assert.match(checklist, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(checklist, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX adversarial judge checklist maps exact fixture-backed commands to evidence contracts', () => {
  const checklist = readChecklist()

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(checklist, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(checklist, command)
  }

  for (const contract of [
    'Markdown report',
    'SARIF',
    'PR evidence',
    'ruleId',
    'results',
    'locations',
    'partialFingerprints',
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(checklist, contract)
  }
})

test('AX adversarial judge checklist cites public references with borrow avoid action notes', () => {
  const checklist = readChecklist()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(checklist, referenceUrl)
  }

  assert.match(checklist, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(checklist, /빌릴 점|Borrow/i)
  assert.match(checklist, /피할 점|Avoid/i)
  assert.match(checklist, /AgentGuard action|조치/i)
})

test('AX adversarial judge checklist bans fake claims and presentation renames', () => {
  const checklist = readChecklist()

  assert.doesNotMatch(checklist, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(checklist, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(checklist, /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(checklist, /(?:CLI|command|rule IDs?|룰 ID|규칙 ID)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  assert.doesNotMatch(checklist, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(checklist, /(?:SaaS|dashboard|auth|customer data|고객\s*데이터)[^\n]*(?:available|지원|제공|운영|production)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
