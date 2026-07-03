import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const manifestPath = join(repoRoot, 'docs', 'ax-evidence-bundle-manifest.md')

const fixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
  'examples/agentguard.sarif',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
] as const

const publicReferences = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/snyk/agent-scan',
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

test('AX evidence bundle manifest exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(manifestPath), 'docs/ax-evidence-bundle-manifest.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX evidence bundle manifest\]\(docs\/ax-evidence-bundle-manifest\.md\)/)
  assert.match(examplesDoc, /\[AX evidence bundle manifest\]\(ax-evidence-bundle-manifest\.md\)/)
})

test('AX evidence bundle manifest documents the required submission bundle sections', () => {
  const manifest = readManifest()

  for (const heading of [
    '## 사용 목적',
    '## Bundle contents',
    '## Fixture-backed commands',
    '## Expected verdicts and artifacts',
    '## Public reference borrow/avoid notes',
    '## Non-claim guardrails',
  ] as const) {
    assert.match(manifest, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    'AX 인재전쟁',
    'real AI talent',
    'onsite evidence',
    'PR diff',
    'MCP config',
    'transcript/log',
    'SARIF',
    'review handoff',
    'rollout controls',
  ] as const) {
    assert.ok(manifest.includes(term), `${term} should be present`)
  }
})

test('AX evidence bundle manifest maps exact existing fixtures and commands', () => {
  const manifest = readManifest()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    assert.ok(manifest.includes(fixturePath), `${fixturePath} should be documented`)
  }

  for (const command of exactCommands) {
    assert.ok(manifest.includes(command), `${command} should be documented exactly`)
  }

  for (const expected of [
    'BLOCK',
    'REVIEW',
    'PASS',
    'examples/agentguard.sarif',
    '.agentguard-demo/agentguard.sarif',
    'Markdown report',
    'approval note',
  ]) {
    assert.ok(manifest.includes(expected), `${expected} should be documented`)
  }
})

test('AX evidence bundle manifest cites public references with borrow and avoid guidance', () => {
  const manifest = readManifest()

  for (const reference of publicReferences) {
    assert.ok(manifest.includes(reference), `${reference} should be cited`)
  }

  assert.match(manifest, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*Manifest use\s*\|/)
  assert.match(manifest, /Borrow|빌릴 점/)
  assert.match(manifest, /Avoid|피할 점/)
})

test('AX evidence bundle manifest preserves machine contracts and bans unsupported claims', () => {
  const manifest = readManifest()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'SARIF',
    'JSON',
    'CLI',
  ] as const) {
    assert.ok(manifest.includes(contract), `${contract} should stay documented`)
  }

  assert.doesNotMatch(manifest, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(manifest, /(?:OWASP|GitHub|Snyk|AX)[^\n|.]{0,80}(?:공식\s*인증|인증\s*완료|검증\s*완료|certified|verified|approved)/i)
  assert.doesNotMatch(manifest, /(?:GitHub\s+security\s+products?|Snyk|agent-scan)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(manifest, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security|threat)\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(manifest, /(?:CLI|rule ID|machine field)[^\n]*(?:한국어로|한글로|번역|변경|바뀜)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
