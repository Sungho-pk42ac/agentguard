import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-cli-exit-semantics-card.md')

const requiredHeadings = [
  '# AX CLI exit semantics evidence card',
  '## 사용 목적',
  '## Exit semantics quick table',
  '## Exact fixture-backed commands',
  '## SARIF evidence handoff',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract boundaries',
  '## Non-claim guardrails',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-exit-semantics.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const requiredReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://vercel.com/docs/cli',
  'https://docs.snyk.io/developer-tools/snyk-cli/snyk-cli/debugging-the-snyk-cli',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  for (let depth = 0; depth < 20; depth += 1) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  throw new Error('Could not find package.json in the directory tree')
}

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX CLI exit semantics evidence card exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-cli-exit-semantics-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX CLI exit semantics evidence card\]\(docs\/ax-cli-exit-semantics-card\.md\)/)
  assert.match(examplesDoc, /\[AX CLI exit semantics evidence card\]\(ax-cli-exit-semantics-card\.md\)/)
})

test('AX CLI exit semantics evidence card keeps the required heading order', () => {
  const doc = readDoc()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const currentIndex = doc.indexOf(heading)
    assert.notEqual(currentIndex, -1, `${heading} should be present`)
    assert.ok(currentIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = currentIndex
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /AX Rollout Guard/)
})

test('AX CLI exit semantics evidence card documents exact fixture-backed commands and verdict exits', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  assert.match(doc, /`PASS`[\s\S]{0,250}`exit 0`/)
  assert.match(doc, /`REVIEW`[\s\S]{0,250}`exit 0`/)
  assert.match(doc, /`BLOCK`[\s\S]{0,250}`exit 1`/)
  assert.match(doc, /risky nonzero exit/i)
  assert.match(doc, /infrastructure\/build failure/i)
})

test('AX CLI exit semantics evidence card cites public references with borrow avoid action notes', () => {
  const doc = readDoc()

  for (const referenceUrl of requiredReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /OWASP[\s\S]{0,900}tool misuse/i)
  assert.match(doc, /MCP Security Best Practices[\s\S]{0,900}runtime enforcement/i)
  assert.match(doc, /GitHub SARIF[\s\S]{0,900}automatic upload/i)
  assert.match(doc, /Vercel CLI[\s\S]{0,900}vendor parity/i)
  assert.match(doc, /Snyk CLI[\s\S]{0,900}vendor parity/i)
})

test('AX CLI exit semantics evidence card preserves machine contracts and bans unsupported claims', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-mcp',
    'agentguard scan-log',
    'agentguard scan-diff',
    'PASS',
    'REVIEW',
    'BLOCK',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'ruleId',
    'artifactLocation.uri',
    'tool.driver.name',
    'secret.github_token',
    'mcp.broad_filesystem_access',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(doc, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Vercel|Snyk)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement|대체)/i)
  assert.doesNotMatch(doc, /AgentGuard[^\n.]{0,80}(?:automatically|자동)[^\n.]{0,80}(?:approve|승인|upload|업로드)/i)
  assert.doesNotMatch(doc, /AgentGuard[^\n.]{0,80}runtime[^\n.]{0,80}(?:enforcement|authorization|approval|consent)/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.match(doc, /No CLI behavior change/i)
  assert.match(doc, /No exit-code semantics change/i)
  assert.match(doc, /No default severity change/i)
})
