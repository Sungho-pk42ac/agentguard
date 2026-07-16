import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-workspace-trust-approval-checklist.md')

const publicUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning',
  'https://docs.anthropic.com/en/docs/claude-code/security',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/workspace-trust-approval.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
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

test('AX workspace trust approval checklist exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-workspace-trust-approval-checklist.md should exist')
  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  assert.match(rootReadme, /\[AX workspace trust approval checklist\]\(docs\/ax-workspace-trust-approval-checklist\.md\)/)
  assert.match(examplesDoc, /\[AX workspace trust approval checklist\]\(ax-workspace-trust-approval-checklist\.md\)/)
})

test('AX workspace trust approval checklist maps public signals to approval decisions', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX workspace trust approval checklist',
    '## Purpose',
    '## Public reference signals',
    '## Workspace trust approval checklist',
    '## Exact fixture-backed evidence commands',
    '## Machine-contract boundary',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${heading}`, 'm'))
  }

  for (const url of publicUrls) expectLiteral(doc, url)
  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /\|\s*Workspace trust question\s*\|\s*Evidence command\s*\|\s*Approval decision\s*\|\s*Rerun trigger\s*\|/)

  for (const phrase of [
    'workspace trust',
    'tool permission review',
    'least privilege',
    'explicit user consent',
    'source-of-record',
    'unknown company problem',
    'SARIF artifact',
  ] as const) {
    expectLiteral(doc, phrase)
  }
})

test('AX workspace trust approval checklist uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX workspace trust approval checklist preserves machine contracts and rejects fake claims', () => {
  const doc = readDoc()

  for (const machineContract of [
    'PASS',
    'REVIEW',
    'BLOCK',
    'scan-diff',
    'scan-mcp',
    'scan-log',
    '--json',
    '--sarif',
    '--out',
    'JSON/SARIF',
  ] as const) {
    expectLiteral(doc, machineContract)
  }

  const claimScope = doc
    .replace(/## Public reference signals[\s\S]*?(?=## Workspace trust approval checklist)/, '')
    .replace(/## Non-claim guardrails[\s\S]*$/, '')
    .split('\n')
    .filter((line) => !/avoid|non-claim|guardrail|claim|not |do not|않는다|않습니다|말하지|아니다|피하/i.test(line))
    .join('\n')

  for (const forbidden of [
    /customer adoption|real customer|고객\s*도입|도입\s*사례/i,
    /certified|certification|SOC\s*2|ISO[-\s]*27001|공식\s*인증/i,
    /(?:Snyk|GitHub|OWASP|Anthropic)[^\n]{0,100}(?:approval|approved|보증|승인|인증)/i,
    /(?:replacement|parity|대체|동등|equivalence|equivalent)[^\n]{0,100}(?:Snyk|GitHub|OWASP|Anthropic|MCP)|(?:Snyk|GitHub|OWASP|Anthropic|MCP)[^\n]{0,100}(?:replacement|parity|대체|동등|equivalence|equivalent)/i,
    /runtime[^\n]{0,100}(?:OAuth|session|consent|sandbox|MCP)[^\n]{0,100}(?:enforcement|보장|강제)/i,
  ] as const) {
    assert.doesNotMatch(claimScope, forbidden)
  }
})
