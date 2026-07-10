import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistDocPath = join(repoRoot, 'docs', 'ax-public-scanner-gap-checklist.md')

const publicReferenceUrls = [
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file',
  'https://github.com/snyk/agent-scan',
  'https://github.com/splx-ai/agentic-radar',
  'https://github.com/affaan-m/agentshield',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-gap-checklist.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|official\s+public\s+approval|certified|certification|conformance/i,
  /(?:OWASP|MCP|GitHub|Snyk|splx-ai|AgentShield|agentshield)[^\n|.]{0,90}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed|replacement|대체)/i,
  /(?:agent-scan|agentic-radar|agentshield|public scanner|scanner)[^\n|.]{0,90}(?:parity|동등|equivalence|equivalent)/i,
  /(?:runtime|실시간)[^\n|.]{0,90}(?:MCP\s*)?(?:enforcement|차단|강제)/i,
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

function readChecklistDoc(): string {
  return readFileSync(checklistDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public scanner gap checklist exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(checklistDocPath), 'docs/ax-public-scanner-gap-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public scanner gap checklist\]\(docs\/ax-public-scanner-gap-checklist\.md\)/)
  assert.match(examplesDoc, /\[AX public scanner gap checklist\]\(ax-public-scanner-gap-checklist\.md\)/)
})

test('AX public scanner gap checklist is Korean-first and maps borrowed references to action', () => {
  const checklistDoc = readChecklistDoc()

  for (const heading of [
    '# AX public scanner gap checklist',
    '## 대상권 포지셔닝',
    '## Borrow / Avoid / AgentGuard action',
    '## Gap-to-demo checklist',
    '## Fixture-backed evidence commands',
    '## Honest gaps',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(checklistDoc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(checklistDoc, /한국어 우선/)
  assert.match(checklistDoc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(checklistDoc, /대상권/)
  assert.match(checklistDoc, /judge-visible|심사위원/i)
})

test('AX public scanner gap checklist cites required public URLs', () => {
  const checklistDoc = readChecklistDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(checklistDoc, publicReferenceUrl)
  }
})

test('AX public scanner gap checklist uses exact fixture-backed commands with existing inputs', () => {
  const checklistDoc = readChecklistDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(checklistDoc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(checklistDoc, fixturePath)
    }
  }

  for (const surface of ['PR diff', 'MCP', 'transcript/log', 'SARIF'] as const) {
    expectLiteral(checklistDoc, surface)
  }
})

test('AX public scanner gap checklist preserves English-compatible contracts', () => {
  const checklistDoc = readChecklistDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'tool.driver.name',
    'ruleId',
    'artifactLocation.uri',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
    'secret.github_token',
  ] as const) {
    expectLiteral(checklistDoc, contract)
  }

  assert.doesNotMatch(checklistDoc, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX public scanner gap checklist rejects unsupported adoption certification parity and runtime claims', () => {
  const checklistDoc = readChecklistDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(checklistDoc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 OWASP 공식 인증을 받은 제품입니다.',
    'AgentGuard has official public approval from GitHub.',
    'AgentGuard는 Snyk agent-scan 대체 parity 도구입니다.',
    'AgentGuard provides scanner equivalence with agentic-radar.',
    'AgentGuard는 runtime MCP enforcement를 제공합니다.',
    'AgentGuard offers complete security platform coverage.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
