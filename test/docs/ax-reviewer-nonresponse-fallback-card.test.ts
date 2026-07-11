import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-reviewer-nonresponse-fallback-card.md')

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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/reviewer-nonresponse.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const requiredPublicReferences = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const requiredHeadings = [
  '# AX reviewer non-response fallback card',
  '## 판정/무응답 fallback matrix',
  '## Fixture-backed evidence commands',
  '## Public reference borrow/avoid/action notes',
  '## Non-claim guardrails',
  '## Machine-contract boundaries',
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

test('AX reviewer non-response fallback card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-reviewer-nonresponse-fallback-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(
    rootReadme,
    /\[AX reviewer non-response fallback card\]\(docs\/ax-reviewer-nonresponse-fallback-card\.md\)/,
  )
  assert.match(
    examplesDoc,
    /\[AX reviewer non-response fallback card\]\(ax-reviewer-nonresponse-fallback-card\.md\)/,
  )
})

test('AX reviewer non-response fallback card is Korean-first and maps verdicts plus non-response to decisions', () => {
  const card = readCard()

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)

  const verdictRows = new Map(
    card
      .split('\n')
      .filter((line) => /^\|\s*(?:`PASS`|`REVIEW`|`BLOCK`|reviewer non-response)\s*\|/.test(line))
      .map((line) => {
        const status = line.match(/^\|\s*(`PASS`|`REVIEW`|`BLOCK`|reviewer non-response)\s*\|/)?.[1]
        assert.ok(status, `could not parse status row: ${line}`)
        return [status.replaceAll('`', ''), line]
      }),
  )

  for (const verdict of ['PASS', 'REVIEW', 'BLOCK', 'reviewer non-response'] as const) {
    const row = verdictRows.get(verdict)
    assert.ok(row, `${verdict} row should exist in the fallback matrix`)
    assert.match(row, /owner|소유|담당|reviewer/i, `${verdict} row should name an owner or reviewer`)
    assert.match(row, /timeout|timebox|분|시간/i, `${verdict} row should name a timeout or timebox`)
    assert.match(
      row,
      /fallback artifact|fallback 산출물|대체 산출물|Markdown report|memo|SARIF|artifact/i,
      `${verdict} row should name a fallback artifact`,
    )
    assert.match(
      row,
      /node dist\/index\.js scan-(?:diff|mcp|log)/,
      `${verdict} row should include an exact rerun command`,
    )
    assert.match(row, /residual risk|잔여 리스크|승인|제한|보류|block/i, `${verdict} row should name a residual-risk decision`)
  }
})

test('AX reviewer non-response fallback card uses exact fixture-backed commands and existing fixture paths', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  expectLiteral(card, '.agentguard-demo/reviewer-nonresponse.sarif')
})

test('AX reviewer non-response fallback card cites public references with borrow avoid action rows', () => {
  const card = readCard()

  for (const reference of requiredPublicReferences) {
    expectLiteral(card, reference)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /human oversight|사람 검토|human-in-the-loop/i)
  assert.match(card, /authorization boundary|trusted redirect|state/i)
  assert.match(card, /SARIF artifact|reviewer handoff/i)
  assert.match(card, /agent\/MCP scanner|MCP scanner|agent scanner/i)
})

test('AX reviewer non-response fallback card states current non-claim guardrails', () => {
  const card = readCard()

  for (const guardrail of [
    'No runtime OAuth/MCP enforcement',
    'No automatic GitHub upload/approval',
    'No vendor parity/certification/adoption claims',
    'No CLI/rule/JSON/SARIF machine contract changes',
  ] as const) {
    expectLiteral(card, guardrail)
  }

  assert.doesNotMatch(card, /AgentGuard (?:enforces|validates|implements) (?:runtime )?(?:OAuth|MCP authorization|session consent)/i)
  assert.doesNotMatch(card, /(?:automatically|auto)[^.\n|]{0,80}(?:uploads? SARIF|approves?|triages?) (?:to )?GitHub/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar)[^.\n|]{0,80}(?:certified|approved|verified|endorsed|adopted)/i)
  assert.doesNotMatch(card, /^(?!-\s*No\b).*(?:CLI|rule IDs?|JSON|SARIF|machine fields?)[^.\n|]{0,80}(?:rename|renamed|changed|변경|바뀜)/im)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
