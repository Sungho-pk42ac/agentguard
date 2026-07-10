import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const drillPath = join(repoRoot, 'docs', 'ax-timeboxed-escalation-drill.md')

const requiredHeadings = [
  '# AX timeboxed escalation drill',
  '## purpose',
  '## verdict escalation card',
  '## fixture-backed evidence commands',
  '## public reference rows',
  '## machine-contract boundaries',
  '## claim guardrails',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/travel-reservation-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/travel-reservation-agent/risky-mcp.json'],
  },
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
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/timeboxed-escalation.sarif < examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://genai.owasp.org/llmrisk/llm01-prompt-injection/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const machineContracts = [
  'PASS',
  'REVIEW',
  'BLOCK',
  'scan-diff',
  'scan-mcp',
  'scan-log',
  'JSON',
  'SARIF',
  'ruleId',
  'agentguard scan-diff',
  'agentguard scan-mcp',
  'agentguard scan-log',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i,
  /(?:GitHub|OWASP|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar)[^\n|.]{0,80}(?:endorsed|approved|verified|공식\s*검증|인증\s*완료|검증\s*완료)/i,
  /(?:GitHub|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar)[^\n|.]{0,80}(?:replacement|parity|동등|대체)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:security|red[-\s]?team|scanner)\s+(?:platform|coverage|플랫폼|커버리지)/i,
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

function readDrill(): string {
  return readFileSync(drillPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX timeboxed escalation drill exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(drillPath), 'docs/ax-timeboxed-escalation-drill.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX timeboxed escalation drill\]\(docs\/ax-timeboxed-escalation-drill\.md\)/)
  assert.match(examplesDoc, /\[AX timeboxed escalation drill\]\(ax-timeboxed-escalation-drill\.md\)/)
})

test('AX timeboxed escalation drill is Korean-first and answers owner timebox evidence and rerun for each verdict', () => {
  const drill = readDrill()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = drill.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(drill, /한국어 우선/)
  assert.match(
    drill,
    /\|\s*AgentGuard verdict\s*\|\s*Response owner\s*\|\s*Timebox\s*\|\s*Evidence command\/artifact\s*\|\s*Rerun trigger\s*\|/,
  )

  for (const verdict of ['BLOCK', 'REVIEW', 'PASS'] as const) {
    assert.match(
      drill,
      new RegExp(`\\|[^\\n]*\`${verdict}\`[\\s\\S]{0,700}(?:owner|security owner|business owner|evidence owner)[\\s\\S]{0,700}(?:분|시간|same business day|next rollout)[\\s\\S]{0,700}(?:scan-diff|scan-mcp|scan-log|SARIF)[\\s\\S]{0,700}(?:rerun|재실행)`),
      `${verdict} row should answer owner, timebox, evidence, and rerun`,
    )
  }
})

test('AX timeboxed escalation drill uses exact fixture-backed commands and existing fixture paths', () => {
  const drill = readDrill()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(drill, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(drill, fixturePath)
    }
  }

  expectLiteral(drill, '.agentguard-demo/timeboxed-escalation.sarif')
})

test('AX timeboxed escalation drill includes public reference rows with borrow and avoid guardrails', () => {
  const drill = readDrill()

  assert.match(drill, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard drill use\s*\|/)

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(drill, referenceUrl)
  }

  assert.match(drill, /artifact|reviewer handoff|ruleId/i)
  assert.match(drill, /human oversight|action framing|agentic risk|prompt injection/i)
  assert.match(drill, /rerunnable scanner evidence|operationalization/i)
  assert.match(drill, /endorsement|runtime prevention|platform parity|adoption/i)
})

test('AX timeboxed escalation drill preserves English-compatible machine contracts', () => {
  const drill = readDrill()

  for (const machineContract of machineContracts) {
    expectLiteral(drill, machineContract)
  }

  assert.doesNotMatch(drill, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename|renamed)/i)
})

test('AX timeboxed escalation drill bans unsupported adoption certification and parity claims', () => {
  const drill = readDrill()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(drill, forbiddenClaimPattern)
  }
})
