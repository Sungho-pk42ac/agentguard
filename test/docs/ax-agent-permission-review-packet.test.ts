import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const packetPath = join(repoRoot, 'docs', 'ax-agent-permission-review-packet.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
    expectedVerdict: 'REVIEW',
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
    expectedVerdict: 'REVIEW',
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
    expectedVerdict: 'REVIEW',
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const requiredHeadings = [
  '# AX agent permission review packet',
  '## 사용 목적',
  '## 30초 permission review flow',
  '## Company problem → permission surface → command → verdict → approval condition',
  '## Public reference borrow / avoid / action notes',
  '## English-compatible machine contracts',
  '## Non-claim guardrails',
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

function readPacket(): string {
  return readFileSync(packetPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX agent permission review packet exists and is linked from README docs list', () => {
  assert.ok(existsSync(packetPath), 'docs/ax-agent-permission-review-packet.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX agent permission review packet\]\(docs\/ax-agent-permission-review-packet\.md\)/)
})

test('AX agent permission review packet keeps Korean-first reviewer sections', () => {
  const packet = readPacket()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = packet.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(packet, /한국어 우선/)
  assert.match(packet, /30초/)
  assert.match(packet, /무엇을 읽고, 무엇을 실행하고, 무엇을 내보낼 수 있는지/)
})

test('AX agent permission review packet maps company problems to exact fixture-backed commands and approval conditions', () => {
  const packet = readPacket()

  assert.match(
    packet,
    /\|\s*Company problem\s*\|\s*Agent permission surface\s*\|\s*Exact AgentGuard command\s*\|\s*Expected verdict\s*\|\s*Approval condition\s*\|/,
  )

  for (const { command, fixtures, expectedVerdict } of fixtureBackedCommands) {
    expectLiteral(packet, command)
    expectLiteral(packet, expectedVerdict)

    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(packet, fixturePath)
    }
  }

  for (const permissionSurface of ['PR diff', 'MCP config', 'transcript/log', 'read', 'execute', 'export'] as const) {
    expectLiteral(packet, permissionSurface)
  }
})

test('AX agent permission review packet cites public references with borrow avoid action framing', () => {
  const packet = readPacket()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(packet, referenceUrl)
  }

  assert.match(packet, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(packet, /tool misuse/i)
  assert.match(packet, /least privilege/i)
  assert.match(packet, /SARIF/i)
  assert.match(packet, /AI-agent, MCP, workflow scanner category/i)
})

test('AX agent permission review packet preserves English-compatible machine contracts', () => {
  const packet = readPacket()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'node dist/index.js scan-diff',
    'node dist/index.js scan-mcp',
    'node dist/index.js scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'denied-command',
    'approval-required',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'ruleId',
    'result',
    'location',
    'artifact',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(packet, contract)
  }

  assert.doesNotMatch(packet, /(?:CLI commands?|rule IDs?|machine fields?|JSON|SARIF|API)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX agent permission review packet bans fake adoption certification parity and unsupported compliance claims', () => {
  const packet = readPacket()

  assert.doesNotMatch(packet, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(packet, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(packet, /(?:OWASP|MCP|GitHub|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:공식\s*검증|인증\s*완료|검증\s*완료|approved|verified)/i)
  assert.doesNotMatch(packet, /(?:GitHub\s+security\s+products?|Snyk|Tencent|splx-ai)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(packet, /(?:full|complete|전체)\s+(?:AI\s+)?(?:security|red[-\s]?team)\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
