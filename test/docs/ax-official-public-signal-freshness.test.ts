import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const freshnessDocPath = join(repoRoot, 'docs', 'ax-official-public-signal-freshness.md')

const requiredUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://hack.primer.kr/',
  'https://genai.owasp.org/llm-top-10/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

const fixtureBackedCommands = [
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-official-public-signal-freshness.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'] as const,
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'] as const,
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml --json < examples/approval-required-review.jsonl',
    fixtures: ['examples/agent-policy.yaml', 'examples/approval-required-review.jsonl'] as const,
  },
] as const

const requiredHeadings = [
  '# AX official public-signal freshness',
  '## Public-confirmed vs gated-unverified',
  '## Borrow / Avoid / AgentGuard action',
  '## 30-second judge script',
  '## Exact fixture-backed command queue',
  '## Machine-contract boundary',
  '## Gated checklist before final submission',
  '## Honest limits',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance/i,
  /^(?=.*(?:OWASP|MCP|GitHub|SARIF|AX))(?=.*(?:검증\s*완료|인증\s*완료|approved|(?<!un)verified|endorsed)).*$/im,
  /^(?=.*(?:Snyk|agent-scan|AI-Infra-Guard|agentic-radar|public scanners?|scanner ecosystem))(?=.*(?:대체|replacement|parity|동등|equivalence|equivalent)).*$/im,
  /^(?=.*(?:gated|portal|hack\.primer\.kr))(?=.*(?:\b(?<!un)verified\b|확인\s+완료|검증\s*완료)).*$/im,
  /^(?=.*(?:runtime|live))(?=.*(?:OAuth|state mismatch|session))(?=.*(?:enforce|prevent\w*|차단|방지|검증)).*$/im,
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

function readFreshnessDoc(): string {
  return readFileSync(freshnessDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX official public-signal freshness doc exists and is linked from entrypoints', () => {
  assert.ok(existsSync(freshnessDocPath), 'docs/ax-official-public-signal-freshness.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX official public-signal freshness\]\(docs\/ax-official-public-signal-freshness\.md\)/)
  assert.match(examplesDoc, /\[AX official public-signal freshness\]\(ax-official-public-signal-freshness\.md\)/)
})

test('AX official public-signal freshness separates confirmed public signals from gated unknowns', () => {
  const freshnessDoc = readFreshnessDoc()

  for (const heading of requiredHeadings) {
    expectLiteral(freshnessDoc, heading)
  }

  for (const requiredUrl of requiredUrls) {
    expectLiteral(freshnessDoc, requiredUrl)
  }

  for (const phrase of [
    'publicly confirmed',
    'gated portal',
    'AI preliminary judge + human review',
    'company practitioner review',
    '현업에서 통하는가',
    'gated portal',
    'unverified',
  ] as const) {
    assert.match(freshnessDoc, new RegExp(escapeRegExp(phrase), 'i'))
  }
})

test('AX official public-signal freshness uses exact fixture-backed commands with existing inputs', () => {
  const freshnessDoc = readFreshnessDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(freshnessDoc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(freshnessDoc, fixturePath)
    }
  }
})

test('AX official public-signal freshness preserves English-compatible machine contracts', () => {
  const freshnessDoc = readFreshnessDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    '--sarif',
    '--out',
    '--policy',
    '--json',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON',
    'SARIF',
    'API',
    'rule IDs',
    'machine fields',
  ] as const) {
    expectLiteral(freshnessDoc, contract)
  }

  assert.doesNotMatch(freshnessDoc, /(?:agentguard\s+scan-diff|agentguard\s+scan-mcp|agentguard\s+scan-log)[^\r\n]*(?:한국어로|한글로|번역|바뀜)/i)
  assert.doesNotMatch(freshnessDoc, /(?:PASS|REVIEW|BLOCK|JSON|SARIF|API|rule IDs?|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|바뀜)/i)
})

test('AX official public-signal freshness rejects fake claims and runtime enforcement overreach', () => {
  const freshnessDoc = readFreshnessDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(freshnessDoc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 OWASP 공식 인증을 받은 제품입니다.',
    'AgentGuard is certified for MCP conformance.',
    'AgentGuard has enterprise clients and a production case study.',
    'AgentGuard는 Snyk agent-scan 대체 parity 도구입니다.',
    'The hack.primer.kr gated portal rubric was verified.',
    'We verified the gated portal information.',
    'AgentGuard provides runtime OAuth state mismatch prevention.',
    'AgentGuard prevents OAuth state mismatch at runtime.',
    'This tool achieves parity with Snyk agent-scan.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
