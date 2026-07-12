import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-evidence-redaction-boundary.md')

const requiredUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-evidence-redaction-boundary/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?\s*(?:도입|사용|레퍼런스)|real customer adoption|customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|official\s+endorsement|certified|certification|conformance/i,
  /(?:OWASP|MCP|GitHub|Snyk|code scanning)[^\n|.]{0,90}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed|replacement|대체|parity|동등)/i,
  /(?:runtime|실시간)[^\n|.]{0,90}(?:authorization|OAuth|session|redirect|enforcement|차단|강제)/i,
  /(?:automatic|자동)[^\n|.]{0,90}(?:SARIF\s*)?(?:upload|approval|triage|remediation|업로드|승인|조치|수정)/i,
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public evidence redaction boundary exists and is linked from entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-evidence-redaction-boundary.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')

  assert.match(rootReadme, /\[AX public evidence redaction boundary\]\(docs\/ax-public-evidence-redaction-boundary\.md\)/)
  assert.match(
    examplesReadme,
    /\[AX public evidence redaction boundary\]\(\.\.\/docs\/ax-public-evidence-redaction-boundary\.md\)/,
  )
})

test('AX public evidence redaction boundary has required Korean-first sections', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX public evidence redaction boundary',
    '## 대상권 포지셔닝',
    '## Evidence redaction / release table',
    '## Borrow / Avoid / AgentGuard action',
    '## Fixture-backed evidence commands',
    '## Public handoff checklist',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(doc, /한국어|심사위원|승인자/)
  assert.match(doc, /redaction|redacted/i)
  assert.match(doc, /source-of-record/)
})

test('AX public evidence redaction boundary cites required public references', () => {
  const doc = readDoc()

  for (const url of requiredUrls) {
    expectLiteral(doc, url)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
})

test('AX public evidence redaction boundary uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const surface of ['PR diff', 'MCP config', 'Transcript/log', 'SARIF handoff'] as const) {
    expectLiteral(doc, surface)
  }
})

test('AX public evidence redaction boundary preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON',
    'SARIF',
    'ruleId',
    'artifactLocation.uri',
    'tool.driver.name',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX public evidence redaction boundary rejects unsupported adoption certification runtime and upload claims', () => {
  const doc = readDoc()
  const claimSectionStart = doc.indexOf('## 대상권 포지셔닝')
  const guardrailSectionStart = doc.indexOf('## Non-claim guardrails')
  const claimSurface = doc.slice(claimSectionStart, guardrailSectionStart)

  const checkedClaimSurface = claimSurface
    .split('\n')
    .filter(
      (line) =>
        !line.includes('| Public reference |') &&
        !line.includes('| OWASP') &&
        !line.includes('| Model Context Protocol') &&
        !line.includes('| GitHub SARIF') &&
        !line.includes('주장하지 않습니다') &&
        !line.includes('의미하지 않습니다') &&
        !line.includes('does not say'),
    )
    .join('\n')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(checkedClaimSurface, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 OWASP 공식 인증을 받은 제품입니다.',
    'AgentGuard has official endorsement from GitHub.',
    'AgentGuard provides Snyk parity for agent scanning.',
    'AgentGuard provides runtime OAuth enforcement.',
    'AgentGuard performs automatic SARIF upload and approval.',
    'AgentGuard is a complete security platform coverage layer.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
