import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-reference-run-trace.md')

const publicUrls = [
  'https://github.com/snyk/agent-scan',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://registry.npmjs.org/agent-scan',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.anthropic.com/en/docs/claude-code/security',
  'https://openai.github.io/openai-agents-python/guardrails/',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-run-trace.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
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

test('AX public reference run trace exists and is linked from examples', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-reference-run-trace.md should exist')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  assert.match(examplesDoc, /\[AX public reference run trace\]\(ax-public-reference-run-trace\.md\)/)
})

test('AX public reference run trace maps public signals to run decisions', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX public reference run trace',
    '## 목적',
    '## Public signals checked this run',
    '## Run decision matrix',
    '## Exact evidence commands',
    '## Machine-contract boundary',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${heading}`, 'm'))
  }

  for (const url of publicUrls) expectLiteral(doc, url)

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*How it shapes this slice\s*\|/)
  assert.match(doc, /\|\s*Judge question\s*\|\s*Source evidence\s*\|\s*AgentGuard command\s*\|\s*Approval action\s*\|/)
  assert.match(doc, /대상권|AX judging|unknown company problem/i)

  for (const phrase of [
    'agent/MCP server/skill scanning',
    'least privilege',
    'explicit user consent',
    'SARIF reviewer handoff',
    'public registry metadata',
    'agentic threat-to-mitigation',
    'workspace trust',
    'tool permission review',
    'guardrail tripwire',
    'source-of-record',
    'fresh-clone rerun',
    'approval owner',
  ] as const) {
    expectLiteral(doc, phrase)
  }
})

test('AX public reference run trace uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX public reference run trace preserves machine contracts and avoids fake claims', () => {
  const doc = readDoc()

  for (const machineContract of [
    'PASS',
    'REVIEW',
    'BLOCK',
    'scan-diff',
    'scan-mcp',
    'scan-log',
    '--sarif',
    '--out',
    'JSON/SARIF',
  ] as const) {
    expectLiteral(doc, machineContract)
  }

  for (const forbidden of [
    /customer adoption|real customer|고객\s*도입|도입\s*사례/i,
    /certified|certification|SOC\s*2|ISO[-\s]*27001|공식\s*인증/i,
    /Snyk[^\n]{0,80}(?:parity|replacement|대체|동등)|(?:parity|replacement|대체|동등)[^\n]{0,80}Snyk/i,
    /runtime[^\n]{0,80}(?:OAuth|session|consent)[^\n]{0,80}(?:enforcement|보장|강제)/i,
  ] as const) {
    assert.doesNotMatch(doc, forbidden)
  }
})
