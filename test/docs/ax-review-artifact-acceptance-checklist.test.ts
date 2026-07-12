import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-review-artifact-acceptance-checklist.md')

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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/review-artifact-acceptance/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html',
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
  'JSON',
  'SARIF',
  'ruleId',
  'artifactLocation',
  'region.startLine',
  '--policy',
  '--sarif',
  '--out',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /SOC\s*2|ISO\s*27001|official\s*certification|공식\s*인증|certified|certification|formal assurance/i,
  /(?:GitHub|Snyk|OWASP|MCP|code scanning)[^\n|.]{0,90}(?:parity|replacement|대체|동등)/i,
  /runtime\s+(?:OAuth|authorization|session|consent|token)\s+(?:enforcement|보장|강제|검증)/i,
  /automatic\s+SARIF\s+upload|자동\s+SARIF\s+upload|자동\s+SARIF\s+업로드/i,
  /legal\s+retention\s+engine|eDiscovery|hosted\s+archival|retention\s+SaaS/i,
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

test('AX review artifact acceptance checklist exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-review-artifact-acceptance-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.ok(
    rootReadme.includes('[AX review artifact acceptance checklist](docs/ax-review-artifact-acceptance-checklist.md)'),
  )
  assert.ok(
    examplesDoc.includes('[AX review artifact acceptance checklist](ax-review-artifact-acceptance-checklist.md)'),
  )
})

test('AX review artifact acceptance checklist is Korean-first and covers reviewer decisions', () => {
  const doc = readDoc()

  assert.match(doc, /^# AX review artifact acceptance checklist/m)
  assert.match(doc, /한국어 우선/)
  assert.match(doc, /accept.*request rerun.*block/i)
  assert.match(doc, /agent self-report/)
  assert.match(doc, /\|\s*Review surface\s*\|\s*Source evidence\s*\|\s*Exact evidence command \/ artifact\s*\|\s*Acceptance decision\s*\|\s*Rerun \/ block trigger\s*\|/)

  for (const surface of ['PR diff risk', 'MCP config risk', 'Agent transcript/log approval', 'SARIF reviewer artifact']) {
    expectLiteral(doc, surface)
  }
})

test('AX review artifact acceptance checklist uses exact fixture-backed commands and existing fixtures', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/review-artifact-acceptance/agentguard.sarif')
})

test('AX review artifact acceptance checklist includes public reference borrow avoid action rows', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /Artifact upload\/download|workflow artifacts/i)
  assert.match(doc, /SARIF file handoff|code-scanning reviewer channel/i)
  assert.match(doc, /Least privilege|user consent|audit\/logging/i)
  assert.match(doc, /Human approval|auditability|tool-use control/i)
})

test('AX review artifact acceptance checklist preserves English machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of machineContracts) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로\s*(?:변경|바뀜)|한글로\s*(?:변경|바뀜)|renamed\s+to)/i)
})

test('AX review artifact acceptance checklist bans unsupported adoption certification parity runtime-auth upload and retention claims', () => {
  const doc = readDoc()
  const nonClaimSections = doc
    .replace(/## public reference borrow\/avoid\/action table[\s\S]*?## machine-contract boundaries/, '## machine-contract boundaries')
    .replace(/## claim guardrails[\s\S]*$/m, '')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(nonClaimSections, forbiddenClaimPattern)
  }

  assert.match(doc, /## claim guardrails[\s\S]*customer adoption[\s\S]*certification[\s\S]*runtime-auth[\s\S]*automatic SARIF upload[\s\S]*legal retention-engine/i)
})
