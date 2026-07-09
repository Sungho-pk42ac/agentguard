import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-first-60-seconds-evidence-priority.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'mkdir -p .agentguard-demo && node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const referencedPaths = [
  'docs/ax-90-second-judge-evidence-tour.md',
  'docs/ax-mcp-consent-token-handoff.md',
  'docs/ax-sarif-reviewer-loop-card.md',
  'docs/ax-prompt-injection-evidence-routing-card.md',
  'examples/risky-mcp.json',
  'examples/risky-pr.diff',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
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

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX first-60-seconds evidence priority card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-first-60-seconds-evidence-priority.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

  assert.match(
    rootReadme,
    /\[AX first-60-seconds evidence priority card\]\(docs\/ax-first-60-seconds-evidence-priority\.md\)/,
  )
})

test('AX first-60-seconds evidence priority card is Korean-first with required sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 첫 60초 우선순위',
    '## Evidence priority table',
    '## Existing evidence paths',
    '## Public reference borrow/avoid/action table',
    '## Boundary notes',
  ] as const

  assert.match(card, /^# AX first-60-seconds evidence priority card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const requiredTerm of [
    'AX 인재전쟁',
    '첫 60초',
    '회사 문제',
    '현업성',
    '결과물성',
    '재현성',
    'honest boundaries',
    'parent directory',
    '재생성 가능한 local evidence directory',
    'PASS',
    'REVIEW',
    'BLOCK',
  ] as const) {
    expectLiteral(card, requiredTerm)
  }
})

test('AX first-60-seconds evidence priority card uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }
})

test('AX first-60-seconds evidence priority card references only existing local docs and fixture paths', () => {
  const card = readCard()

  for (const referencedPath of referencedPaths) {
    assert.ok(existsSync(join(repoRoot, referencedPath)), `${referencedPath} should exist`)
    expectLiteral(card, referencedPath)
  }
})

test('AX first-60-seconds evidence priority card cites public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP Agentic AI threats and mitigations/)
  assert.match(card, /MCP security best practices/)
  assert.match(card, /GitHub SARIF code scanning/)
})

test('AX first-60-seconds evidence priority card preserves contracts and avoids unsupported claims', () => {
  const card = readCard()

  for (const machineContract of [
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'agentguard scan-log',
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'secret.github_token',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(card, machineContract)
  }

  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF|API)[^\r\n]*(?:한국어로|한글로|번역|변경|rename)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|SARIF)[^\r\n|.]{0,100}(?:endorsed|validated|approved|공식\s*검증|검증\s*완료|인증\s*완료|replacement|parity|동등|대체)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체|final-round|hidden rubric)[^\r\n|.]{0,100}(?:coverage|claim|커버리지|심사표|루브릭)/i)
  assert.doesNotMatch(card, /AgentGuard\s+(?:enforces|implements|provides|delivers)\s+MCP[^.\n|]{0,100}(?:runtime|authorization|OAuth|consent UI|session control)/i)
})

test('AX first-60-seconds evidence priority card keeps PR-diff fixture scoped to synthetic demo content', () => {
  const fixture = readFileSync(join(repoRoot, 'examples/risky-pr.diff'), 'utf8')

  assert.doesNotMatch(fixture, /gh[pousr]_[A-Za-z0-9]{36}\b/)
  assert.doesNotMatch(fixture, /github_pat_[A-Za-z0-9_]{60,}\b/)
  assert.match(fixture, /\.env\.example/)
  assert.match(fixture, /DEPLOY_COMMAND=rm -rf \/tmp\/agentguard-demo/)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
