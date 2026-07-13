import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const runbookDocPath = join(repoRoot, 'docs', 'ax-emergency-stop-runbook.md')

const publicReferenceUrls = [
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions',
  'https://docs.snyk.io/scan-with-snyk/snyk-code/manage-code-vulnerabilities/fix-code-vulnerabilities',
  'https://github.blog/security/application-security/how-to-use-github-code-scanning-with-your-open-source-software-development/',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/emergency-stop/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance/i,
  /(?:OWASP|MCP|GitHub|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar|agentshield)[^\n|]{0,120}(?:검증(?:이|을)?\s*완료|인증(?:이|을)?\s*완료|official\s+public\s+approval|approved|verified|endorsed)|official\s+public\s+approval[^\n|]{0,120}(?:OWASP|MCP|GitHub|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar|agentshield)/i,
  /(?:Snyk|GitHub code scanning|OWASP|MCP|public tools?)[^\n|]{0,120}(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)|(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)[^\n|]{0,120}(?:Snyk|GitHub code scanning|OWASP|MCP|public tools?)/i,
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

function readRunbookDoc(): string {
  return readFileSync(runbookDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX emergency stop runbook exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(runbookDocPath), 'docs/ax-emergency-stop-runbook.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX emergency stop runbook\]\(docs\/ax-emergency-stop-runbook\.md\)/)
  assert.match(examplesDoc, /\[AX emergency stop runbook\]\(ax-emergency-stop-runbook\.md\)/)
})

test('AX emergency stop runbook is Korean-first and maps stop recovery rerun decisions', () => {
  const runbookDoc = readRunbookDoc()

  for (const heading of [
    '# AX emergency stop runbook',
    '## 목적',
    '## Emergency stop decision table',
    '## Recovery/rerun loop',
    '## Exact evidence commands',
    '## Public references: Borrow / Avoid / AgentGuard action',
    '## Machine contracts',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(runbookDoc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(runbookDoc, /한국어|기업 운영자|비상 정지/)
  assert.match(
    runbookDoc,
    /\|\s*Surface\s*\|\s*Stop owner\s*\|\s*Stop condition\s*\|\s*Recovery action\s*\|\s*Rerun command \/ artifact\s*\|\s*Resume condition\s*\|/,
  )

  for (const surface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact', 'smoke manifest'] as const) {
    expectLiteral(runbookDoc, surface)
  }

  for (const term of [
    '배포 중지',
    '권한 회수',
    'same evidence',
    'approval gate',
    'source-of-record',
    'fix/policy',
    'rerun',
    'resume',
  ] as const) {
    expectLiteral(runbookDoc, term)
  }
})

test('AX emergency stop runbook cites public references with Borrow Avoid AgentGuard action rows', () => {
  const runbookDoc = readRunbookDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(runbookDoc, publicReferenceUrl)
  }

  assert.match(
    runbookDoc,
    /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/,
  )

  for (const term of ['MCP Security Best Practices', 'GitHub Actions security hardening', 'Snyk fix vulnerabilities workflow', 'GitHub code scanning / SARIF UX'] as const) {
    expectLiteral(runbookDoc, term)
  }
})

test('AX emergency stop runbook uses exact fixture-backed commands with existing inputs', () => {
  const runbookDoc = readRunbookDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(runbookDoc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(runbookDoc, fixturePath)
    }
  }
})

test('AX emergency stop runbook preserves English-compatible machine contracts', () => {
  const runbookDoc = readRunbookDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'npm run smoke:ax-demo',
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
    'schemaVersion',
    'gitCommitSha',
    'sourceSha256',
    'artifactSha256',
    'ruleId',
    'locations',
  ] as const) {
    expectLiteral(runbookDoc, contract)
  }

  assert.doesNotMatch(runbookDoc, /(?:CLI|명령어|rule IDs?|룰 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX emergency stop runbook rejects unsupported adoption certification parity runtime and platform claims', () => {
  const runbookDoc = readRunbookDoc()
  const guardrailSection = runbookDoc.split('## Non-claim guardrails')[0]

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(guardrailSection, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 SOC 2 공식 인증을 받은 제품입니다.',
    'AgentGuard는 OWASP 공식 인증을 받은 제품입니다.',
    'AgentGuard has official public approval from GitHub.',
    'AgentGuard는 Snyk 대체 parity 도구입니다.',
    'AgentGuard is compatible with GitHub code scanning.',
    'AgentGuard offers complete AI security platform coverage.',
    'AgentGuard guarantees runtime OAuth authorization enforcement.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
