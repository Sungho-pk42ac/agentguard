import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-evidence-custody-chain.md')

const requiredHeadings = [
  '# AX evidence custody chain',
  '## 사용 목적',
  '## Custody chain format',
  '## Company problem → source evidence → command → artifact → approval',
  '## Fixture-backed commands',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract guardrails',
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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://github.com/snyk/agent-scan',
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

test('AX evidence custody chain exists and is linked from the README docs list', () => {
  assert.ok(existsSync(docPath), 'docs/ax-evidence-custody-chain.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

  assert.match(rootReadme, /\[AX evidence custody chain\]\(docs\/ax-evidence-custody-chain\.md\)/)
})

test('AX evidence custody chain has Korean-first custody headings', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /source evidence/i)
  assert.match(doc, /rerun\/freshness condition/i)
})

test('AX evidence custody chain maps company problems to evidence, commands, artifacts, approvers, and freshness', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*Company problem\s*\|\s*Source evidence\s*\|\s*Exact AgentGuard command\s*\|\s*Artifact path\/hash or report handoff\s*\|\s*Reviewer\/approver\s*\|\s*Rerun\/freshness condition\s*\|/,
  )

  for (const requiredTerm of [
    'PR diff',
    'MCP config',
    'transcript/log',
    'SARIF',
    'approver',
    'artifact hash',
    'report handoff',
    'freshness',
  ] as const) {
    expectLiteral(doc, requiredTerm)
  }
})

test('AX evidence custody chain uses exact fixture-backed commands with existing paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX evidence custody chain cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*Custody-chain action\s*\|/)
  assert.match(doc, /OWASP Agentic AI threats and mitigations/i)
  assert.match(doc, /GitHub SARIF support/i)
  assert.match(doc, /Snyk agent-scan/i)
})

test('AX evidence custody chain preserves machine contracts and avoids unsupported trust claims', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'machine contracts',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(doc, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(doc, /(?:OWASP|GitHub|SARIF|Snyk|agent-scan)[^\r\n|.]{0,80}(?:공식\s*검증|검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security|보안)\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(
    doc,
    /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i,
  )
})
