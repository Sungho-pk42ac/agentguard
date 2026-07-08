import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-cli-trust-onboarding-card.md')

const requiredHeadings = [
  '# AX CLI trust onboarding card',
  '## 사용 목적',
  '## First-run trust path',
  '## Evidence intent and owner table',
  '## Fixture-backed commands',
  '## SARIF reviewer handoff',
  '## Public reference grounding',
  '## Non-claim guardrails',
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
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-trust-onboarding.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://github.com/snyk/agent-scan',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

const requiredCliContracts = [
  'agentguard --help',
  'agentguard doctor',
  'agentguard scan-diff',
  'agentguard scan-mcp',
  'agentguard scan-log',
  'scan-diff --sarif --out',
  'CLI commands',
  'rule IDs',
  'JSON',
  'SARIF',
  'machine contracts',
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

test('AX CLI trust onboarding card exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-cli-trust-onboarding-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX CLI trust onboarding card\]\(docs\/ax-cli-trust-onboarding-card\.md\)/)
  assert.match(examplesDoc, /\[AX CLI trust onboarding card\]\(ax-cli-trust-onboarding-card\.md\)/)
})

test('AX CLI trust onboarding card is Korean-first and preserves English-compatible machine contracts', () => {
  const card = readCard()

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)
  assert.match(card, /first-run/i)
  assert.match(card, /trust onboarding/i)

  for (const contract of requiredCliContracts) {
    expectLiteral(card, contract)
  }

  for (const shellNote of [
    'POSIX shell',
    'Bash',
    'Zsh',
    'PowerShell',
    'Get-Content -Raw -Encoding utf8',
    '.agentguard-demo/',
  ]) {
    expectLiteral(card, shellNote)
  }
})

test('AX CLI trust onboarding card maps each onboarding command to intent verdict owner and non-claim', () => {
  const card = readCard()

  assert.match(card, /\|\s*Step\s*\|\s*Exact command\s*\|\s*Evidence intent\s*\|\s*Expected verdict\s*\|\s*Owner\s*\|\s*Do not claim\s*\|/)

  for (const command of ['agentguard --help', 'agentguard doctor', 'agentguard scan-diff', 'agentguard scan-mcp', 'agentguard scan-log'] as const) {
    assert.match(card, new RegExp(`${escapeRegExp(command)}[\\s\\S]{0,500}(?:Evidence|evidence|증거)`))
    assert.match(card, new RegExp(`${escapeRegExp(command)}[\\s\\S]{0,500}(?:Owner|owner|담당)`))
    assert.match(card, new RegExp(`${escapeRegExp(command)}[\\s\\S]{0,500}(?:Do not claim|claim|주장)`))
  }

  for (const expectedVerdict of ['help text visible', 'readiness review', 'BLOCK', 'REVIEW', 'SARIF artifact created'] as const) {
    expectLiteral(card, expectedVerdict)
  }
})

test('AX CLI trust onboarding card uses exact fixture-backed commands with existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }
})

test('AX CLI trust onboarding card cites public references with borrow and avoid guidance', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard onboarding action\s*\|/)
  assert.match(card, /least privilege|user consent|token handling|confused deputy/i)
  assert.match(card, /agent component|inventory|security scan/i)
  assert.match(card, /SARIF upload|artifact routing|reviewer handoff/i)
})

test('AX CLI trust onboarding card bans unsupported adoption certification parity and contract-renaming claims', () => {
  const card = readCard()

  for (const requiredNonClaim of [
    'No adoption claim',
    'No certification claim',
    'No MCP conformance claim',
    'No platform parity claim',
    'No automatic GitHub upload claim',
  ] as const) {
    expectLiteral(card, requiredNonClaim)
  }

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,100}(?:certified|approved|endorsed|인증\s*완료|공식\s*인증|검증\s*완료)/i)
  assert.doesNotMatch(card, /(?:Snyk|agent-scan|GitHub code scanning)[^\n|.]{0,100}(?:replacement|parity|대체|동등)/i)
  assert.doesNotMatch(card, /AgentGuard[^\n|.]{0,120}(?:full|complete|전체)\s+(?:agentic\s+)?security\s+(?:platform|coverage|scanner)/i)
  assert.doesNotMatch(
    card,
    /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i,
  )
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
