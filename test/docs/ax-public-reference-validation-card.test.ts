import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-reference-validation-card.md')

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
      'mkdir -p .agentguard-demo/public-reference-validation && node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-validation/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://www.npmjs.com/package/agent-security-scanner-mcp',
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
  '--policy',
  '--sarif',
  '--out',
] as const

const forbiddenClaimPatterns = [
  /(?:customer adoption|고객사\s*도입|도입\s*(?:완료|사례)|레퍼런스\s*고객)/i,
  /(?:SOC\s*2|ISO\s*27001|official\s*certification|공식\s*인증|certified|certification)/i,
  /(?:GitHub|Snyk|OWASP|MCP|npm|public scanner)[^\n|.]{0,100}(?:parity|replacement|same-scope|대체|동등)/i,
  /(?:runtime-auth|runtime\s+(?:OAuth|authorization|session|consent|token|auth))[^\n.]{0,80}(?:enforcement|보장|강제|검증)/i,
  /(?:automatic\s+SARIF\s+upload|자동\s+SARIF\s+upload|자동\s+SARIF\s+업로드)/i,
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

test('AX public reference validation card exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-reference-validation-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.ok(
    rootReadme.includes(
      '[AX public reference validation card](docs/ax-public-reference-validation-card.md)',
    ),
  )
  assert.ok(
    examplesDoc.includes(
      '[AX public reference validation card](ax-public-reference-validation-card.md)',
    ),
  )
})

test('AX public reference validation card is Korean-first and maps references to AgentGuard actions', () => {
  const doc = readDoc()

  assert.match(doc, /^# AX public reference validation card/m)
  assert.match(doc, /공개 레퍼런스/)
  assert.match(doc, /무엇을 빌렸는지/)
  assert.match(doc, /무엇은 주장하지 않는지/)
  assert.match(doc, /어떤 AgentGuard evidence command/)
  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /Judge explanation script/)
  assert.match(doc, /Approval validation checklist/)
})

test('AX public reference validation card includes current public reference signals', () => {
  const doc = readDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(doc, publicReferenceUrl)
  }

  assert.match(doc, /LLM\/agent risk vocabulary|prompt\/tool misuse/i)
  assert.match(doc, /Authorization, client\/server trust, session/i)
  assert.match(doc, /SARIF file, code scanning route, `ruleId`/i)
  assert.match(doc, /AI-agent\/MCP scanner language/i)
})

test('AX public reference validation card uses exact fixture-backed commands and existing fixtures', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/public-reference-validation/agentguard.sarif')
})

test('AX public reference validation card preserves English machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of machineContracts) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로\s*(?:변경|바뀜)|한글로\s*(?:변경|바뀜)|renamed\s+to)/i)
})

test('AX public reference validation card bans unsupported adoption certification parity runtime-auth and auto-upload claims', () => {
  const doc = readDoc()
  const claimBearingSections = doc
    .replace(/## Public reference validation table[\s\S]*?## Exact evidence commands/, '## Exact evidence commands')
    .replace(/## Claim guardrails[\s\S]*$/m, '')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(claimBearingSections, forbiddenClaimPattern)
  }

  assert.match(doc, /## Claim guardrails[\s\S]*customer adoption[\s\S]*certification[\s\S]*runtime-auth[\s\S]*automatic SARIF upload/i)
})
