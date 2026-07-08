import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-ci-evidence-handoff-card.md')

const requiredFixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixturePaths: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixturePaths: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixturePaths: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
] as const

const requiredPublicReferences = [
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.snyk.io/snyk-cli',
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

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX CI evidence handoff card exists and is linked from docs entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-ci-evidence-handoff-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX CI evidence handoff card\]\(docs\/ax-ci-evidence-handoff-card\.md\)/)
  assert.match(examplesDoc, /\[AX CI evidence handoff card\]\(ax-ci-evidence-handoff-card\.md\)/)
})

test('AX CI evidence handoff card defines artifact-first CI reviewer flow', () => {
  const doc = readDoc()
  const requiredHeadings = [
    '# AX CI evidence handoff card',
    '## 사용 목적',
    '## Artifact-first CI flow',
    '## Company problem → CI step → preserved artifact → approval condition',
    '## GitHub Actions split-step pattern',
    '## Fixture-backed smoke commands',
    '## Public reference borrow/avoid/action table',
    '## Non-claim guardrails',
  ] as const

  assert.match(doc, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const phrase of [
    'BLOCK',
    'REVIEW',
    'PASS',
    'continue-on-error: true',
    'if: ${{ always() }}',
    'github/codeql-action/upload-sarif',
    'actions/upload-artifact',
    'agentguard.sarif',
    'Markdown report',
    'approval condition',
    'rerun condition',
  ] as const) {
    expectLiteral(doc, phrase)
  }
})

test('AX CI evidence handoff card maps only existing fixture-backed commands', () => {
  const doc = readDoc()

  for (const { command, fixturePaths } of requiredFixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixturePaths) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX CI evidence handoff card cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of requiredPublicReferences) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /빌릴 점|Borrow/i)
  assert.match(doc, /피할 점|Avoid/i)
})

test('AX CI evidence handoff card preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'scan-diff',
    'scan-mcp',
    'scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'PASS',
    'REVIEW',
    'BLOCK',
    'secret.github_token',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:CLI|command|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|package metadata|verdict values?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX CI evidence handoff card bans fake platform certification and adoption claims', () => {
  const doc = readDoc()

  assert.match(doc, /No customer claim/)
  assert.match(doc, /No certification claim/)
  assert.match(doc, /No platform-parity claim/)
  assert.match(doc, /No automatic upload claim/)

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved|conformance)/i)
  assert.doesNotMatch(doc, /(?:Snyk|GitHub)[^\n|.]{0,80}(?:대체|replacement|equivalent|동등)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
