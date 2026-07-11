import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-threat-control-traceability.md')

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/authorization',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-threat-control-traceability.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?\s*(?:도입|사례|사용|확보)|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|has\s+real\s+customer\s+adoption|provides\s+customer\s+adoption/i,
  /(?:공식\s*인증을\s*받은|(?:SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance)\s*(?:받은|획득한|보유한)|has\s+(?:SOC\s*2|ISO\s*27001|certification|conformance)|is\s+certified)/i,
  /(?:OWASP|MCP|GitHub)[^\n|.]{0,90}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed|replacement|대체)|(?:has|claims)\s+(?:verified|approved|endorsed)\s+(?:OWASP|MCP|GitHub)/i,
  /(?:provides|offers|implements|제공|구현)[^\n|.]{0,90}(?:runtime|실시간)[^\n|.]{0,90}(?:MCP\s*)?(?:enforcement|차단|강제|OAuth\s*enforcement)|(?:runtime|실시간)[^\n|.]{0,90}(?:MCP\s*)?(?:enforcement|차단|강제|OAuth\s*enforcement)[^\n|.]{0,90}(?:제공|구현)/i,
  /(?:offers|provides|is|제공|구현)[^\n|.]{0,90}(?:full|complete|전체)\s+(?:AI\s+)?(?:(?:red[-\s]?team|security|보안)\s+)?(?:platform|coverage|플랫폼|커버리지)/i,
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

test('AX threat-control traceability card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-threat-control-traceability.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX threat-control traceability card\]\(docs\/ax-threat-control-traceability\.md\)/)
  assert.match(examplesDoc, /\[AX threat-control traceability card\]\(ax-threat-control-traceability\.md\)/)
})

test('AX threat-control traceability card is Korean-first and maps threats to controls', () => {
  const doc = readDoc()

  for (const heading of [
    '# AX threat-control traceability card',
    '## 왜 이 카드가 필요한가',
    '## Borrow / Avoid / AgentGuard action',
    '## Threat → control → evidence matrix',
    '## Fixture-backed evidence commands',
    '## Machine-contract boundary',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /\|\s*Public signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /threat\s*→\s*control\s*→\s*evidence|Threat → control → evidence/i)
  assert.match(doc, /대상권|심사자|reviewer/i)
})

test('AX threat-control traceability card cites required public URLs', () => {
  const doc = readDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(doc, publicReferenceUrl)
  }
})

test('AX threat-control traceability card uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const surface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF'] as const) {
    expectLiteral(doc, surface)
  }
})

test('AX threat-control traceability card preserves English-compatible contracts', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'PASS',
    'REVIEW',
    'BLOCK',
    'rule IDs',
    'JSON',
    'SARIF',
    'ruleId',
    'artifactLocation.uri',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:CLI|명령어|rule IDs?|룰 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX threat-control traceability card rejects unsupported adoption certification and runtime claims', () => {
  const doc = readDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(doc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 OWASP 공식 인증을 받은 제품입니다.',
    'AgentGuard has verified GitHub approval.',
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
