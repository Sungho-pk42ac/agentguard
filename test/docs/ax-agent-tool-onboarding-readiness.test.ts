import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-agent-tool-onboarding-readiness.md')

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://docs.snyk.io/developer-tools/snyk-cli/scan-and-maintain-projects-using-the-cli',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js doctor --json',
    fixtures: [] as string[],
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-tool-onboarding/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance/i,
  /(?:OWASP|MCP|GitHub|Snyk|CodeQL)[^\n|]{0,120}(?:검증(?:이|을)?\s*완료|인증(?:이|을)?\s*완료|official\s+(?:approval|endorsement)|approved|verified|endorsed)|(?:official\s+(?:approval|endorsement)|approved|verified|endorsed)[^\n|]{0,120}(?:OWASP|MCP|GitHub|Snyk|CodeQL)/i,
  /(?:Snyk|GitHub code scanning|CodeQL|OWASP|MCP|public scanners?)[^\n|]{0,120}(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)|(?:대체|replacement|parity|동등|equivalence|equivalent|호환|compatible)[^\n|]{0,120}(?:Snyk|GitHub code scanning|CodeQL|OWASP|MCP|public scanners?)/i,
  /(?:runtime|실시간)[^\n|]{0,120}(?:OAuth|authorization|session|consent|tool interception|guardrail|enforcement)[^\n|]{0,120}(?:강제|보장|지원|구현|차단|enforcement|implemented|guaranteed)/i,
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

test('AX agent tool onboarding readiness card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-agent-tool-onboarding-readiness.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX agent tool onboarding readiness\]\(docs\/ax-agent-tool-onboarding-readiness\.md\)/)
  assert.match(examplesDoc, /\[AX agent tool onboarding readiness\]\(ax-agent-tool-onboarding-readiness\.md\)/)
})

test('AX agent tool onboarding readiness card is Korean-first and maps onboarding to approval evidence', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX agent tool onboarding readiness',
    '## 목적',
    '## Onboarding readiness route',
    '## Exact fixture-backed commands',
    '## Public references: Borrow / Avoid / AgentGuard action',
    '## Machine contracts',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['한국어', '새 agent/tool', 'onboarding readiness', 'approval decision', 'source-of-record', 'rerun trigger'] as const) {
    expectLiteral(doc, term)
  }

  assert.match(
    doc,
    /\|\s*Onboarding checkpoint\s*\|\s*AgentGuard evidence\s*\|\s*Approval decision\s*\|\s*Rerun trigger\s*\|/,
  )
})

test('AX agent tool onboarding readiness card cites public references with Borrow Avoid AgentGuard action rows', () => {
  const doc = readDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(doc, publicReferenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const term of ['OWASP Agentic AI threats', 'MCP Security Best Practices', 'GitHub SARIF upload docs', 'Snyk CLI scan and maintain docs'] as const) {
    expectLiteral(doc, term)
  }
})

test('AX agent tool onboarding readiness card uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX agent tool onboarding readiness card preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard doctor',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'agentguard scan-diff',
    '--json',
    '--policy',
    '--sarif',
    '--out',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON',
    'SARIF',
    'ruleId',
    'locations',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
    'denied-command',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:CLI|명령어|rule IDs?|룰 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX agent tool onboarding readiness card rejects unsupported adoption certification parity runtime and platform claims', () => {
  const doc = readDoc()
  const claimSurface = doc
    .split('## Non-claim guardrails')[0]
    .split('\n')
    .filter((line) => !/(Avoid|말하지 않는다|claim|coverage|external assurance|certification|conformance|parity|replacement|runtime|구현했다고)/i.test(line))
    .join('\n')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(claimSurface, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 SOC 2 공식 인증을 받은 제품입니다.',
    'AgentGuard has official endorsement from GitHub.',
    'AgentGuard는 Snyk 대체 parity 도구입니다.',
    'AgentGuard guarantees runtime OAuth session enforcement.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
