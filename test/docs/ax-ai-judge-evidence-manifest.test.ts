import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const manifestPath = join(repoRoot, 'docs', 'ax-ai-judge-evidence-manifest.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixtures: ['examples/risky-mcp.json'],
    expectedVerdict: 'Expected verdict: `BLOCK` or `REVIEW`',
  },
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
    expectedVerdict: 'Expected verdict: `REVIEW` or `BLOCK`',
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/agent-transcript.log'],
    expectedVerdict: 'Expected verdict: `REVIEW`',
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-ai-judge-evidence/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
    expectedVerdict: 'Expected artifact: `.agentguard-demo/ax-ai-judge-evidence/agentguard.sarif`',
  },
] as const

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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

function readManifest(): string {
  return readFileSync(manifestPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX AI judge evidence manifest exists and is linked from public docs', () => {
  assert.ok(existsSync(manifestPath), 'docs/ax-ai-judge-evidence-manifest.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX AI judge evidence manifest\]\(docs\/ax-ai-judge-evidence-manifest\.md\)/)
  assert.match(examplesReadme, /\[AX AI judge evidence manifest\]\(\.\.\/docs\/ax-ai-judge-evidence-manifest\.md\)/)
  assert.match(examplesDoc, /\[AX AI judge evidence manifest\]\(ax-ai-judge-evidence-manifest\.md\)/)
})

test('AX AI judge evidence manifest is Korean-first with required sections and judge manifest rows', () => {
  const manifest = readManifest()

  const requiredHeadings = [
    '# AX AI judge evidence manifest',
    '## 사용 목적',
    '## AI/prelim judge manifest',
    '## Fixture-backed evidence commands',
    '## Public reference borrow/avoid/action table',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(manifest, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    'AI preliminary judge',
    '예비 심사',
    '회사 문제',
    '증거 manifest',
    'source-of-record',
    'synthetic fixture',
    'PR diff',
    'MCP config',
    'transcript/log',
    'SARIF',
  ] as const) {
    expectLiteral(manifest, term)
  }

  assert.match(manifest, /\|\s*Judge row\s*\|\s*Surface\s*\|\s*Exact command\s*\|\s*Fixture\s*\|\s*Expected evidence\s*\|\s*Judge action\s*\|/)
  for (const rowName of ['MCP permission preflight', 'PR diff risk preflight', 'Transcript policy preflight', 'SARIF reviewer handoff'] as const) {
    expectLiteral(manifest, rowName)
  }
})

test('AX AI judge evidence manifest uses exact existing fixture-backed commands', () => {
  const manifest = readManifest()

  for (const { command, fixtures, expectedVerdict } of fixtureBackedCommands) {
    expectLiteral(manifest, command)
    expectLiteral(manifest, expectedVerdict)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(manifest, fixturePath)
    }
  }

  assert.ok(existsSync(join(repoRoot, 'examples', 'agentguard.sarif')), 'examples/agentguard.sarif should exist')
  expectLiteral(manifest, 'examples/agentguard.sarif')
})

test('AX AI judge evidence manifest cites public references with borrow avoid and action rows', () => {
  const manifest = readManifest()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(manifest, referenceUrl)
  }

  assert.match(manifest, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(manifest, /AX 인재전쟁/)
  assert.match(manifest, /OWASP Agentic AI threats/)
  assert.match(manifest, /MCP Security Best Practices/)
  assert.match(manifest, /GitHub SARIF upload/)
})

test('AX AI judge evidence manifest preserves machine contracts', () => {
  const manifest = readManifest()

  for (const contractTerm of [
    'agentguard scan-mcp',
    'agentguard scan-diff',
    'agentguard scan-log',
    'node dist/index.js',
    'CLI',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'no scanner behavior change',
    'no verdict policy change',
    'no default severity change',
    'mcp.broad_filesystem_access',
    'mcp.filesystem_writable_path',
    'generic-secret-assignment',
  ] as const) {
    expectLiteral(manifest, contractTerm)
  }

  assert.doesNotMatch(manifest, /(?:CLI|rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|renamed?)/i)
})

test('AX AI judge evidence manifest bans unsupported claims and gated-detail certainty', () => {
  const manifest = readManifest()

  assert.doesNotMatch(manifest, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(manifest, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(manifest, /(?:OWASP|MCP|GitHub|SARIF|AX)[^\r\n|.]{0,100}(?:endorsed|validated|approved|verified|공식\s*검증|검증\s*완료|인증\s*완료)/i)
  assert.doesNotMatch(manifest, /(?:replacement|parity|대체|동등)[^\r\n|.]{0,100}(?:GitHub|SARIF|OWASP|MCP|보안 제품|security product)/i)
  assert.doesNotMatch(manifest, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security|threat|platform|coverage|보안|커버리지|플랫폼)/i)
  assert.doesNotMatch(manifest, /(?:hidden|gated|final)\s+(?:portal|rubric|scoring|submission)[^\r\n|.]{0,100}(?:known|confirmed|guaranteed|확정|보장)/i)
  assert.doesNotMatch(manifest, /AgentGuard\s+(?:enforces|implements|provides|delivers)[^.\n|]{0,100}(?:runtime OAuth|runtime authorization|session control|consent UI|runtime MCP)/i)
  assert.doesNotMatch(manifest, /GitHub[^.\n|]{0,100}(?:upload|approval|code scanning)[^.\n|]{0,100}automatic/i)
})
