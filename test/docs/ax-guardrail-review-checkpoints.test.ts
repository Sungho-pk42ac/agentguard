import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-guardrail-review-checkpoints.md')

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://openai.github.io/openai-guardrails-python/',
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
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/guardrail-review/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:OpenAI|OWASP|MCP|GitHub|Anthropic)[^\n|]{0,120}(?:승인|인증|보증|endorsed|approved|verified|certified)/i,
  /(?:runtime|실시간)[^\n|]{0,120}(?:guardrail|authorization|OAuth|session|MCP)[^\n|]{0,120}(?:구현|강제|보장|차단|implemented|guaranteed|enforced)/i,
  /(?:고객(?:사)?\s*도입|customer adoption|production deployment|hosted dashboard|certification|scanner parity|replacement)/i,
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

test('AX guardrail review checkpoints doc exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-guardrail-review-checkpoints.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX guardrail review checkpoints\]\(docs\/ax-guardrail-review-checkpoints\.md\)/)
  assert.match(examplesDoc, /\[AX guardrail review checkpoints\]\(ax-guardrail-review-checkpoints\.md\)/)
})

test('AX guardrail review checkpoints map public guardrail signals to owner decisions', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX guardrail review checkpoints',
    '## 목적',
    '## Public references: Borrow / Avoid / AgentGuard action',
    '## Guardrail checkpoint map',
    '## Exact fixture-backed commands',
    '## Machine contracts',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(
    doc,
    /\|\s*Guardrail question\s*\|\s*Owner\s*\|\s*AgentGuard evidence\s*\|\s*Approval decision\s*\|\s*Rerun trigger\s*\|/,
  )

  for (const term of ['한국어', 'company problem', 'human oversight', 'least privilege', 'tripwire', 'reviewer handoff'] as const) {
    expectLiteral(doc, term)
  }
})

test('AX guardrail review checkpoints cite public references with Borrow Avoid AgentGuard action rows', () => {
  const doc = readDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(doc, publicReferenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const term of [
    'OWASP Agentic AI Threats and Mitigations',
    'MCP Security Best Practices',
    'GitHub SARIF support',
    'OpenAI Guardrails Python',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX guardrail review checkpoints use exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX guardrail review checkpoints preserve English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'PASS',
    'REVIEW',
    'BLOCK',
    'scan-diff',
    'scan-mcp',
    'scan-log',
    'JSON',
    'SARIF',
    'ruleId',
    'severity',
  ] as const) {
    expectLiteral(doc, contract)
  }
})

test('AX guardrail review checkpoints avoid unsupported runtime adoption certification and parity claims', () => {
  const doc = readDoc()
  const proseToScan = doc
    .split('\n')
    .filter(
      (line) =>
        !line.includes('No claim') &&
        !line.includes('Do not claim') &&
        !line.includes('Avoid:') &&
        !line.includes('avoid') &&
        !line.includes('does not') &&
        !line.trim().startsWith('- No ') &&
        !line.includes('not ') &&
        !line.includes('주장하지'),
    )
    .join('\n')

  for (const pattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(proseToScan, pattern)
  }

  for (const guardrail of [
    'No claim that AgentGuard runs OpenAI guardrails',
    'No claim that AgentGuard implements runtime MCP authorization',
    'No automatic SARIF upload claim',
    'No customer adoption, certification, scanner parity, or hosted dashboard claim',
  ] as const) {
    expectLiteral(doc, guardrail)
  }
})
