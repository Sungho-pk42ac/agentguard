import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const glossaryPath = join(repoRoot, 'docs', 'ax-verdict-vocabulary-glossary.md')

const requiredFixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
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
  {
    command: 'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff',
    fixturePaths: ['examples/risky-pr.diff'],
  },
] as const

const requiredPublicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://github.com/snyk/agent-scan',
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

function readGlossary(): string {
  return readFileSync(glossaryPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX verdict vocabulary glossary exists and is linked from docs surfaces', () => {
  assert.ok(existsSync(glossaryPath), 'docs/ax-verdict-vocabulary-glossary.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX verdict vocabulary glossary\]\(docs\/ax-verdict-vocabulary-glossary\.md\)/)
  assert.match(examplesDoc, /\[AX verdict vocabulary glossary\]\(ax-verdict-vocabulary-glossary\.md\)/)
})

test('AX verdict vocabulary glossary is Korean-first and covers required judge-facing terms', () => {
  const glossary = readGlossary()
  const requiredHeadings = [
    '# AX verdict vocabulary glossary',
    '## Glossary',
    '## Fixture-backed evidence commands',
    '## Public reference influence',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const

  assert.match(glossary, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(glossary, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    'PASS',
    'REVIEW',
    'BLOCK',
    'PR diff',
    'MCP config',
    'transcript/log',
    'SARIF',
    'evidence owner',
    'residual risk',
    'rerun condition',
  ] as const) {
    expectLiteral(glossary, term)
  }
})

test('AX verdict vocabulary glossary maps only existing fixture-backed commands', () => {
  const glossary = readGlossary()

  for (const { command, fixturePaths } of requiredFixtureBackedCommands) {
    expectLiteral(glossary, command)
    for (const fixturePath of fixturePaths) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(glossary, fixturePath)
    }
  }
})

test('AX verdict vocabulary glossary cites public references with borrow avoid notes', () => {
  const glossary = readGlossary()

  for (const referenceUrl of requiredPublicReferences) {
    expectLiteral(glossary, referenceUrl)
  }

  assert.match(glossary, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard wording\s*\|/)
  assert.match(glossary, /빌릴 점|Borrow/i)
  assert.match(glossary, /피할 점|Avoid/i)
})

test('AX verdict vocabulary glossary preserves English-compatible machine contracts', () => {
  const glossary = readGlossary()

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
    'package metadata',
    'PASS',
    'REVIEW',
    'BLOCK',
    'generic-secret-assignment',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(glossary, contract)
  }

  assert.doesNotMatch(glossary, /(?:CLI|command|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|package metadata|verdict values?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX verdict vocabulary glossary bans certification adoption and parity claims', () => {
  const glossary = readGlossary()

  assert.match(glossary, /No customer claim/)
  assert.match(glossary, /No certification claim/)
  assert.match(glossary, /No platform-parity claim/)
  assert.match(glossary, /No automatic SARIF upload claim/)

  assert.doesNotMatch(glossary, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(glossary, /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved|conformance)/i)
  assert.doesNotMatch(glossary, /(?:Snyk|GitHub)[^\n|.]{0,80}(?:대체|replacement|equivalent|동등)/i)
  assert.doesNotMatch(glossary, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
