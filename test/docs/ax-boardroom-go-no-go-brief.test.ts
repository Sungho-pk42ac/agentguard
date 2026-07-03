import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const briefPath = join(repoRoot, 'docs', 'ax-boardroom-go-no-go-brief.md')

const publicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json'],
  },
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

function readBrief(): string {
  return readFileSync(briefPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX boardroom go/no-go brief exists and is linked from README', () => {
  assert.ok(existsSync(briefPath), 'docs/ax-boardroom-go-no-go-brief.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX boardroom go\/no-go brief\]\(docs\/ax-boardroom-go-no-go-brief\.md\)/)
})

test('AX boardroom go/no-go brief is Korean-first with required decision headings', () => {
  const brief = readBrief()

  assert.match(brief, /^# AX boardroom go\/no-go brief/m)
  assert.match(brief, /한국어 우선/)

  for (const heading of [
    '## 대상권 boardroom use',
    '## Decision map: BLOCK / conditional REVIEW / PASS',
    '## Fixture-backed commands',
    '## Residual risk register',
    '## Public reference framing',
    '## Honesty guardrails',
  ] as const) {
    expectLiteral(brief, heading)
  }
})

test('AX boardroom go/no-go brief uses exact fixture-backed commands and existing fixtures', () => {
  const brief = readBrief()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(brief, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(brief, fixturePath)
    }
  }
})

test('AX boardroom go/no-go brief maps verdicts to approval conditions and residual risk', () => {
  const brief = readBrief()

  for (const requiredText of [
    'BLOCK',
    'conditional REVIEW',
    'PASS',
    '운영 배포 no-go',
    '조건부 제한 rollout',
    'go 후보',
    'residual risk owner',
    'runtime telemetry',
    'token scope',
    'SaaS permission',
    'approval log',
    'CLI/rule/JSON/SARIF machine contract unchanged',
  ] as const) {
    expectLiteral(brief, requiredText)
  }
})

test('AX boardroom go/no-go brief cites approved public references as framing only', () => {
  const brief = readBrief()

  assert.match(brief, /\|\s*Reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*Boardroom use\s*\|/)
  for (const publicReference of publicReferences) {
    expectLiteral(brief, publicReference)
  }

  assert.match(brief, /OWASP/)
  assert.match(brief, /MCP Security Best Practices/)
  assert.match(brief, /Tencent AI-Infra-Guard/)
  assert.match(brief, /Agentic Radar/)
})

test('AX boardroom go/no-go brief avoids fake adoption certification platform and contract claims', () => {
  const brief = readBrief()

  assert.doesNotMatch(brief, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(brief, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(
    brief,
    /(?:OWASP|MCP|Tencent|splx|GitHub)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement|대체)/i,
  )
  assert.doesNotMatch(brief, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(
    brief,
    /(?:CLI|rule|JSON|SARIF)[^\n|.]{0,80}(?:변경됨|변경했다|\bchanged\b|renamed|presentation-only rename)/i,
  )
})
