import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-third-party-agent-scanner-due-diligence.md')

const publicReferenceUrls = [
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/third-party-scanner-due-diligence.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?\s*(?:도입|사례|사용)|real customer adoption|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant/i,
  /(?:OWASP|MCP|GitHub|Snyk|Tencent|AI-Infra-Guard|splx(?:-ai)?|agentic-radar)[^\n|]{0,120}(?:검증(?:이|을)?\s*완료|인증(?:이|을)?\s*완료|approved|verified|endorsed)/i,
  /(?:agent-scan|AI-Infra-Guard|agentic-radar|public scanners?|scanner ecosystem)[^\n|]{0,120}(?:대체한다|replacement|parity|동등|equivalence|equivalent|호환|conformance)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:(?:red[-\s]?team|security|보안)\s+)?(?:platform|coverage|플랫폼|커버리지)/i,
  /(?:runtime|실시간)[^\n|]{0,120}(?:OAuth|authorization|session|consent|token)[^\n|]{0,120}(?:enforcement|강제|보장|지원)/i,
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

test('third-party agent scanner due diligence card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-third-party-agent-scanner-due-diligence.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(
    rootReadme,
    /\[AX third-party agent scanner due diligence card\]\(docs\/ax-third-party-agent-scanner-due-diligence\.md\)/,
  )
  assert.match(
    examplesDoc,
    /\[AX third-party agent scanner due diligence card\]\(ax-third-party-agent-scanner-due-diligence\.md\)/,
  )
})

test('third-party agent scanner due diligence card is Korean-first and maps source signals to action', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX third-party agent scanner due diligence card',
    '## 목적',
    '## Fresh public scanner signals checked this run',
    '## 30-second judge answer',
    '## Due-diligence decision route',
    '## Machine contracts',
    '## Non-claim guardrails',
    '## Operator handoff',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /\|\s*Public signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const term of [
    'third-party scanner',
    'agent/MCP server/skill scanning',
    'AI infra guardrail',
    'agentic workflow scanner',
    'source-of-record evidence',
    'rollout approval gate',
    'PASS',
    'REVIEW',
    'BLOCK',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('third-party agent scanner due diligence card cites public sources with borrow avoid action framing', () => {
  const doc = readDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(doc, publicReferenceUrl)
  }

  assert.match(doc, /Borrow/i)
  assert.match(doc, /Avoid/i)
  assert.match(doc, /AgentGuard action/i)
  assert.match(doc, /Snyk agent-scan/)
  assert.match(doc, /Tencent AI-Infra-Guard/)
  assert.match(doc, /splx-ai agentic-radar/)
  assert.match(doc, /GitHub SARIF upload docs/)
})

test('third-party agent scanner due diligence card uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const evidenceSurface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact', 'smoke manifest'] as const) {
    expectLiteral(doc, evidenceSurface)
  }
})

test('third-party agent scanner due diligence card preserves English-compatible machine contracts', () => {
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
    'rule IDs',
    'generic-secret-assignment',
    'denied-command',
    'mcp-filesystem-wide-root',
    'mcp-env-token',
    'JSON',
    'SARIF',
    'schemaVersion',
    'gitCommitSha',
    'sourceSha256',
    'artifactSha256',
    'ruleId',
    'locations',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:CLI|명령어|rule IDs?|룰 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('third-party agent scanner due diligence card rejects unsupported adoption certification parity runtime and platform claims', () => {
  const doc = readDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(doc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 사례입니다.',
    'AgentGuard는 SOC 2 공식 인증을 받은 제품입니다.',
    'AgentGuard는 OWASP에 의해 검증이 완료되었습니다.',
    'AgentGuard is certified for MCP conformance.',
    'AgentGuard는 Snyk agent-scan replacement parity 도구입니다.',
    'AgentGuard는 AI-Infra-Guard와 동등한 scanner입니다.',
    'AgentGuard has scanner ecosystem equivalence.',
    'AgentGuard offers complete AI red-team platform coverage.',
    'AgentGuard guarantees runtime OAuth authorization enforcement.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
