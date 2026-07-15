import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const ledgerDocPath = join(repoRoot, 'docs', 'ax-public-scanner-signal-refresh-ledger.md')

const publicReferenceUrls = [
  'https://github.com/snyk/agent-scan',
  'https://registry.npmjs.org/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
  'https://github.com/affaan-m/agentshield',
  'https://www.npmjs.com/package/agent-security-scanner-mcp',
  'https://registry.npmjs.org/agent-security-scanner-mcp',
  'https://www.proof-layer.com/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/public-scanner-signal-refresh.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance/i,
  /(?:OWASP|MCP|GitHub|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar|agentshield)[^\n|]{0,120}(?:검증(?:이|을)?\s*완료|인증(?:이|을)?\s*완료|official\s+public\s+approval|approved|verified|endorsed)|official\s+public\s+approval[^\n|]{0,120}(?:OWASP|MCP|GitHub|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar|agentshield)/i,
  /(?:agent-scan|AI-Infra-Guard|agentic-radar|agentshield|public scanners?|scanner ecosystem)[^\n|]{0,120}(?:대체|replacement|parity|동등|equivalence|equivalent|호환|유사)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:(?:red[-\s]?team|security|보안)\s+)?(?:platform|coverage|플랫폼|커버리지)/i,
  /(?:runtime|실시간)[^\n|]{0,120}(?:OAuth|authorization|session|consent|token)[^\n|]{0,120}(?:enforcement|강제|보장|지원)/i,
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

function readLedgerDoc(): string {
  return readFileSync(ledgerDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public scanner signal refresh ledger exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(ledgerDocPath), 'docs/ax-public-scanner-signal-refresh-ledger.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public scanner signal refresh ledger\]\(docs\/ax-public-scanner-signal-refresh-ledger\.md\)/)
  assert.match(examplesDoc, /\[AX public scanner signal refresh ledger\]\(ax-public-scanner-signal-refresh-ledger\.md\)/)
})

test('AX public scanner signal refresh ledger is Korean-first and maps source signals to action', () => {
  const ledgerDoc = readLedgerDoc()

  for (const heading of [
    '# AX public scanner signal refresh ledger',
    '## 목적',
    '## Fresh public signals checked this run',
    '## Research provenance for this refresh',
    '## Judge-visible action ledger',
    '## Exact evidence commands',
    '## Machine contracts',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(ledgerDoc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(ledgerDoc, /한국어 우선/)
  assert.match(
    ledgerDoc,
    /\|\s*Public signal\s*\|\s*Observed cue\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/,
  )
  assert.match(ledgerDoc, /대상권|AX judging|judge-facing/i)

  for (const term of [
    'agent/MCP server/skill scanning',
    'Detect suspicious AI agents activities on GitHub',
    'latest version `0.0.1`',
    'AI-agent activity scanner package category pressure',
    'AI infra guardrail',
    'agentic workflow scanner',
    'tool permission',
    'agent-security-scanner-mcp',
    'package-distribution',
    'agent/MCP scanner category pressure',
    'state mismatch',
    'trusted redirect URI',
    'authorization',
    'least privilege',
    'explicit user consent',
    'token passthrough',
    'Security Best Practices',
    'SARIF artifact',
    'source-of-record',
    'approval gate',
    'unknown company problem',
    'Korean-first rollout approval',
    '401 Invalid authentication credentials',
    'insane-search evidence',
    'HTTP 403',
    'Public registry metadata returned 200',
    'latest version `4.4.12`',
    'category-pressure evidence',
  ] as const) {
    expectLiteral(ledgerDoc, term)
  }
})

test('AX public scanner signal refresh ledger cites public sources and keeps borrow avoid action rows', () => {
  const ledgerDoc = readLedgerDoc()

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(ledgerDoc, publicReferenceUrl)
  }

  assert.match(ledgerDoc, /Borrow/i)
  assert.match(ledgerDoc, /Avoid/i)
  assert.match(ledgerDoc, /AgentGuard action/i)
})

test('AX public scanner signal refresh ledger uses exact fixture-backed commands with existing inputs', () => {
  const ledgerDoc = readLedgerDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(ledgerDoc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(ledgerDoc, fixturePath)
    }
  }

  for (const evidenceSurface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact', 'smoke manifest'] as const) {
    expectLiteral(ledgerDoc, evidenceSurface)
  }
})

test('AX public scanner signal refresh ledger states smoke expectations for each evidence lane', () => {
  const ledgerDoc = readLedgerDoc()

  assert.match(ledgerDoc, /^## Smoke expectation contract$/m)
  for (const expectation of [
    'Expected exit: `1`',
    'Expected exit: `0`',
    'Expected verdict: `REVIEW`',
    'Expected verdict: `BLOCK`',
    'Expected artifact: `.agentguard-demo/public-scanner-signal-refresh.sarif`',
    'Expected artifact: `.agentguard-demo/ax-evidence-smoke/manifest.json`',
    'Expected manifest fields: `schemaVersion`, `gitCommitSha`, `sourceSha256`, `artifactSha256`, `summary`, `checks[]`',
    'Expected source-of-record rule: rerun before handoff if source fixture, artifact, build output, or evidence directory changes',
  ] as const) {
    expectLiteral(ledgerDoc, expectation)
  }

  for (const rowLabel of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact', 'smoke manifest'] as const) {
    assert.match(
      ledgerDoc,
      new RegExp(`\\|\\s*${escapeRegExp(rowLabel)}\\s*\\|[^\\n]+Expected (?:exit|command)`),
      `${rowLabel} should have a smoke expectation table row`,
    )
  }
})

test('AX public scanner signal refresh ledger preserves English-compatible machine contracts', () => {
  const ledgerDoc = readLedgerDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    '--policy',
    '--sarif',
    '--out',
    'rule IDs',
    'generic-secret-assignment',
    'denied-command',
    'mcp-filesystem-wide-root',
    'mcp-env-token',
    'JSON',
    'SARIF',
    'schemaVersion',
    'gitCommitSha',
    'sourceSha256',
    'artifactSha256',
    'ruleId',
    'locations',
  ] as const) {
    expectLiteral(ledgerDoc, contract)
  }

  assert.doesNotMatch(ledgerDoc, /(?:CLI|명령어|rule IDs?|룰 ID|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX public scanner signal refresh ledger rejects unsupported adoption certification parity runtime and platform claims', () => {
  const ledgerDoc = readLedgerDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(ledgerDoc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 SOC 2 공식 인증을 받은 제품입니다.',
    'AgentGuard는 OWASP 공식 인증을 받은 제품입니다.',
    'AgentGuard는 OWASP에 의해 검증이 완료되었습니다.',
    'AgentGuard is certified for MCP conformance.',
    'AgentGuard has official public approval from GitHub.',
    'AgentGuard는 Snyk agent-scan 대체 parity 도구입니다.',
    'AgentGuard는 Snyk agent-scan 호환 도구입니다.',
    'AgentGuard has scanner ecosystem equivalence.',
    'AgentGuard offers complete AI red-team platform coverage.',
    'AgentGuard guarantees runtime OAuth authorization enforcement.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
