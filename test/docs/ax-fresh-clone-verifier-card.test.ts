import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-fresh-clone-verifier-card.md')

const fixtureBackedCommands = [
  {
    command: 'npm ci && npm run build',
    fixtures: ['package.json'],
  },
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
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/fresh-clone-verifier/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/Tencent/AI-Infra-Guard',
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
  'doctor --json',
  'JSON',
  'SARIF',
  'ruleId',
  '--policy',
  '--sarif',
  '--out',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i,
  /SOC\s*2|ISO\s*27001|official\s*certification|공식\s*인증|certified|certification|formal assurance/i,
  /(?:GitHub|Snyk|OWASP|MCP|Tencent|code scanning)[^\n|.]{0,90}(?:parity|replacement|대체|동등)/i,
  /runtime\s+(?:OAuth|authorization|session|consent|token)\s+(?:enforcement|보장|강제|검증)/i,
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

test('AX fresh-clone verifier card exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-fresh-clone-verifier-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.ok(rootReadme.includes('[AX fresh-clone verifier card](docs/ax-fresh-clone-verifier-card.md)'))
  assert.ok(examplesDoc.includes('[AX fresh-clone verifier card](ax-fresh-clone-verifier-card.md)'))
})

test('AX fresh-clone verifier card is Korean-first and maps setup to approval decisions', () => {
  const doc = readDoc()

  assert.match(doc, /^# AX fresh-clone verifier card/m)
  assert.match(doc, /한국어 우선/)
  assert.match(doc, /fresh clone|fresh-clone/i)
  assert.match(doc, /\|\s*Verification step\s*\|\s*Exact command\s*\|\s*Expected evidence\s*\|\s*Reviewer decision\s*\|\s*Rerun \/ block trigger\s*\|/)
  assert.match(doc, /accept|request rerun|block/i)
  assert.match(doc, /agent self-report/i)
})

test('AX fresh-clone verifier card uses exact fixture-backed commands and existing fixtures', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  expectLiteral(doc, '.agentguard-demo/fresh-clone-verifier/agentguard.sarif')
})

test('AX fresh-clone verifier card includes public reference borrow avoid action rows', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /REAL PROBLEM|REAL JUDGE|REAL OUTPUT/i)
  assert.match(doc, /Least privilege|user consent|audit/i)
  assert.match(doc, /Human-in-the-loop|approval/i)
  assert.match(doc, /SARIF file|code scanning/i)
  assert.match(doc, /Agent Scan|MCP scan|AI Infra/i)
})

test('AX fresh-clone verifier card preserves English machine contracts', () => {
  const doc = readDoc()

  for (const machineContract of machineContracts) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:PASS|REVIEW|BLOCK|scan-diff|scan-mcp|scan-log|JSON|SARIF|ruleId)[^\n]*(?:한국어로\s*(?:변경|바뀜)|한글로\s*(?:변경|바뀜)|renamed\s+to)/i)
})

test('AX fresh-clone verifier card bans unsupported adoption certification parity runtime-auth and upload claims', () => {
  const doc = readDoc()
  const nonClaimSections = doc
    .replace(/## public reference borrow\/avoid\/action table[\s\S]*?## machine-contract boundaries/, '## machine-contract boundaries')
    .replace(/## claim guardrails[\s\S]*$/m, '')

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(nonClaimSections, forbiddenClaimPattern)
  }

  assert.match(doc, /## claim guardrails[\s\S]*customer adoption[\s\S]*certification[\s\S]*runtime-auth[\s\S]*automatic SARIF upload/i)
})
