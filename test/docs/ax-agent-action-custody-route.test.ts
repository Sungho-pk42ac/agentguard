import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-agent-action-custody-route.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'] as const,
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'] as const,
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml --json < examples/approval-required-review.jsonl',
    fixtures: ['examples/agent-policy.yaml', 'examples/approval-required-review.jsonl'] as const,
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-agent-action-custody-route.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'] as const,
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

const requiredHeadings = [
  '# AX agent action custody route',
  '## 사용 목적',
  '## Agent action custody route',
  '## Exact fixture-backed commands',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract boundaries',
  '## Non-claim guardrails',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /(?:SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance)[^\r\n|.]{0,80}(?:achieved|보유|획득|완료)/i,
  /^(?=.*(?:OWASP|MCP|GitHub|SARIF|AX))(?=.*(?:검증\s*완료|인증\s*완료|approved|(?<!un)verified|endorsed)).*$/im,
  /^(?=.*(?:runtime|live))(?=.*(?:OAuth|state mismatch|session|authorization))(?=.*(?:\b(?:enforces|prevents)\b|차단한다|방지한다|검증한다)).*$/im,
  /^(?=.*(?:upload|triage|approval))(?=.*(?:자동\s*(?:완료|처리)|automatically\s+(?:uploads|triages|approves))).*$/im,
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

test('AX agent action custody route exists and is linked from entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-agent-action-custody-route.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX agent action custody route\]\(docs\/ax-agent-action-custody-route\.md\)/)
  assert.match(examplesReadme, /\[AX agent action custody route\]\(\.\.\/docs\/ax-agent-action-custody-route\.md\)/)
  assert.match(examplesDoc, /\[AX agent action custody route\]\(ax-agent-action-custody-route\.md\)/)
})

test('AX agent action custody route has Korean-first custody sections', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    expectLiteral(doc, heading)
  }

  for (const phrase of [
    '한국어 우선',
    'agent action',
    'source artifact',
    'AgentGuard command',
    'custody owner',
    'approval decision',
    'rerun trigger',
    'AX Rollout Guard',
  ] as const) {
    assert.match(doc, new RegExp(escapeRegExp(phrase), 'i'))
  }

  assert.match(doc, /PR diff[\s\S]{0,900}security reviewer[\s\S]{0,900}rerun/i)
  assert.match(doc, /MCP config[\s\S]{0,900}tooling owner[\s\S]{0,900}approve\/deny/i)
  assert.match(doc, /transcript\/log[\s\S]{0,900}incident\/security reviewer[\s\S]{0,900}rollback/i)
  assert.match(doc, /SARIF[\s\S]{0,900}CI owner[\s\S]{0,900}artifact/i)
})

test('AX agent action custody route uses exact fixture-backed commands with existing inputs', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }
})

test('AX agent action custody route cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /OWASP Agentic AI threats and mitigations/i)
  assert.match(doc, /MCP Authorization spec/i)
  assert.match(doc, /GitHub SARIF upload docs/i)
  assert.match(doc, /authorization boundary|state mismatch|trusted redirect URI/i)
  assert.match(doc, /SARIF artifact|code-scanning artifact/i)
})

test('AX agent action custody route preserves machine contracts and bans fake claims', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(doc, contract)
  }

  for (const requiredNonClaim of [
    'no scanner behavior change',
    'no default verdict/severity change',
    'no automatic SARIF upload',
    'no runtime authorization claim',
    'no real customer/adoption claim',
    'no external certification',
    'no platform parity claim',
  ] as const) {
    assert.match(doc, new RegExp(escapeRegExp(requiredNonClaim), 'i'))
  }

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(doc, forbiddenClaimPattern)
  }

  assert.doesNotMatch(doc, /(?:CLI commands?|rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
})
