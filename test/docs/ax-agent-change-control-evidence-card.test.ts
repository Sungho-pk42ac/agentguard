import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-agent-change-control-evidence-card.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixturePaths: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixturePaths: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixturePaths: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-change-control/agentguard.sarif < examples/risky-pr.diff',
    fixturePaths: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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

test('AX agent change-control evidence card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-agent-change-control-evidence-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX agent change-control evidence card\]\(docs\/ax-agent-change-control-evidence-card\.md\)/)
  assert.match(examplesDoc, /\[AX agent change-control evidence card\]\(ax-agent-change-control-evidence-card\.md\)/)
})

test('AX agent change-control evidence card maps request to evidence approval and rerun flow', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 목적',
    '## 변경관리 증거 카드',
    '## Fixture-backed evidence commands',
    '## 승인/보류/차단 decision table',
    '## Rollback and rerun',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const

  assert.match(card, /^# AX agent change-control evidence card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['change request', 'AgentGuard evidence', 'approver decision', 'rollback/rerun', '승인', '보류', '차단'] as const) {
    expectLiteral(card, term)
  }

  assert.match(card, /change request[\s\S]{0,900}AgentGuard evidence[\s\S]{0,900}approver decision[\s\S]{0,900}rollback\/rerun/i)
  assert.match(card, /PR diff[\s\S]{0,900}MCP config[\s\S]{0,900}transcript\/log/i)
})

test('AX agent change-control evidence card uses exact existing fixture-backed commands', () => {
  const card = readCard()

  for (const { command, fixturePaths } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixturePaths) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  assert.ok(existsSync(join(repoRoot, 'examples/agentguard.sarif')), 'examples/agentguard.sarif should exist')
  expectLiteral(card, 'examples/agentguard.sarif')
  assert.match(card, /Expected verdict: `BLOCK`|Expected verdict: `REVIEW`/)
  assert.match(card, /Markdown/)
  assert.match(card, /SARIF/)
})

test('AX agent change-control evidence card cites public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /빌릴 점|Borrow/i)
  assert.match(card, /피할 점|Avoid/i)
  assert.match(card, /AgentGuard action|조치/i)
})

test('AX agent change-control evidence card preserves machine contracts and bans fake claims', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'secret.openai_api_key',
    'mcp.broad_filesystem_access',
    'agent.policy.denied_command',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:runtime|OAuth|MCP)[^\n|.]{0,80}(?:enforce|enforces|강제|통제)/i)
  assert.doesNotMatch(card, /(?:GitHub\s+advanced\s+security|GitHub\s+code\s+scanning)[^\n|.]{0,80}(?:대체|replacement)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
