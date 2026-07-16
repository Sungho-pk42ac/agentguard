import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-approval-owner-escalation-matrix.md')

const requiredHeadings = [
  '# AX approval owner escalation matrix',
  '## purpose',
  '## public reference signals',
  '## verdict-to-owner escalation matrix',
  '## pre-rollout guardrail review checkpoints',
  '## fixture-backed evidence commands',
  '## machine-contract guardrails',
  '## claim guardrails',
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://registry.npmjs.org/snyk',
  'https://openai.github.io/openai-agents-js/guides/guardrails/',
  'https://docs.anthropic.com/en/docs/claude-code/security',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/approval-owner-escalation.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i,
  /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:endorsed|approved|verified|공식\s*검증|인증\s*완료|검증\s*완료)/i,
  /(?:GitHub|Snyk)[^\n|.]{0,80}(?:replacement|parity|동등|대체)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:security|red[-\s]?team)\s+(?:platform|coverage|플랫폼|커버리지)/i,
] as const

const fakeUnsupportedClaims = [
  '실제 고객사 도입 완료 사례입니다.',
  'SOC 2 공식 인증을 받은 conformance 문서입니다.',
  'GitHub approved AgentGuard as a verified security product.',
  'Snyk replacement parity is guaranteed.',
  'full AI security platform coverage is complete.',
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

test('AX approval owner escalation matrix exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-approval-owner-escalation-matrix.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX approval owner escalation matrix\]\(docs\/ax-approval-owner-escalation-matrix\.md\)/)
  assert.match(examplesDoc, /\[AX approval owner escalation matrix\]\(ax-approval-owner-escalation-matrix\.md\)/)
})

test('AX approval owner escalation matrix keeps Korean-first required sections', () => {
  const doc = readDoc()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = doc.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /unknown company-problem rollout/i)
  assert.match(doc, /business owner|security owner|evidence owner/i)
  assert.match(doc, /npm ci && npm run build/)
  assert.match(doc, /static `PASS`.*production safety 보증이 아니다/)
  assert.match(doc, /runtime MCP enforcement.*직접 실행하지 않으며/)
})

test('AX approval owner escalation matrix cites required public reference URLs with scoped borrow avoid notes', () => {
  const doc = readDoc()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard use\s*\|/)
  assert.match(doc, /human oversight|mitigation/i)
  assert.match(doc, /least privilege|consent|tool access review/i)
  assert.match(doc, /artifactLocation\.uri|region\.startLine|ruleId/)
  assert.match(doc, /rerunnable evidence|CLI/i)
})

test('AX approval owner escalation matrix maps verdicts to owners and actions', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*AgentGuard verdict\s*\|\s*Business\/security meaning\s*\|\s*Approval owner\s*\|\s*Required action\s*\|\s*Rerun condition\s*\|/,
  )

  for (const verdict of ['PASS', 'REVIEW', 'BLOCK', 'ERROR', 'FAIL'] as const) {
    expectLiteral(doc, verdict)
  }

  for (const owner of ['business owner', 'security owner', 'evidence owner', 'pilot owner'] as const) {
    expectLiteral(doc, owner)
  }
})

test('AX approval owner escalation matrix maps guardrail review checkpoints to owners and evidence', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*Checkpoint\s*\|\s*Owner question\s*\|\s*Evidence command\s*\|\s*Decision rule\s*\|/,
  )

  for (const term of [
    'guardrail input/output check',
    'tool permission review',
    'least privilege consent review',
    'SARIF reviewer handoff',
    'business owner',
    'security owner',
    'evidence owner',
    'node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    'node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    'node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    'node dist/index.js scan-diff --sarif --out .agentguard-demo/approval-owner-escalation.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  ] as const) {
    expectLiteral(doc, term)
  }

  assert.match(doc, /OpenAI guardrails?를 실행한다고 말하지 않는다/i)
  assert.match(doc, /Claude Code\/Anthropic approval/i)
})

test('AX approval owner escalation matrix uses exact fixture-backed commands and existing fixture paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/approval-owner-escalation.sarif')
})

test('AX approval owner escalation matrix preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of [
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
  ] as const) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX approval owner escalation matrix rejects fake adoption certification and vendor parity claims', () => {
  const doc = readDoc()

  for (const fakeClaim of fakeUnsupportedClaims) {
    assert.ok(forbiddenClaimPatterns.some((pattern) => pattern.test(fakeClaim)), `${fakeClaim} should be forbidden`)
  }

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(doc, forbiddenClaimPattern)
  }
})
