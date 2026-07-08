import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistPath = join(repoRoot, 'docs', 'ax-final-submission-smoke-checklist.md')

const requiredHeadings = [
  '# AX final submission smoke checklist',
  '## 10-minute final smoke path',
  '## Surface checks',
  '## Expected verdicts and artifacts',
  '## Judge wording guardrails',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/snyk/agent-scan',
  'https://github.com/splx-ai/agentic-radar',
  'https://github.com/Tencent/AI-Infra-Guard',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|fake adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i,
  /(?:OWASP|GitHub|Snyk|splx-ai|Tencent|AI-Infra-Guard)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed|replacement)/i,
  /(?:agent-scan|agentic-radar|AI-Infra-Guard|vendor[-\s]?scale)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX final submission smoke checklist exists and is linked from public docs', () => {
  assert.ok(existsSync(checklistPath), 'docs/ax-final-submission-smoke-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX final submission smoke checklist\]\(docs\/ax-final-submission-smoke-checklist\.md\)/)
  assert.match(examplesDoc, /\[AX final submission smoke checklist\]\(ax-final-submission-smoke-checklist\.md\)/)
})

test('AX final submission smoke checklist covers Korean-first final smoke surfaces', () => {
  const checklist = readChecklist()

  for (const heading of requiredHeadings) {
    assert.match(checklist, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(checklist, /한국어 우선/)
  assert.match(checklist, /npm ci && npm run build/)
  assert.match(checklist, /dist\/index\.js/)
  assert.match(checklist, /회사 문제|company problem/i)
  assert.match(checklist, /PR diff/)
  assert.match(checklist, /MCP config/)
  assert.match(checklist, /transcript\/log/)
  assert.match(checklist, /SARIF|report artifact/)
  assert.match(checklist, /PASS|REVIEW|BLOCK/)
})

test('AX final submission smoke checklist uses exact fixture-backed commands with existing paths', () => {
  const checklist = readChecklist()

  for (const { command, fixtures } of fixtureBackedCommands) {
    assert.ok(checklist.includes(command), `${command} should be documented exactly`)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(checklist.includes(fixturePath), `${fixturePath} should be documented`)
    }
  }

  assert.match(checklist, /PowerShell/)
  assert.match(checklist, /Get-Content examples\/risky-pr\.diff -Raw \| node dist\/index\.js scan-diff/)
  assert.match(checklist, /fixture-backed|합성 fixture|저장소 fixture/i)
  assert.match(checklist, /machine contracts/)
  assert.match(checklist, /CLI commands, rule IDs, JSON\/SARIF/)
})

test('AX final submission smoke checklist maps public references to borrow and avoid guidance', () => {
  const checklist = readChecklist()

  for (const referenceUrl of publicReferenceUrls) {
    assert.ok(checklist.includes(referenceUrl), `${referenceUrl} should be cited`)
  }

  assert.match(checklist, /Borrow/i)
  assert.match(checklist, /Avoid/i)
  assert.match(checklist, /OWASP Agentic AI threats\/mitigations/i)
  assert.match(checklist, /GitHub SARIF upload/i)
  assert.match(checklist, /Snyk agent-scan/i)
  assert.match(checklist, /splx-ai agentic-radar/i)
  assert.match(checklist, /Tencent AI-Infra-Guard/i)
})

test('AX final submission smoke checklist bans unsupported adoption, certification, parity, and portal claims', () => {
  const checklist = readChecklist()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(checklist, forbiddenClaimPattern)
  }

  assert.doesNotMatch(checklist, /비공개\s*(?:심사표|채점표|portal rule|포털\s*규칙|scoring)[^\n]*(?:확정|verified|confirmed)/i)
  assert.doesNotMatch(checklist, /full runtime monitoring|전체\s*런타임\s*모니터링/i)
  assert.doesNotMatch(checklist, /GitHub[^\n]{0,80}(?:자동\s*업로드|automatically uploads)/i)
})
