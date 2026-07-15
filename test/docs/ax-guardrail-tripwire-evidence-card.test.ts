import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-guardrail-tripwire-evidence-card.md')

const publicReferenceUrls = [
  'https://openai.github.io/openai-agents-python/guardrails/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/guardrail-tripwire/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance/i,
  /(?:OWASP|MCP|GitHub|OpenAI|Snyk|CodeQL)[^\n|]{0,120}(?:검증(?:이|을)?\s*완료|인증(?:이|을)?\s*완료|official\s+public\s+approval|approved|verified|endorsed)|official\s+public\s+approval[^\n|]{0,120}(?:OWASP|MCP|GitHub|OpenAI|Snyk|CodeQL)/i,
  /(?:Snyk|GitHub code scanning|CodeQL|OpenAI Agents SDK|OWASP|MCP|public tools?)[^\n|]{0,120}(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)|(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)[^\n|]{0,120}(?:Snyk|GitHub code scanning|CodeQL|OpenAI Agents SDK|OWASP|MCP|public tools?)/i,
  /(?:runtime|실시간)[^\n|]{0,120}(?:guardrail|tripwire|OAuth|authorization|session|consent|token|tool interception)[^\n|]{0,120}(?:enforcement|강제|보장|지원|차단)/i,
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

test('AX guardrail tripwire evidence card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-guardrail-tripwire-evidence-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX guardrail tripwire evidence card\]\(docs\/ax-guardrail-tripwire-evidence-card\.md\)/)
  assert.match(examplesDoc, /\[AX guardrail tripwire evidence card\]\(ax-guardrail-tripwire-evidence-card\.md\)/)
})

test('AX guardrail tripwire evidence card is Korean-first and maps tripwire decisions to evidence', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX guardrail tripwire evidence card',
    '## 목적',
    '## Tripwire decision table',
    '## Exact fixture-backed commands',
    '## Public references: Borrow / Avoid / AgentGuard action',
    '## Observed smoke contract',
    '## Machine contracts',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['한국어', '기업 승인자', 'tripwire', 'guardrail', 'source-of-record', 'approval decision', 'rerun trigger'] as const) {
    expectLiteral(doc, term)
  }

  assert.match(
    doc,
    /\|\s*Tripwire signal\s*\|\s*AgentGuard evidence\s*\|\s*Approval decision\s*\|\s*Rerun trigger\s*\|/,
  )
})

test('AX guardrail tripwire evidence card states observed smoke exits and verdict meaning', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*Evidence lane\s*\|\s*Expected exit\s*\|\s*Expected verdict\s*\|\s*Source-of-record meaning\s*\|/,
  )

  for (const row of [
    ['PR diff', '1', 'REVIEW', 'generic-secret-assignment'],
    ['MCP config', '0', 'REVIEW', 'mcp-filesystem-wide-root'],
    ['Transcript/log', '0', 'REVIEW', 'denied-command'],
    ['SARIF artifact', '1', 'REVIEW', 'SARIF 2.1.0'],
  ] as const) {
    for (const value of row) expectLiteral(doc, value)
  }

  expectLiteral(doc, 'non-zero exit is expected evidence')
  expectLiteral(doc, 'automatic upload')
})

test('AX guardrail tripwire evidence card cites public references with Borrow Avoid AgentGuard action rows', () => {
  const doc = readDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(doc, publicReferenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const term of ['OpenAI Agents SDK Guardrails', 'MCP Authorization spec', 'GitHub SARIF support', 'GitHub SARIF upload', 'OWASP Agentic AI threats'] as const) {
    expectLiteral(doc, term)
  }
})

test('AX guardrail tripwire evidence card uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX guardrail tripwire evidence card preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    '--policy',
    '--sarif',
    '--out',
    'PASS',
    'REVIEW',
    'BLOCK',
    'generic-secret-assignment',
    'denied-command',
    'mcp-filesystem-wide-root',
    'mcp-env-token',
    'JSON',
    'SARIF',
    'ruleId',
    'locations',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:CLI|명령어|rule IDs?|룰 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX guardrail tripwire evidence card rejects unsupported adoption certification parity runtime and platform claims', () => {
  const doc = readDoc()
  const claimSurface = doc
    .split('## Non-claim guardrails')[0]
    .split('\n')
    .filter((line) => !/(Avoid|말하지 않습니다|must not claim|claims?\.|claim:|구현한다고 말하지|범위가 아닙니다)/i.test(line))
    .join('\n')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(claimSurface, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 SOC 2 공식 인증을 받은 제품입니다.',
    'AgentGuard는 OpenAI 공식 인증을 받은 제품입니다.',
    'AgentGuard has official public approval from GitHub.',
    'AgentGuard는 GitHub code scanning 대체 parity 도구입니다.',
    'AgentGuard is compatible with OpenAI Agents SDK.',
    'AgentGuard guarantees runtime guardrail enforcement.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
