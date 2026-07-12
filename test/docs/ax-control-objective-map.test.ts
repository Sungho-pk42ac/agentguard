import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-control-objective-map.md')

const requiredHeadings = [
  '# AX control objective map',
  '## purpose',
  '## control objective map',
  '## fixture-backed evidence commands',
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/control-objective-map.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
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
  'agentguard scan-diff',
  'agentguard scan-mcp',
  'agentguard scan-log',
] as const

const requiredSurfaces = ['PR diff', 'MCP config', 'transcript/log', 'SARIF/report', 'smoke/evidence freshness'] as const

const forbiddenClaimPatterns = [
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

test('AX control objective map exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-control-objective-map.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX control objective map\]\(docs\/ax-control-objective-map\.md\)/)
  assert.match(examplesDoc, /\[AX control objective map\]\(ax-control-objective-map\.md\)/)
})

test('AX control objective map is Korean-first and covers required headings and surfaces', () => {
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
    /\|\s*Company problem signal\s*\|\s*AgentGuard surface\s*\|\s*Control objective\s*\|\s*Exact evidence command \/ artifact\s*\|\s*Approver decision\s*\|\s*Rerun \/ freshness trigger\s*\|/,
  )

  for (const surface of requiredSurfaces) {
    expectLiteral(doc, surface)
  }
})

test('AX control objective map uses exact fixture-backed commands and existing fixture paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/control-objective-map.sarif')
  expectLiteral(doc, '.agentguard-demo/ax-evidence-smoke/manifest.json')
})

test('AX control objective map includes public reference rows with borrow and avoid guardrails', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard control-objective use\s*\|/)

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /agentic risk|tool misuse|excessive agency/i)
  assert.match(doc, /authorization|least privilege|token\/session boundary/i)
  assert.match(doc, /reviewer artifact|result|ruleId|artifactLocation/i)
  assert.match(doc, /certification|runtime OAuth|automatic upload|parity/i)
})

test('AX control objective map preserves English-compatible machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of machineContracts) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename|renamed)/i)
})

test('AX control objective map bans unsupported adoption certification parity and runtime-auth claims', () => {
  const doc = readDoc()
  const claimSurface = doc.split('## public reference rows')[0]

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(claimSurface, forbiddenClaimPattern)
  }
})
