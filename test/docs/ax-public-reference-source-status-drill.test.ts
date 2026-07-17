import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-public-reference-source-status-drill.md')

const requiredHeadings = [
  '# AX public-reference source-status drill',
  '## 사용 목적',
  '## Source-status decision table',
  '## Exact fixture-backed evidence commands',
  '## Public references used by this drill',
  '## Reviewer handoff script',
  '## Machine-contract boundaries',
  '## Non-claim guardrails',
] as const

const sourceStatuses = [
  'HTTP 200 public page',
  '403/WAF page',
  'public registry fallback',
  'auth/login boundary',
  'stale reference',
] as const

const publicReferenceUrls = [
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  'https://genai.owasp.org/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://registry.npmjs.org/agent-scan',
] as const

const evidenceCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-source-status-drill.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  },
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

test('AX public-reference source-status drill exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(docPath), 'docs/ax-public-reference-source-status-drill.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX public-reference source-status drill\]\(docs\/ax-public-reference-source-status-drill\.md\)/)
  assert.match(examplesDoc, /\[AX public-reference source-status drill\]\(ax-public-reference-source-status-drill\.md\)/)
})

test('AX public-reference source-status drill is Korean-first and covers required status rows', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const status of sourceStatuses) {
    expectLiteral(doc, status)
  }

  for (const term of [
    '한국어 우선',
    'source-of-record',
    'public reference',
    '출처 상태(source status)',
    '환경에서 본문 미확인',
    'residual risk',
    'insane-search evidence',
    'fresh clone',
    'npm run smoke:ax-demo',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX public-reference source-status drill pins references commands and fixtures', () => {
  const doc = readDoc()

  for (const url of publicReferenceUrls) {
    expectLiteral(doc, url)
  }

  for (const { command, fixture } of evidenceCommands) {
    expectLiteral(doc, command)
    expectLiteral(doc, fixture)
    assert.ok(existsSync(join(repoRoot, fixture)), `${fixture} should exist`)
  }

  for (const term of [
    '.agentguard-demo/public-reference-source-status-drill.sarif',
    'PASS',
    'REVIEW',
    'BLOCK',
    'generic-secret-assignment',
    'denied-command',
    'mcp-filesystem-wide-root',
    'mcp-env-token',
    'ruleId',
    'locations',
    'schemaVersion',
    'artifactSha256',
    'gitCommitSha',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX public-reference source-status drill keeps fake-claim guardrails explicit', () => {
  const doc = readDoc()

  for (const forbiddenClaimBoundary of [
    'not implementation proof',
    'not maturity, popularity, or customer evidence',
    'does not claim hosted monitoring',
    'does not claim private portal access',
    'does not claim hosted monitoring, does not claim private portal access, does not claim runtime OAuth controls, does not claim live MCP consent enforcement, does not claim automatic SARIF upload, and does not claim replacement',
  ] as const) {
    expectLiteral(doc, forbiddenClaimBoundary)
  }

  assert.doesNotMatch(doc, /AgentGuard (is|provides|guarantees).{0,80}(certified|endorsed|vendor parity|automatic SARIF upload)/i)
  assert.doesNotMatch(doc, /registry metadata.{0,80}(proves|guarantees).{0,80}(adoption|popularity|maturity|customer)/i)
  assert.doesNotMatch(doc, /runtime MCP.{0,80}(enforced|guaranteed|solved)/i)
})
