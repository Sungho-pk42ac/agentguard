import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-agent-rollout-preflight-checklist.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js doctor --json',
    fixtures: ['package.json'],
  },
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
      'mkdir -p .agentguard-demo/agent-rollout-preflight && node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-rollout-preflight/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://docs.snyk.io/cli-ide-and-ci-cd-integrations/snyk-cli/commands',
] as const

const machineContracts = [
  'PASS',
  'REVIEW',
  'BLOCK',
  'scan-diff',
  'scan-mcp',
  'scan-log',
  'doctor --json',
  'JSON',
  'SARIF',
  'ruleId',
  '--policy',
  '--sarif',
  '--out',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|customer adoption|enterprise deployment claim/i,
  /SOC\s*2|ISO\s*27001|official\s*certification|공식\s*인증|certified|certification|formal assurance/i,
  /(?:GitHub|Snyk|OWASP|MCP|code scanning)[^\n|.]{0,90}(?:parity|replacement|대체|동등)/i,
  /runtime\s+(?:OAuth|authorization|session|consent|token|auth)\s+(?:enforcement|보장|강제|검증)|runtime-auth\s+enforcement/i,
  /automatic\s+SARIF\s+upload|자동\s+SARIF\s+upload|자동\s+SARIF\s+업로드/i,
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

test('AX agent rollout preflight checklist exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-agent-rollout-preflight-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.ok(
    rootReadme.includes(
      '[AX agent rollout preflight checklist](docs/ax-agent-rollout-preflight-checklist.md)',
    ),
  )
  assert.ok(
    examplesDoc.includes(
      '[AX agent rollout preflight checklist](ax-agent-rollout-preflight-checklist.md)',
    ),
  )
})

test('AX agent rollout preflight checklist is Korean-first and maps preflight to rollout decisions', () => {
  const doc = readDoc()

  assert.match(doc, /^# AX agent rollout preflight checklist/m)
  assert.match(doc, /한국어 우선/)
  assert.match(doc, /60-second preflight flow/)
  assert.match(doc, /\|\s*Step\s*\|\s*Exact command\s*\|\s*Source evidence\s*\|\s*Expected decision\s*\|\s*Rerun \/ block trigger\s*\|/)
  assert.match(doc, /Approval decision checklist/)
  assert.match(doc, /agent self-report/i)
})

test('AX agent rollout preflight checklist uses exact fixture-backed commands and existing fixtures', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/agent-rollout-preflight/agentguard.sarif')
})

test('AX agent rollout preflight checklist includes public reference borrow avoid action rows', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /agent autonomy|tool-use/i)
  assert.match(doc, /authorization|session|consent/i)
  assert.match(doc, /SARIF artifact|code-scanning/i)
  assert.match(doc, /CLI flow|scan command|report artifact/i)
})

test('AX agent rollout preflight checklist preserves English machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of machineContracts) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로\s*(?:변경|바뀜)|한글로\s*(?:변경|바뀜)|renamed\s+to)/i)
})

test('AX agent rollout preflight checklist bans unsupported adoption certification parity runtime-auth and upload claims', () => {
  const doc = readDoc()
  const nonClaimSections = doc
    .replace(/## Public reference borrow\/avoid\/action table[\s\S]*?## Approval decision checklist/, '## Approval decision checklist')
    .replace(/## Claim guardrails[\s\S]*$/m, '')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(nonClaimSections, forbiddenClaimPattern)
  }

  assert.match(doc, /## Claim guardrails[\s\S]*customer adoption[\s\S]*certification[\s\S]*runtime-auth[\s\S]*automatic SARIF upload/i)
})
