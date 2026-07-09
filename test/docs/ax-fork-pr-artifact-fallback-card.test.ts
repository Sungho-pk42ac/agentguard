import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-fork-pr-artifact-fallback-card.md')

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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/fork-pr/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/snyk/agent-scan',
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

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX fork PR artifact fallback card exists and is linked from README', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-fork-pr-artifact-fallback-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX fork PR artifact fallback card\]\(docs\/ax-fork-pr-artifact-fallback-card\.md\)/)
})

test('AX fork PR artifact fallback card documents exact fixture-backed commands', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }

  for (const surface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact generation'] as const) {
    assert.match(card, new RegExp(escapeRegExp(surface), 'i'))
  }
})

test('AX fork PR artifact fallback card states fork boundary source-of-record language', () => {
  const card = readCard()

  for (const phrase of [
    'fork PR',
    'write-token',
    'PR comment',
    'SARIF upload',
    'artifact-only fallback',
    'job summary',
    'Markdown',
    'JSON',
    'SARIF',
    'source of record',
  ] as const) {
    expectLiteral(card, phrase)
  }

  assert.match(card, /artifact-only fallback[\s\S]{0,700}source of record/i)
  assert.match(card, /job summary[\s\S]{0,700}Markdown[\s\S]{0,700}JSON[\s\S]{0,700}SARIF/i)
  assert.match(card, /PR comment[\s\S]{0,500}SARIF upload[\s\S]{0,500}(?:gated|unavailable|untrusted|fork)/i)
})

test('AX fork PR artifact fallback card cites references with borrow avoid action rows', () => {
  const card = readCard()

  let citedReferenceCount = 0
  for (const referenceUrl of publicReferenceUrls) {
    if (card.includes(referenceUrl)) citedReferenceCount += 1
  }

  assert.ok(citedReferenceCount >= 3, 'at least three public references should be cited')
  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /Borrow|빌릴 점/i)
  assert.match(card, /Avoid|피할 점/i)
  assert.match(card, /AgentGuard action|조치/i)
})

test('AX fork PR artifact fallback card keeps unsafe workflow and fake claims out', () => {
  const card = readCard()

  for (const contract of [
    'No `pull_request_target` unsafe checkout recommendation.',
    'No scanner behavior change.',
    'No CLI command, rule ID, JSON field, or SARIF field change.',
    'No GitHub Action runtime behavior change.',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:recommend|use|enable)[^.\n|]{0,80}pull_request_target[^.\n|]{0,80}checkout/i)
  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|Snyk)[^.\n|]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(card, /(?:GitHub code scanning|Snyk|agent-scan)[^.\n|]{0,80}(?:replacement|parity|대체|동등)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
