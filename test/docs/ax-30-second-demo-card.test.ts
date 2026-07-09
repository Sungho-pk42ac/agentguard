import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-30-second-demo-card.md')

const requiredFixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-transcript.log',
  'examples/agent-policy.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
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

test('AX 30-second demo command card exists and is linked from the root README', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-30-second-demo-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX 30-second demo command card\]\(docs\/ax-30-second-demo-card\.md\)/)
})

test('AX 30-second demo command card is Korean-first and separates claim boundaries', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 30초 command card',
    '## Public confirmed facts',
    '## Current repo evidence',
    '## Gated unknowns',
    '## Non-claims',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['회사 문제', 'agent/tool surface', 'evidence verdict', '승인 게이트'] as const) {
    expectLiteral(card, term)
  }
})

test('AX 30-second demo command card maps exact fixture-backed commands to verdicts and approval sentences', () => {
  const card = readCard()

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(card, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(card, command)
  }
  for (const command of ['npm ci', 'npm run build', 'npm run smoke:ax-demo'] as const) {
    expectLiteral(card, command)
  }
  expectLiteral(card, '.agentguard-demo/ax-evidence-smoke/manifest.json')
  expectLiteral(card, 'node dist/index.js')

  for (const verdict of ['Expected verdict: `BLOCK`', 'Expected verdict: `REVIEW`'] as const) {
    expectLiteral(card, verdict)
  }

  assert.match(card, /PR diff[\s\S]{0,800}업무 승인 문장:/)
  assert.match(card, /MCP config[\s\S]{0,800}업무 승인 문장:/)
  assert.match(card, /transcript\/log[\s\S]{0,800}업무 승인 문장:/)
})

test('AX 30-second demo command card cites public sources without unsupported adoption or certification claims', () => {
  const card = readCard()
  const requiredReferences = [
    'https://hackathon.jocodingax.ai/',
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
    'https://github.com/snyk/agent-scan',
    'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  ] as const

  for (const reference of requiredReferences) {
    expectLiteral(card, reference)
  }

  assert.match(card, /빌릴 점|Borrow/i)
  assert.match(card, /피할 점|Avoid/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|Snyk|GitHub)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
