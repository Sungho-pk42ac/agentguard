import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-agentic-tool-use-approval-queue.md')

const requiredHeadings = [
  '# AX agentic tool-use approval queue',
  '## purpose',
  '## approval queue map',
  '## exact evidence commands',
  '## public reference rows',
  '## machine-contract boundaries',
  '## claim guardrails',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentic-tool-use-approval-queue.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
] as const

const machineContracts = [
  'PASS',
  'REVIEW',
  'BLOCK',
  'agentguard scan-diff',
  'agentguard scan-mcp',
  'agentguard scan-log',
  'scan-diff',
  'scan-mcp',
  'scan-log',
  '--sarif',
  '--out',
  '--policy',
  'JSON',
  'SARIF',
  'ruleId',
  'artifactLocation',
  'region.startLine',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i,
  /(?:OWASP|GitHub|Snyk|MCP|SARIF)[^\n|.]{0,90}(?:endorsed|approved|verified|공식\s*검증|인증\s*완료|검증\s*완료)/i,
  /(?:OWASP|GitHub|Snyk|MCP|SARIF|CodeQL)[^\n|.]{0,90}(?:replacement|parity|동등|대체|replaces)/i,
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

test('AX agentic tool-use approval queue exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-agentic-tool-use-approval-queue.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX agentic tool-use approval queue\]\(docs\/ax-agentic-tool-use-approval-queue\.md\)/)
  assert.match(examplesDoc, /\[AX agentic tool-use approval queue\]\(ax-agentic-tool-use-approval-queue\.md\)/)
})

test('AX agentic tool-use approval queue is Korean-first and covers required headings', () => {
  const doc = readDoc()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = doc.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(doc, /한국어 우선/)
  assert.match(
    doc,
    /\|\s*Agent\/tool action surface\s*\|\s*Source evidence\s*\|\s*Exact evidence command \/ artifact\s*\|\s*Approval owner\s*\|\s*Queue decision\s*\|\s*Rerun trigger\s*\|/,
  )

  for (const surface of ['PR diff', 'MCP config', 'agent transcript/log', 'Reviewer', '30초 데모']) {
    expectLiteral(doc, surface)
  }
})

test('AX agentic tool-use approval queue uses exact fixture-backed commands and existing fixture paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/agentic-tool-use-approval-queue.sarif')
  expectLiteral(doc, '.agentguard-demo/ax-evidence-smoke/manifest.json')
})

test('AX agentic tool-use approval queue includes public reference rows with borrow and avoid guardrails', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard approval-queue use\s*\|/)

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /agent\/tool misuse|excessive agency|human-control/i)
  assert.match(doc, /least privilege|user consent|tool authorization|token\/permission boundary/i)
  assert.match(doc, /SARIF `ruleId`|artifactLocation|region.startLine/i)
  assert.match(doc, /certification|runtime OAuth|automatic SARIF upload|replacement/i)
})

test('AX agentic tool-use approval queue preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of machineContracts) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename|renamed)/i)
})

test('AX agentic tool-use approval queue bans unsupported adoption certification parity and runtime-auth claims', () => {
  const doc = readDoc()
  const nonClaimSections = doc
    .replace(/## public reference rows[\s\S]*?## machine-contract boundaries/, '## machine-contract boundaries')
    .replace(/## claim guardrails[\s\S]*$/m, '')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(nonClaimSections, forbiddenClaimPattern)
  }

  assert.match(doc, /## claim guardrails[\s\S]*automatic SARIF upload/)
  assert.match(doc, /## public reference rows[\s\S]*certification[\s\S]*runtime OAuth[\s\S]*automatic SARIF upload/)
})
