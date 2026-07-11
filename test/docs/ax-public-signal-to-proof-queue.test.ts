import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-signal-to-proof-queue.md')

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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file',
  'https://github.com/splx-ai/agentic-radar',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://www.npmjs.com/package/agentshield',
  'https://github.com/affaan-m/agentshield',
] as const

const requiredHeadings = [
  '# AX public signal-to-proof queue',
  '## 사용 목적',
  '## Public signal to proof queue',
  '## Exact fixture-backed commands',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract boundaries',
  '## Non-claim guardrails',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  for (let depth = 0; depth < 20; depth += 1) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  throw new Error('Could not find package.json in the directory tree')
}

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public signal-to-proof queue exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-signal-to-proof-queue.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public signal-to-proof queue\]\(docs\/ax-public-signal-to-proof-queue\.md\)/)
  assert.match(examplesReadme, /\[AX public signal-to-proof queue\]\(\.\.\/docs\/ax-public-signal-to-proof-queue\.md\)/)
  assert.match(examplesDoc, /\[AX public signal-to-proof queue\]\(ax-public-signal-to-proof-queue\.md\)/)
})

test('AX public signal-to-proof queue has Korean-first sections and queue decisions', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['한국어 우선', 'public signal', 'proof command', 'next artifact decision', 'AX 인재전쟁', 'AX Rollout Guard'] as const) {
    expectLiteral(doc, term)
  }

  assert.match(doc, /PR diff[\s\S]{0,900}Markdown[\s\S]{0,900}SARIF/i)
  assert.match(doc, /MCP[\s\S]{0,900}permission[\s\S]{0,900}review/i)
  assert.match(doc, /transcript\/log[\s\S]{0,900}approval[\s\S]{0,900}Markdown/i)
})

test('AX public signal-to-proof queue uses exact fixture-backed commands with existing paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX public signal-to-proof queue cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /빌릴 점|Borrow/i)
  assert.match(doc, /피할 점|Avoid/i)
  assert.match(doc, /AgentGuard action|조치/i)
  assert.match(doc, /MCP Authorization spec/i)
  assert.match(doc, /state mismatch|trusted redirect URI/i)
  assert.match(doc, /runtime OAuth|state validation|redirect URI validation/i)
})

test('AX public signal-to-proof queue preserves machine contracts and bans fake claims', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(doc, contract)
  }

  for (const requiredNonClaim of [
    'no scanner behavior change',
    'no default verdict/severity change',
    'no automatic SARIF upload',
    'no runtime authorization claim',
    'no real customer/adoption claim',
    'no external certification',
    'no platform parity claim',
  ] as const) {
    assert.match(doc, new RegExp(escapeRegExp(requiredNonClaim), 'i'))
  }

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(doc, /(?:SOC\s*2|ISO\s*27001|external certification|공식\s*인증)[^.\n|]{0,80}(?:achieved|complete|보유|획득|완료)/i)
  assert.doesNotMatch(doc, /(?:OWASP|GitHub|SARIF|Tencent|splx-ai|agentic-radar|agentshield)[^\r\n|.]{0,80}(?:공식\s*검증|검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등)/i)
  assert.doesNotMatch(doc, /(?:upload|triage|approval)[^\r\n|.]{0,80}(?:automatic|자동)/i)
  assert.doesNotMatch(doc, /(?:CLI commands?|rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|scanner|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
