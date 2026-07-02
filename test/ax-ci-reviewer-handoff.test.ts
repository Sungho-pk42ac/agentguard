import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-ci-reviewer-handoff.md')

const publicReferences = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://github.com/snyk/agent-scan',
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

function readHandoff(): string {
  return readFileSync(docPath, 'utf8')
}

test('AX CI reviewer handoff exists and is linked from README', () => {
  assert.ok(existsSync(docPath), 'docs/ax-ci-reviewer-handoff.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX CI reviewer handoff\]\(docs\/ax-ci-reviewer-handoff\.md\)/)
})

test('AX CI reviewer handoff maps company problems to reviewer approval artifacts', () => {
  const handoff = readHandoff()

  assert.match(handoff, /^# AX CI reviewer handoff/m)
  assert.match(handoff, /한국어 우선/)
  assert.match(
    handoff,
    /\|\s*회사 문제\s*\|\s*AgentGuard surface\s*\|\s*CI\/reviewer artifact\s*\|\s*approval decision\s*\|/,
  )

  for (const phrase of ['PR diff', 'MCP config', 'transcript/log', 'SARIF', 'Markdown', 'PR comment', 'BLOCK', 'PASS']) {
    assert.ok(handoff.includes(phrase), `${phrase} should be present`)
  }
})

test('AX CI reviewer handoff cites public references with borrow avoid and action language', () => {
  const handoff = readHandoff()

  let citedReferenceCount = 0
  for (const reference of publicReferences) {
    if (handoff.includes(reference)) citedReferenceCount += 1
  }

  assert.ok(citedReferenceCount >= 3, 'at least three public references should be cited')
  assert.match(handoff, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(handoff, /Borrow|빌릴 점/)
  assert.match(handoff, /Avoid|피할 점/)
  assert.match(handoff, /AgentGuard action|실행/)
})

test('AX CI reviewer handoff uses exact fixture-backed CLI commands', () => {
  const handoff = readHandoff()

  for (const { command, fixtures } of fixtureBackedCommands) {
    assert.ok(handoff.includes(command), `${command} should be documented exactly`)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(handoff.includes(fixturePath), `${fixturePath} should be documented`)
    }
  }
})

test('AX CI reviewer handoff preserves machine contracts and bans fake claims', () => {
  const handoff = readHandoff()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'SARIF',
    'BLOCK',
    'PASS',
  ] as const) {
    assert.ok(handoff.includes(contract), `${contract} should stay documented`)
  }

  assert.doesNotMatch(handoff, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(handoff, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(
    handoff,
    /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement|대체)/i,
  )
  assert.doesNotMatch(handoff, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
