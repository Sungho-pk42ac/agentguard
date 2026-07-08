import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const boardPath = join(repoRoot, 'docs', 'ax-6-hour-onsite-execution-board.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    paths: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    paths: ['examples/risky-mcp.json'],
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

const publicReferences = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

const sixHourTimeboxes = [
  '## 0-1h Intake',
  '## 1-2h Evidence selection',
  '## 2-3h Scan commands',
  '## 3-4h Fix or policy rerun',
  '## 4-5h SARIF and Markdown handoff',
  '## 5-6h Judge story',
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

function readBoard(): string {
  return readFileSync(boardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX 6-hour onsite execution board exists and is linked from public docs', () => {
  assert.ok(existsSync(boardPath), 'docs/ax-6-hour-onsite-execution-board.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.ok(rootReadme.includes('[AX 6-hour onsite execution board](docs/ax-6-hour-onsite-execution-board.md)'))
  assert.ok(examplesDoc.includes('[AX 6-hour onsite execution board](ax-6-hour-onsite-execution-board.md)'))
})

test('AX 6-hour onsite execution board is Korean-first with six hourly timeboxes', () => {
  const board = readBoard()

  assert.match(board, /^# AX 6-hour onsite execution board/m)
  assert.match(board, /한국어 우선/)
  for (const heading of sixHourTimeboxes) {
    assert.match(board, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(board, /intake[\s\S]{0,900}evidence selection[\s\S]{0,900}scan commands/i)
  assert.match(board, /fix or policy rerun[\s\S]{0,900}SARIF and Markdown handoff[\s\S]{0,900}Judge story/i)
  assert.match(board, /POSIX shell\(Bash\/Zsh\)/)
  expectLiteral(board, 'Get-Content examples/risky-pr.diff | node dist/index.js scan-diff')
})

test('AX 6-hour onsite execution board uses exact existing fixture-backed commands', () => {
  const board = readBoard()

  for (const { command, paths } of fixtureBackedCommands) {
    expectLiteral(board, command)
    for (const fixturePath of paths) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(board, fixturePath)
    }
  }

  for (const contract of ['PASS', 'REVIEW', 'BLOCK', 'JSON', 'SARIF', 'rule IDs', 'CLI commands'] as const) {
    expectLiteral(board, contract)
  }
  expectLiteral(board, 'examples/agentguard.sarif')
  expectLiteral(board, '.agentguard-demo/agentguard.sarif')

  assert.match(board, /`BLOCK`[^.\n]*(?:멈|중단|차단|stop)/i)
  assert.match(board, /`REVIEW`[^.\n]*(?:사람|검토|승인자|reviewer)/i)
  assert.match(board, /`PASS`[^.\n]*(?:finding|위험|차단)[^.\n]*(?:없|없는|줄어든|clear)/i)
})

test('AX 6-hour onsite execution board cites public references with borrow avoid action rows', () => {
  const board = readBoard()

  for (const reference of publicReferences) {
    expectLiteral(board, reference)
  }

  assert.match(board, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(board, /빌릴 점|Borrow/i)
  assert.match(board, /피할 점|Avoid/i)
  assert.match(board, /AgentGuard action|적용|조치/i)
})

test('AX 6-hour onsite execution board keeps fake claims and machine-contract renames out', () => {
  const board = readBoard()

  assert.match(board, /No fake adoption/)
  assert.match(board, /No customer claim/)
  assert.match(board, /No certification claim/)
  assert.match(board, /No gated scoring claim/)

  assert.doesNotMatch(board, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(board, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(board, /(?:OWASP|MCP|GitHub|AX)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(board, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(board, /(?:CLI commands?|rule IDs?|JSON|SARIF)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
