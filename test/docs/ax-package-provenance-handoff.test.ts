import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-package-provenance-handoff.md')

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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages',
  'https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file',
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

test('AX package provenance handoff exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-package-provenance-handoff.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX package provenance reviewer handoff card\]\(docs\/ax-package-provenance-handoff\.md\)/)
  assert.match(examplesDoc, /\[AX package provenance reviewer handoff card\]\(ax-package-provenance-handoff\.md\)/)
})

test('AX package provenance handoff is Korean-first with reviewer sections', () => {
  const doc = readDoc()
  const requiredHeadings = [
    '## 사용 목적',
    '## Fresh clone/package readiness story',
    '## Fixture-backed evidence commands',
    '## Reviewer handoff table',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const

  assert.match(doc, /^# AX package provenance reviewer handoff card/m)
  assert.match(doc, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX package provenance handoff uses exact fixture-backed commands for every evidence surface', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const requiredTerm of ['PR diff', 'MCP config', 'transcript/log', 'SARIF artifact', 'reviewer handoff']) {
    expectLiteral(doc, requiredTerm)
  }
})

test('AX package provenance handoff cites public references with borrow avoid action framing', () => {
  const doc = readDoc()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /OWASP Agentic AI threats and mitigations/)
  assert.match(doc, /MCP Security Best Practices/)
  assert.match(doc, /GitHub Node\.js package publishing/)
  assert.match(doc, /GitHub SARIF upload/)
  assert.match(doc, /least privilege|token passthrough|confused deputy|SSRF|session|tool risk/i)
})

test('AX package provenance handoff preserves machine contracts and bans fake claims', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
    'generic-secret-assignment',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.doesNotMatch(doc, /(?:CLI commands?|rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(doc, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub)[^\r\n|.]{0,100}(?:endorsed|validated|approved|공식\s*검증|검증\s*완료|인증\s*완료)/i)
  assert.doesNotMatch(doc, /(?:npm|package|provenance|publish)[^\r\n|.]{0,100}(?:published|publishing configured|provenance enabled|배포\s*완료|게시\s*완료)/i)
  assert.doesNotMatch(doc, /AgentGuard\s+(?:enforces|implements|provides|delivers)[^.\n|]{0,100}(?:runtime MCP|runtime authorization|session control|consent UI)/i)
  assert.doesNotMatch(doc, /GitHub[^.\n|]{0,100}(?:SARIF|upload|code scanning)[^.\n|]{0,100}automatic/i)
  assert.doesNotMatch(doc, /(?:full|complete|전체)\s+(?:agentic|AI|MCP)?\s*(?:threat|security|보안)\s+(?:coverage|platform|커버리지|플랫폼)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
