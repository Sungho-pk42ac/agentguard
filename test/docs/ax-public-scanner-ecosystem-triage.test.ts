import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const triageDocPath = join(repoRoot, 'docs', 'ax-public-scanner-ecosystem-triage.md')

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/snyk/agent-scan',
  'https://github.com/splx-ai/agentic-radar',
  'https://github.com/affaan-m/agentshield',
  'https://github.com/cisco-ai-defense/mcp-scanner',
  'https://vercel.com/docs/cli',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-ecosystem-triage.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption|fake adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|official\s+public\s+approval|certified|certification|conformance/i,
  /(?:OWASP|GitHub|Snyk|splx-ai|Agentshield|Cisco|Vercel|MCP)[^\n|.]{0,90}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed|replacement|equivalence|equivalent)/i,
  /(?:agent-scan|agentic-radar|agentshield|mcp-scanner|vendor(?:[-\s]?(?:scale|equivalence|equivalent))?)[^\n|.]{0,90}(?:대체|replacement|parity|동등|equivalence|equivalent)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:(?:red[-\s]?team|security|보안)\s+)?(?:platform|coverage|플랫폼|커버리지)/i,
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

function readTriageDoc(): string {
  return readFileSync(triageDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public scanner ecosystem triage doc exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(triageDocPath), 'docs/ax-public-scanner-ecosystem-triage.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public scanner ecosystem triage\]\(docs\/ax-public-scanner-ecosystem-triage\.md\)/)
  assert.match(examplesDoc, /\[AX public scanner ecosystem triage\]\(ax-public-scanner-ecosystem-triage\.md\)/)
})

test('AX public scanner ecosystem triage is Korean-first and maps ecosystem signals to actions', () => {
  const triageDoc = readTriageDoc()

  for (const heading of [
    '# AX public scanner ecosystem triage',
    '## 사용 목적',
    '## Public scanner ecosystem signal table',
    '## Fixture-backed evidence commands',
    '## Machine-contract guardrails',
    '## Claim guardrails',
  ] as const) {
    assert.match(triageDoc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(triageDoc, /한국어 우선/)
  assert.match(triageDoc, /\|\s*Public ecosystem signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(triageDoc, /CLI onboarding\/status polish benchmark/)
  assert.match(triageDoc, /security benchmark가 아니다/i)
})

test('AX public scanner ecosystem triage cites the required public URLs', () => {
  const triageDoc = readTriageDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(triageDoc, publicReferenceUrl)
  }
})

test('AX public scanner ecosystem triage uses exact fixture-backed commands with existing inputs', () => {
  const triageDoc = readTriageDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(triageDoc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(triageDoc, fixturePath)
    }
  }

  assert.match(triageDoc, /PR diff/)
  assert.match(triageDoc, /MCP config/)
  assert.match(triageDoc, /transcript\/log/)
  assert.match(triageDoc, /SARIF artifact/)
})

test('AX public scanner ecosystem triage preserves machine contracts', () => {
  const triageDoc = readTriageDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
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
    expectLiteral(triageDoc, contract)
  }

  assert.doesNotMatch(triageDoc, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX public scanner ecosystem triage rejects unsupported adoption, certification, and parity claims', () => {
  const triageDoc = readTriageDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(triageDoc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 실고객 운영 실적을 보유했습니다.',
    'AgentGuard는 SOC 2 공식 인증을 받은 제품입니다.',
    'AgentGuard has official public approval.',
    'AgentGuard는 Snyk agent-scan 대체 parity 도구입니다.',
    'AgentGuard provides vendor equivalence with public scanners.',
    'AgentGuard는 Cisco mcp-scanner와 동등한 MCP 인증 완료 도구입니다.',
    'AgentGuard offers complete platform coverage.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
