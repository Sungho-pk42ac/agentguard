import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const deltaWatchDocPath = join(repoRoot, 'docs', 'ax-public-reference-delta-watch.md')

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-reference-delta-watch.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const referencedPaths = [
  'README.md',
  'docs/examples.md',
  'examples/risky-mcp.json',
  'examples/risky-pr.diff',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객(?:사)?|실고객|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption|customer adoption|enterprise clients?|production case stud(?:y|ies)|active users?/i,
  /SOC\s*2|ISO[-\s]*27001|공식\s*인증|certified|certification|conformance|compliant|compliance/i,
  /(?:OWASP|MCP|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar)[^\n|]{0,120}(?:검증\s*완료|인증\s*완료|approved|verified|endorsed)/i,
  /(?:agent-scan|AI-Infra-Guard|agentic-radar|public scanners?|scanner ecosystem)[^\n|]{0,120}(?:대체|replacement|parity|동등|equivalence|equivalent)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:(?:red[-\s]?team|security|보안)\s+)?(?:platform|coverage|플랫폼|커버리지)/i,
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

function readDeltaWatchDoc(): string {
  return readFileSync(deltaWatchDocPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX public-reference delta watch doc exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(deltaWatchDocPath), 'docs/ax-public-reference-delta-watch.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public-reference delta watch\]\(docs\/ax-public-reference-delta-watch\.md\)/)
  assert.match(examplesDoc, /\[AX public-reference delta watch\]\(ax-public-reference-delta-watch\.md\)/)
})

test('AX public-reference delta watch cites fresh public signals with borrow avoid action and evidence columns', () => {
  const deltaWatchDoc = readDeltaWatchDoc()

  assert.match(deltaWatchDoc, /^# AX public-reference delta watch/m)
  assert.match(deltaWatchDoc, /한국어 우선/)
  assert.match(
    deltaWatchDoc,
    /\|\s*Public reference signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|\s*Evidence command\s*\|/,
  )

  for (const publicReferenceUrl of publicReferenceUrls) {
    expectLiteral(deltaWatchDoc, publicReferenceUrl)
  }

  for (const term of [
    'company problem',
    'tool misuse',
    'excessive agency',
    'mitigation',
    'permission',
    'token',
    'authorization',
    'Korean-first rollout approval',
    'SARIF artifact handoff',
    'code-scanning reviewer',
    '대상권',
  ] as const) {
    assert.match(deltaWatchDoc, new RegExp(escapeRegExp(term), 'i'))
  }
})

test('AX public-reference delta watch uses exact fixture-backed commands with existing inputs', () => {
  const deltaWatchDoc = readDeltaWatchDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(deltaWatchDoc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(deltaWatchDoc, fixturePath)
    }
  }

  for (const referencedPath of referencedPaths) {
    assert.ok(existsSync(join(repoRoot, referencedPath)), `${referencedPath} should exist`)
    expectLiteral(deltaWatchDoc, referencedPath)
  }
})

test('AX public-reference delta watch preserves English-compatible machine contracts', () => {
  const deltaWatchDoc = readDeltaWatchDoc()

  for (const contract of [
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'agentguard scan-log',
    'rule IDs',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
    'generic-secret-assignment',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
  ] as const) {
    expectLiteral(deltaWatchDoc, contract)
  }

  assert.doesNotMatch(deltaWatchDoc, /(?:agentguard\s+scan-mcp|agentguard\s+scan-diff|agentguard\s+scan-log)[^\r\n]*(?:한국어로|한글로|번역|바뀜)/i)
  assert.doesNotMatch(deltaWatchDoc, /(?:rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|바뀜)/i)
})

test('AX public-reference delta watch rejects unsupported adoption certification and parity claims', () => {
  const deltaWatchDoc = readDeltaWatchDoc()

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(deltaWatchDoc, forbiddenClaimPattern)
  }

  const forbiddenExamples = [
    'AgentGuard는 실제 고객사 도입 완료 사례입니다.',
    'AgentGuard는 OWASP 공식 인증을 받은 제품입니다.',
    'AgentGuard is certified for MCP conformance.',
    'AgentGuard is ISO-27001 compliant.',
    'AgentGuard has enterprise clients and a production case study.',
    'AgentGuard has active users in production.',
    'AgentGuard는 Snyk agent-scan 대체 parity 도구입니다.',
    'AgentGuard has scanner ecosystem equivalence.',
    'AgentGuard offers complete AI red-team platform coverage.',
  ] as const

  for (const forbiddenExample of forbiddenExamples) {
    assert.ok(
      forbiddenClaimPatterns.some((forbiddenClaimPattern) => forbiddenClaimPattern.test(forbiddenExample)),
      `${forbiddenExample} should be rejected by a forbidden-claim pattern`,
    )
  }
})
