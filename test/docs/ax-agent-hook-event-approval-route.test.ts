import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-agent-hook-event-approval-route.md')

const publicReferenceUrls = [
  'https://docs.anthropic.com/en/docs/claude-code/hooks',
  'https://openai.github.io/openai-agents-python/guardrails/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning',
] as const

const fixtureBackedCommands = [
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-hook-event/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js doctor --json',
    fixtures: [] as string[],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance/i,
  /(?:OpenAI|Anthropic|GitHub|MCP)[^\n|]{0,120}(?:검증(?:이|을)?\s*완료|인증(?:이|을)?\s*완료|official\s+(?:approval|endorsement)|approved|verified|endorsed)|(?:official\s+(?:approval|endorsement)|approved|verified|endorsed)[^\n|]{0,120}(?:OpenAI|Anthropic|GitHub|MCP)/i,
  /(?:GitHub code scanning|Snyk|OWASP|MCP|Claude Code security controls)[^\n|]{0,120}(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)|(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)[^\n|]{0,120}(?:GitHub code scanning|Snyk|OWASP|MCP|Claude Code security controls)/i,
  /(?:runtime|실시간)[^\n|]{0,120}(?:OAuth|authorization|session|redirect|tool interception|guardrail|enforcement)[^\n|]{0,120}(?:강제|보장|지원|구현|차단|enforcement|implemented|guaranteed)/i,
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

test('AX agent hook event approval route exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-agent-hook-event-approval-route.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX agent hook event approval route\]\(docs\/ax-agent-hook-event-approval-route\.md\)/)
  assert.match(examplesDoc, /\[AX agent hook event approval route\]\(ax-agent-hook-event-approval-route\.md\)/)
})

test('AX agent hook event approval route is Korean-first and maps hooks to approval decisions', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX agent hook event approval route',
    '## 목적',
    '## Hook event approval route',
    '## Exact fixture-backed commands',
    '## Public references: Borrow / Avoid / AgentGuard action',
    '## Machine contracts',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어',
    'agent hook/tool event',
    'source-of-record evidence',
    'Approval decision',
    'Rerun trigger',
    'PASS',
    'REVIEW',
    'BLOCK',
  ] as const) {
    expectLiteral(doc, term)
  }

  assert.match(
    doc,
    /\|\s*Hook\/event question\s*\|\s*AgentGuard evidence\s*\|\s*Approval decision\s*\|\s*Rerun trigger\s*\|/,
  )
})

test('AX agent hook event approval route cites public references with Borrow Avoid AgentGuard action rows', () => {
  const doc = readDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(doc, publicReferenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const term of [
    'Anthropic Claude Code Hooks',
    'OpenAI Agents SDK Guardrails',
    'MCP Authorization',
    'GitHub code scanning',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX agent hook event approval route uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX agent hook event approval route preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-log',
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'agentguard doctor',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON',
    'SARIF',
    'ruleId',
    'locations',
    'severity',
  ] as const) {
    expectLiteral(doc, contract)
  }
})

test('AX agent hook event approval route avoids unsupported adoption certification parity and runtime claims', () => {
  const doc = readDoc()
  const proseToScan = doc
    .split('\n')
    .filter(
      (line) =>
        !line.includes('No claim') &&
        !line.includes('Do not claim') &&
        !line.includes('English-compatible') &&
        !line.includes('machine-compatible') &&
        !line.includes('does not') &&
        !line.includes('not a') &&
        !line.includes('주장하지'),
    )
    .join('\n')

  for (const pattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(proseToScan, pattern)
  }

  for (const guardrail of [
    'No claim that AgentGuard controls Claude Code Hooks',
    'No claim that AgentGuard runs OpenAI guardrails',
    'automatic SARIF upload',
    'runtime authorization service',
  ] as const) {
    expectLiteral(doc, guardrail)
  }
})
