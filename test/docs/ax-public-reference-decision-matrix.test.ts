import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-reference-decision-matrix.md')

const sourceUrls = [
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/splx-ai/agentic-radar',
  'https://www.npmjs.com/package/agent-scan',
  'https://registry.npmjs.org/agent-scan',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-decision-matrix.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public reference decision matrix exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-reference-decision-matrix.md should exist')

  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(readme, /\[AX public reference decision matrix\]\(docs\/ax-public-reference-decision-matrix\.md\)/)
  assert.match(examplesDoc, /\[AX public reference decision matrix\]\(ax-public-reference-decision-matrix\.md\)/)
})

test('AX public reference decision matrix is Korean-first and cites this run source signals', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX public reference decision matrix',
    '## 목적',
    '## Public reference signals checked this run',
    '## Decision matrix',
    '## Exact evidence commands',
    '## Machine contracts preserved',
    '## Non-claim guardrails',
    '## 대상권 operator line',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const url of sourceUrls) expectLiteral(doc, url)
  for (const phrase of [
    'normal public fetch succeeded',
    'WAF/HTTP 403 from this Hermes environment',
    'public registry fallback succeeded',
    'source status first, evidence command second',
    'blocked page is not product evidence',
    'registry metadata is category pressure only',
    'stop at auth boundary',
  ] as const) {
    expectLiteral(doc, phrase)
  }
})

test('AX public reference decision matrix maps source statuses to commands and decisions', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*Source status\s*\|\s*Borrow\s*\|\s*Next AgentGuard evidence command\s*\|\s*Operator decision\s*\|\s*Do not claim\s*\|/,
  )

  for (const status of [
    'PUBLIC_FETCH_200',
    'PUBLIC_WAF_403',
    'PUBLIC_REGISTRY_FALLBACK_200',
    'AUTH_REQUIRED_STOP',
    'INSANE_SEARCH_UNAVAILABLE',
  ] as const) {
    expectLiteral(doc, status)
  }

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixture of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixture)), `${fixture} should exist`)
      expectLiteral(doc, fixture)
    }
  }
})

test('AX public reference decision matrix preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'agentguard doctor',
    '--policy',
    '--sarif',
    '--out',
    '--json',
    '--lang en',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON/SARIF fields',
    'rule IDs',
    'GitHub Action inputs/outputs',
  ] as const) {
    expectLiteral(doc, contract)
  }
})

test('AX public reference decision matrix rejects unsupported adoption, certification, parity, runtime, and upload claims', () => {
  const doc = readDoc()
  const linesToScan = doc
    .split('\n')
    .filter((line) => !/^(?:\| |-|## Non-claim guardrails|no )/.test(line.trim()))
    .join('\n')

  for (const requiredGuardrail of [
    'no customer/adoption claim',
    'no external certification',
    'no scanner parity/replacement claim',
    'no runtime authorization claim',
    'no automatic SARIF upload claim',
    'no insane-search overclaim',
  ] as const) {
    expectLiteral(doc, requiredGuardrail)
  }

  assert.doesNotMatch(linesToScan, /(?:actual|real)\s+customer|실고객|도입\s*(?:완료|사례)|customer adoption/i)
  assert.doesNotMatch(linesToScan, /SOC\s*2|ISO[-\s]*27001|certified|certification|공식\s*인증/i)
  assert.doesNotMatch(linesToScan, /(?:agent-scan|agentic-radar|public scanners?)[^\n]{0,120}(?:replacement|parity|대체|동등|equivalent)/i)
  assert.doesNotMatch(linesToScan, /runtime[^\n]{0,120}(?:OAuth|authorization|session|consent)[^\n]{0,120}(?:enforcement|guarantee|보장|지원)/i)
  assert.doesNotMatch(linesToScan, /automatically?\s+uploads?\s+SARIF|SARIF\s+자동\s+업로드/i)
})
