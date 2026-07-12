import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-reference-evidence-triage.md')

const requiredHeadings = [
  '# AX public-reference evidence triage card',
  '## purpose',
  '## public reference triage map',
  '## exact evidence commands',
  '## reviewer question script',
  '## machine-contract boundaries',
  '## claim guardrails',
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
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
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-evidence-triage.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
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
  'artifactLocation',
  'region.startLine',
] as const

const unsupportedClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i,
  /(?:OWASP|GitHub|Snyk|MCP Authorization|SARIF)[^\n|.]{0,90}(?:endorsed|approved|verified|공식\s*검증|인증\s*완료|검증\s*완료)/i,
  /(?:OWASP|GitHub|Snyk|MCP Authorization|SARIF)[^\n|.]{0,90}(?:replacement|parity|동등|대체|replaces)/i,
  /runtime\s+(?:OAuth|authorization|session|consent|token)\s+(?:enforcement|보장|강제|검증)/i,
  /automatic\s+SARIF\s+upload|자동\s+SARIF\s+업로드/i,
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

test('AX public-reference evidence triage card exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-reference-evidence-triage.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public-reference evidence triage card\]\(docs\/ax-public-reference-evidence-triage\.md\)/)
  assert.match(examplesDoc, /\[AX public-reference evidence triage card\]\(ax-public-reference-evidence-triage\.md\)/)
})

test('AX public-reference evidence triage card is Korean-first and covers required headings', () => {
  const doc = readDoc()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = doc.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /심사위원 질문/)
  assert.match(doc, /\|\s*Public reference signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard evidence triage\s*\|/)
  assert.match(doc, /\|\s*Judge\/reviewer question\s*\|\s*Evidence command\s*\|\s*Expected decision language\s*\|/)
})

test('AX public-reference evidence triage card includes public reference URLs and borrow avoid framing', () => {
  const doc = readDoc()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /agent\/tool misuse|excessive agency|sensitive data exposure/i)
  assert.match(doc, /authorization|state\/session boundary|least-privilege/i)
  assert.match(doc, /SARIF.*artifact handoff/is)
  expectLiteral(doc, 'ruleId')
  expectLiteral(doc, 'artifactLocation')
  expectLiteral(doc, 'region.startLine')
})

test('AX public-reference evidence triage card uses exact fixture-backed commands and existing fixture paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/public-reference-evidence-triage.sarif')
})

test('AX public-reference evidence triage card preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of machineContracts) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename|renamed)/i)
})

test('AX public-reference evidence triage card bans unsupported adoption certification parity and runtime-auth claims', () => {
  const doc = readDoc()
  const claimSurface = doc.split('## claim guardrails')[0]

  for (const unsupportedClaimPattern of unsupportedClaimPatterns) {
    assert.doesNotMatch(claimSurface, unsupportedClaimPattern)
  }
})
