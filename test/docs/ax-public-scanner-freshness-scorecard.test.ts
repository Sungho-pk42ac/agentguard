import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const scorecardDocPath = join(repoRoot, 'docs', 'ax-public-scanner-freshness-scorecard.md')

const publicReferenceUrls = [
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
  'https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-freshness-scorecard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|official\s+public\s+approval|certified|certification|conformance/i,
  /(?:GitHub|Snyk|Tencent|splx-ai|agent-scan|AI-Infra-Guard|agentic-radar)[^\n|.]{0,90}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed)/i,
  /(?:agent-scan|AI-Infra-Guard|agentic-radar|public scanner|scanner)[^\n|.]{0,90}(?:대체|replacement|parity|동등|equivalence|equivalent)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:(?:red[-\s]?team|security|보안)\s+)?(?:platform|coverage|플랫폼|커버리지)/i,
  /(?:dashboard|auth|SaaS|deployment)[^\n|.]{0,90}(?:feature|기능|제공|추가|지원)/i,
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

function readScorecardDoc(): string {
  return readFileSync(scorecardDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public scanner freshness scorecard exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(scorecardDocPath), 'docs/ax-public-scanner-freshness-scorecard.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public scanner freshness scorecard\]\(docs\/ax-public-scanner-freshness-scorecard\.md\)/)
  assert.match(examplesDoc, /\[AX public scanner freshness scorecard\]\(ax-public-scanner-freshness-scorecard\.md\)/)
})

test('AX public scanner freshness scorecard is Korean-first and has required sections', () => {
  const scorecardDoc = readScorecardDoc()

  for (const heading of [
    '# AX public scanner freshness scorecard',
    '## 목적',
    '## Public scanner freshness scorecard',
    '## AgentGuard evidence actions',
    '## SARIF/reviewer handoff',
    '## Machine contracts',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(scorecardDoc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(scorecardDoc, /한국어 우선/)
  assert.match(scorecardDoc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(scorecardDoc, /대상권|AX judging|judge-facing/i)
})

test('AX public scanner freshness scorecard cites required public scanner URLs', () => {
  const scorecardDoc = readScorecardDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(scorecardDoc, publicReferenceUrl)
  }
})

test('AX public scanner freshness scorecard uses exact fixture-backed commands with existing inputs', () => {
  const scorecardDoc = readScorecardDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(scorecardDoc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(scorecardDoc, fixturePath)
    }
  }

  for (const evidenceSurface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact'] as const) {
    expectLiteral(scorecardDoc, evidenceSurface)
  }
})

test('AX public scanner freshness scorecard preserves machine contracts', () => {
  const scorecardDoc = readScorecardDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    '--policy',
    '--sarif',
    '--out',
    'rule IDs',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'JSON',
    'SARIF',
    'version',
    '$schema',
    'runs',
    'tool.driver.name',
    'results',
    'ruleId',
    'locations',
    'physicalLocation',
    'artifactLocation.uri',
    'region.startLine',
  ] as const) {
    expectLiteral(scorecardDoc, contract)
  }

  assert.doesNotMatch(scorecardDoc, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX public scanner freshness scorecard rejects unsupported adoption certification parity and platform claims', () => {
  const scorecardDoc = readScorecardDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(scorecardDoc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 SOC 2 공식 인증을 받은 제품입니다.',
    'AgentGuard has official public approval from GitHub.',
    'AgentGuard는 Snyk agent-scan 대체 parity 도구입니다.',
    'AgentGuard provides scanner equivalence with agentic-radar.',
    'AgentGuard offers complete security platform coverage.',
    'AgentGuard adds dashboard feature support for this slice.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
