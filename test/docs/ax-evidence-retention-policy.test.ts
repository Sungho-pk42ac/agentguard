import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-evidence-retention-policy.md')

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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/retention/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    const hasPackage = existsSync(join(currentDir, 'package.json'))
    const hasDocs = existsSync(join(currentDir, 'docs'))
    const hasTests = existsSync(join(currentDir, 'test'))
    if (hasPackage && hasDocs && hasTests) return currentDir

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find repo root in the directory tree')
    currentDir = parentDir
  }
}

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX evidence retention policy card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-evidence-retention-policy.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX evidence retention policy card\]\(docs\/ax-evidence-retention-policy\.md\)/)
  assert.match(examplesReadme, /\[AX evidence retention policy card\]\(\.\.\/docs\/ax-evidence-retention-policy\.md\)/)
})

test('AX evidence retention policy card contains Korean-first operations sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 사용 목적',
    '## Retention policy matrix',
    '## Source-of-record artifacts',
    '## Fixture-backed rerun commands',
    '## Expiry and rerun triggers',
    '## Reviewer handoff checklist',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract and fake-claim guardrails',
  ] as const

  assert.match(card, /^# AX evidence retention policy card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX evidence retention policy card maps artifacts to owners windows and rerun triggers', () => {
  const card = readCard()

  assert.match(card, /\|\s*Evidence artifact\s*\|\s*Source of record\s*\|\s*Retention owner\s*\|\s*Suggested retention window\s*\|\s*Expiry\/rerun trigger\s*\|/)
  for (const term of [
    'Markdown report',
    'JSON findings',
    'SARIF',
    'PR comment',
    'GitHub Actions artifact',
    'Security reviewer',
    'Approver',
    'git SHA',
    'policy version',
    'rule IDs',
    'rerun trigger',
    'fresh evidence',
  ] as const) {
    expectLiteral(card, term)
  }

  assert.match(card, /30\s*days|30일/)
  assert.match(card, /90\s*days|90일/)
  assert.match(card, /same commit SHA|같은 git SHA|same git SHA/i)
})

test('AX evidence retention policy card uses exact existing fixture-backed commands', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.ok(existsSync(join(repoRoot, 'examples/agentguard.sarif')), 'examples/agentguard.sarif should exist')
  expectLiteral(card, 'examples/agentguard.sarif')

  for (const contract of ['PASS', 'REVIEW', 'BLOCK', 'scan-diff', 'scan-mcp', 'scan-log', 'JSON', 'SARIF'] as const) {
    expectLiteral(card, contract)
  }
})

test('AX evidence retention policy card cites public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /Borrow|빌릴 점/i)
  assert.match(card, /Avoid|피할 점/i)
  assert.match(card, /AgentGuard action|적용|조치/i)
})

test('AX evidence retention policy card bans unsupported adoption certification parity and hosted-retention claims', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|GitHub|MCP)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:hosted|cloud|SaaS)[^\n|.]{0,80}(?:retention|보존)[^\n|.]{0,80}(?:provided|제공|guaranteed|보장)/i)
  assert.doesNotMatch(card, /(?:CLI|command|rule IDs?|JSON|SARIF|API|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
