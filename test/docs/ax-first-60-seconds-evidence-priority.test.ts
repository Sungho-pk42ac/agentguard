import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-first-60-seconds-evidence-priority.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    paths: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    paths: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    paths: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'mkdir -p .agentguard-demo && node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    paths: ['examples/risky-pr.diff'],
  },
] as const

const referencedPaths = [
  'docs/ax-90-second-judge-evidence-tour.md',
  'docs/ax-mcp-consent-token-handoff.md',
  'docs/ax-sarif-reviewer-loop-card.md',
  'docs/ax-prompt-injection-evidence-routing-card.md',
  'examples/risky-mcp.json',
  'examples/risky-pr.diff',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const publicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX first-60-seconds evidence priority card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-first-60-seconds-evidence-priority.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.ok(rootReadme.includes('[AX first-60-seconds evidence priority card](docs/ax-first-60-seconds-evidence-priority.md)'))
  assert.ok(examplesDoc.includes('[AX first-60-seconds evidence priority card](ax-first-60-seconds-evidence-priority.md)'))
})

test('AX first-60-seconds evidence priority card keeps a Korean-first one-minute judge path', () => {
  const card = readCard()

  assert.match(card, /^# AX first-60-seconds evidence priority card/m)
  assert.match(card, /한국어 우선/)
  assert.match(card, /0-15초[\s\S]{0,700}15-35초[\s\S]{0,700}35-50초[\s\S]{0,700}50-60초/)
  assert.match(card, /회사 문제[\s\S]{0,900}MCP broad filesystem access[\s\S]{0,900}Markdown[\s\S]{0,900}SARIF/)
  assert.match(card, /static pre-rollout check/i)
})

test('AX first-60-seconds evidence priority card uses exact existing fixture-backed commands', () => {
  const card = readCard()

  for (const { command, paths } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of paths) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  for (const contract of ['PASS', 'REVIEW', 'BLOCK', 'JSON', 'SARIF', 'rule IDs', 'CLI commands'] as const) {
    expectLiteral(card, contract)
  }

  assert.match(card, /`BLOCK`[^.\n]*(?:멈|중단|차단|stop)/i)
  assert.match(card, /`REVIEW`[^.\n]*(?:사람|검토|승인자|reviewer)/i)
  assert.match(card, /`PASS`[^.\n]*(?:finding|차단|위험)[^.\n]*(?:없|없는|clear)/i)
})

test('AX first-60-seconds evidence priority card references only existing local docs and fixture paths', () => {
  const card = readCard()

  for (const referencedPath of referencedPaths) {
    assert.ok(existsSync(join(repoRoot, referencedPath)), `${referencedPath} should exist`)
    expectLiteral(card, referencedPath)
  }
})

test('AX first-60-seconds evidence priority PR-diff fixture stays synthetic and secret-free', () => {
  const fixture = readFileSync(join(repoRoot, 'examples', 'risky-pr.diff'), 'utf8')

  assert.doesNotMatch(fixture, /gh[pousr]_[A-Za-z0-9]{36}\b/)
  assert.doesNotMatch(fixture, /github_pat_[A-Za-z0-9_]{60,}\b/)
  assert.match(fixture, /\.env\.example/)
  assert.match(fixture, /DEPLOY_COMMAND=rm -rf \/tmp\/agentguard-demo/)
})

test('AX first-60-seconds evidence priority card cites public references with borrow avoid action rows', () => {
  const card = readCard()

  for (const reference of publicReferences) {
    expectLiteral(card, reference)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP[\s\S]{0,240}tool misuse/i)
  assert.match(card, /MCP security best practices[\s\S]{0,260}least privilege/i)
  assert.match(card, /GitHub SARIF code scanning[\s\S]{0,280}reviewer-channel/i)
})

test('AX first-60-seconds evidence priority card keeps non-claim guardrails and machine contracts', () => {
  const card = readCard()

  assert.match(card, /Synthetic fixtures remain synthetic/)
  assert.match(card, /do not represent real customer data/)
  assert.match(card, /does not claim MCP runtime control/)
  assert.match(card, /private judging-material knowledge/)
  assert.match(card, /CLI commands, rule IDs, JSON, SARIF, API, package metadata, and verdict vocabulary stay English-compatible/)

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|AX)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})
