import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-false-positive-dispute-card.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/approval-required-review.jsonl',
    fixtures: ['examples/agent-policy.yaml', 'examples/approval-required-review.jsonl'],
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    const hasPackage = existsSync(join(currentDir, 'package.json'))
    const hasDocs = existsSync(join(currentDir, 'docs'))
    const hasTests = existsSync(join(currentDir, 'test'))
    if (hasPackage && hasDocs && hasTests) return currentDir

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find repo root in the directory tree')
    currentDir = parentDir
  }
}

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX false-positive dispute card exists and is linked from the root README', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-false-positive-dispute-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX false-positive dispute review card\]\(docs\/ax-false-positive-dispute-card\.md\)/)
})

test('AX false-positive dispute card contains the required Korean-first sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 사용 목적',
    '## Dispute review path',
    '## Source-of-record evidence',
    '## Fixture-backed rerun commands',
    '## Approver decision record',
    '## Policy exception boundaries',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract and fake-claim guardrails',
  ] as const

  assert.match(card, /^# AX false-positive dispute review card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX false-positive dispute card uses exact existing fixture-backed commands and artifacts', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  for (const artifact of ['Markdown report', 'JSON', 'SARIF', 'agentguard.sarif', 'examples/agentguard.sarif'] as const) {
    expectLiteral(card, artifact)
  }
  assert.ok(existsSync(join(repoRoot, 'examples/agentguard.sarif')), 'examples/agentguard.sarif should exist')
})

test('AX false-positive dispute card preserves English-compatible verdict and scanner contracts', () => {
  const card = readCard()

  for (const contract of [
    'PASS',
    'REVIEW',
    'BLOCK',
    'scan-diff',
    'scan-mcp',
    'scan-log',
    'JSON',
    'SARIF',
    'rule IDs',
    'verdict',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.match(card, /`PASS`[\s\S]{0,900}(?:finding|위험|차단)[\s\S]{0,900}(?:없|없는|없음)/i)
  assert.match(card, /`REVIEW`[\s\S]{0,900}(?:approver|승인자|검토자|사람)/i)
  assert.match(card, /`BLOCK`[\s\S]{0,900}(?:rollout|배포|출시)[\s\S]{0,900}(?:중단|차단|멈)/i)
  assert.doesNotMatch(card, /(?:CLI|command|rule IDs?|JSON|SARIF|API|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX false-positive dispute card maps contested findings to reviewer decisions and policy boundaries', () => {
  const card = readCard()

  for (const term of [
    'false-positive',
    'contested finding',
    '오탐',
    'dispute',
    'rerunnable evidence',
    'source-of-record',
    'approver decision',
    'policy exception',
    'policy version',
    'git SHA',
    'mitigation justification',
    'least privilege',
    'runtime authorization',
    'static MCP config evidence',
    'approval-required',
  ] as const) {
    expectLiteral(card, term)
  }

  assert.match(card, /source-of-record[\s\S]{0,900}rerunnable command|rerunnable command[\s\S]{0,900}source-of-record/i)
  assert.match(card, /policy exception[\s\S]{0,900}(?:owner|expiry|만료|승인자|approver)/i)
  assert.match(card, /static MCP config evidence[\s\S]{0,900}(?:runtime authorization|consent|session)/i)
})

test('AX false-positive dispute card cites public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /빌릴 점|Borrow/i)
  assert.match(card, /피할 점|Avoid/i)
  assert.match(card, /AgentGuard action|적용|조치/i)
})

test('AX false-positive dispute card bans unsupported certification adoption and runtime-control claims', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:runtime authorization|consent UI|OAuth|session)[^\n|.]{0,80}(?:enforced|구현|제공|controls?)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(card, /(?:scanner|policy engine|CLI behavior|rule IDs?)[^\n|.]{0,80}(?:changed|변경|rename|renamed)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
