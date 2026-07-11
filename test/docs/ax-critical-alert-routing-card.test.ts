import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-critical-alert-routing-card.md')

const fixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/critical-alerts/agentguard.sarif < examples/risky-pr.diff',
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file',
  'https://github.com/snyk/agent-scan',
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

test('AX critical alert routing card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-critical-alert-routing-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')

  assert.match(rootReadme, /\[AX critical alert routing card\]\(docs\/ax-critical-alert-routing-card\.md\)/)
  assert.match(
    examplesReadme,
    /\[AX critical alert routing card\]\(\.\.\/docs\/ax-critical-alert-routing-card\.md\)/,
  )
})

test('AX critical alert routing card is Korean-first and names alert approval sections', () => {
  const card = readCard()

  for (const heading of [
    '# AX critical alert routing card',
    '## 사용 목적',
    '## Critical alert routing queue',
    '## Evidence command contract',
    '## Approval owner stop conditions',
    '## Public reference borrow/avoid/action table',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)
  for (const requiredTerm of [
    'alert owner',
    'approval owner',
    'rollout stop condition',
    'permission owner',
    'reviewer channel',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(card, requiredTerm)
  }
})

test('AX critical alert routing card uses exact existing fixture-backed commands', () => {
  const card = readCard()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(card, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(card, command)
  }

  assert.match(card, /`BLOCK`[\s\S]{0,900}(?:멈|중지|stop|block)/i)
  assert.match(card, /`REVIEW`[\s\S]{0,900}(?:승인|approval|owner|queue)/i)
  assert.match(card, /`PASS`[\s\S]{0,900}(?:진행|proceed|next gate)/i)
})

test('AX critical alert routing card cites public references with borrow avoid action rows', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP Agentic AI Threats and Mitigations/)
  assert.match(card, /MCP Security Best Practices/)
  assert.match(card, /GitHub SARIF upload/)
  assert.match(card, /Snyk `agent-scan`/)
})

test('AX critical alert routing card preserves English-compatible machine contracts', () => {
  const card = readCard()

  for (const contract of [
    'scan-diff',
    'scan-mcp',
    'scan-log',
    'JSON',
    'SARIF',
    'rule IDs',
    'secret.github_token',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI|명령어|rule IDs?|룰 ID|JSON|SARIF|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|rename)/i)
})

test('AX critical alert routing card bans fake adoption certification hosted alert and parity claims', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:hosted alert|Slack|Teams|webhook)[^\n]*(?:guaranteed|implemented|available|지원|제공|운영)/i)
  assert.doesNotMatch(card, /(?:GitHub|SARIF|Snyk|OWASP|MCP)[^\n|.]{0,100}(?:approved|verified|replacement|parity|동등|대체)/i)
  assert.doesNotMatch(card, /(?:runtime OAuth|consent UI|token authorization|runtime monitoring)[^\n]*(?:implemented|available|지원|제공|운영)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
