import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-evidence-pack-exit-criteria.md')

const publicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://registry.npmjs.org/agent-scan',
] as const

const evidenceCommands = [
  {
    command: 'node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    verdict: 'Expected verdict: `REVIEW`',
  },
  {
    command: 'node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    verdict: 'Expected verdict: `BLOCK`',
  },
  {
    command:
      'node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    verdict: 'Expected verdict: `REVIEW`',
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/evidence-pack-exit/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    verdict: 'Expected artifact: `.agentguard-demo/evidence-pack-exit/agentguard.sarif`',
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

test('AX evidence pack exit criteria card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-evidence-pack-exit-criteria.md should exist')

  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(readme, /\[AX evidence pack exit criteria card\]\(docs\/ax-evidence-pack-exit-criteria\.md\)/)
  assert.match(examplesDoc, /\[AX evidence pack exit criteria card\]\(ax-evidence-pack-exit-criteria\.md\)/)
})

test('AX evidence pack exit criteria card is Korean-first and defines accept rerun block decisions', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX evidence pack exit criteria card',
    '## 목적',
    '## Exit decision matrix',
    '## Evidence pack checklist',
    '## Exact verification commands',
    '## Public reference borrow/avoid/action table',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
    '## 대상권 operator line',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    'ACCEPT',
    'RERUN_REQUIRED',
    'BLOCK_HANDOFF',
    'source-of-record',
    'fresh clone',
    'reviewer handoff',
    'approval owner',
    'rerun trigger',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX evidence pack exit criteria card cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const reference of publicReferences) expectLiteral(doc, reference)
  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const phrase of [
    'Agentic AI - OWASP Lists Threats and Mitigations',
    'Uploading a SARIF file to GitHub - GitHub Docs',
    'agent-scan',
    'Detect suspicious AI agents activities on GitHub',
    'category pressure',
  ] as const) {
    expectLiteral(doc, phrase)
  }
})

test('AX evidence pack exit criteria card uses exact fixture-backed commands and existing fixtures', () => {
  const doc = readDoc()

  for (const row of evidenceCommands) {
    expectLiteral(doc, row.command)
    expectLiteral(doc, row.verdict)
    expectLiteral(doc, row.fixture)
    assert.ok(existsSync(join(repoRoot, row.fixture)), `${row.fixture} should exist`)
  }

  for (const surface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact'] as const) {
    expectLiteral(doc, surface)
  }
})

test('AX evidence pack exit criteria card preserves machine contracts and avoids unsupported claims', () => {
  const doc = readDoc()
  const linesToScan = doc
    .split('\n')
    .filter((line) => !/^(?:\| |-|## Non-claim guardrails|no )/.test(line.trim()))
    .join('\n')

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    '--json',
    '--sarif',
    '--out',
    '--policy',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON/SARIF fields',
    'rule IDs',
  ] as const) {
    expectLiteral(doc, contract)
  }

  for (const guardrail of [
    'no customer/adoption claim',
    'no external certification',
    'no scanner parity/replacement claim',
    'no runtime authorization claim',
    'no automatic SARIF upload claim',
  ] as const) {
    expectLiteral(doc, guardrail)
  }

  assert.doesNotMatch(linesToScan, /(?:actual|real)\s+customer|실고객|도입\s*(?:완료|사례)|customer adoption/i)
  assert.doesNotMatch(linesToScan, /SOC\s*2|ISO[-\s]*27001|certified|certification|공식\s*인증/i)
  assert.doesNotMatch(linesToScan, /(?:agent-scan|public scanners?)[^\n]{0,120}(?:replacement|parity|대체|동등|equivalent)/i)
  assert.doesNotMatch(linesToScan, /runtime[^\n]{0,120}(?:OAuth|authorization|session|consent)[^\n]{0,120}(?:enforcement|guarantee|보장|지원)/i)
})
