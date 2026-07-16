import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-security-reviewer-question-bank.md')

const publicUrls = [
  'https://github.com/snyk/agent-scan',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/security-reviewer-question-bank.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
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

test('AX security reviewer question bank exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-security-reviewer-question-bank.md should exist')
  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  assert.match(rootReadme, /\[AX security reviewer question bank\]\(docs\/ax-security-reviewer-question-bank\.md\)/)
  assert.match(examplesDoc, /\[AX security reviewer question bank\]\(ax-security-reviewer-question-bank\.md\)/)
})

test('AX security reviewer question bank maps reviewer questions to evidence commands', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX security reviewer question bank',
    '## Purpose',
    '## Public reference signals',
    '## Reviewer question bank',
    '## Exact fixture-backed evidence commands',
    '## Machine-contract boundary',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${heading}`, 'm'))
  }

  for (const url of publicUrls) expectLiteral(doc, url)
  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /\|\s*Security reviewer question\s*\|\s*Evidence command\s*\|\s*Expected handoff\s*\|\s*Decision owner\s*\|/)

  for (const phrase of [
    'agent/MCP/skill surface inventory',
    'least privilege',
    'explicit user consent',
    'workspace trust',
    'tool permission review',
    'SARIF reviewer handoff',
    'source-of-record',
    'unknown company problem',
  ] as const) {
    expectLiteral(doc, phrase)
  }
})

test('AX security reviewer question bank uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX security reviewer question bank preserves machine contracts and rejects fake claims', () => {
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
    .replace(/## Public reference signals[\s\S]*?(?=## Reviewer question bank)/, '')
    .replace(/## Non-claim guardrails[\s\S]*$/, '')
    .split('\n')
    .filter((line) => !/avoid|non-claim|guardrail|claim|not |do not|않는다|피하/i.test(line))
    .join('\n')

  for (const forbidden of [
    /customer adoption|real customer|고객\s*도입|도입\s*사례/i,
    /certified|certification|SOC\s*2|ISO[-\s]*27001|공식\s*인증/i,
    /Snyk[^\n]{0,80}(?:parity|replacement|대체|동등)|(?:parity|replacement|대체|동등)[^\n]{0,80}Snyk/i,
    /runtime[^\n]{0,80}(?:OAuth|session|consent|MCP)[^\n]{0,80}(?:enforcement|보장|강제)/i,
    /Anthropic[^\n]{0,80}(?:approval|보증|승인)|(?:approval|보증|승인)[^\n]{0,80}Anthropic/i,
  ] as const) {
    assert.doesNotMatch(claimScope, forbidden)
  }
})
