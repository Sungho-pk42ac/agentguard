import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-smoke-provenance-quickcheck.md')

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://vercel.com/docs/cli',
] as const

const requiredManifestFields = [
  'repositoryUrl',
  'gitCommitSha',
  'gitBranch',
  'gitTreeState',
  'manifestPath',
  'requiredArtifacts',
  'sourceSha256',
  'artifactSha256',
  'evidenceDirectory',
  'producerIntent',
] as const

const requiredRunnerRuntimeFields = [
  'runId',
  'startedAt',
  'completedAt',
  'generatedAt',
  'durationMs',
  'nodeVersion',
  'platform',
  'arch',
  'replayCommandArgs',
  'freshCloneSetup',
] as const

const exactCommands = [
  'npm run build',
  'npm run smoke:ax-demo',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-smoke-provenance/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
] as const

const fixturePaths = [
  'scripts/ax-demo-smoke.mjs',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
  'examples/agent-policy.yaml',
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

test('AX smoke provenance quickcheck exists and is linked from examples docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-smoke-provenance-quickcheck.md should exist')

  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')
  assert.match(examplesDoc, /\[AX smoke provenance quickcheck\]\(ax-smoke-provenance-quickcheck\.md\)/)
})

test('AX smoke provenance quickcheck documents exact replay commands and manifest fields', () => {
  const card = readCard()

  for (const command of exactCommands) expectLiteral(card, command)
  for (const field of requiredManifestFields) expectLiteral(card, field)
  for (const field of requiredRunnerRuntimeFields) expectLiteral(card, field)

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(card, fixturePath)
  }

  for (const term of ['한국어 우선', 'source-of-record', 'reviewer', '30초', 'clean', 'dirty', 'PASS', 'REVIEW', 'BLOCK'] as const) {
    expectLiteral(card, term)
  }
})

test('AX smoke provenance quickcheck keeps public references and non-claim guardrails explicit', () => {
  const card = readCard()

  for (const url of publicReferenceUrls) expectLiteral(card, url)
  for (const heading of ['Borrow', 'Avoid', 'AgentGuard action'] as const) expectLiteral(card, heading)

  const claimSurface = card
    .split('\n')
    .filter((line) => !/non-claim|boundary|not approval|Avoid|대체|도입|certification/i.test(line))
    .join('\n')
  assert.doesNotMatch(
    claimSurface,
    /인증\s*획득|공식\s*인증|고객\s*도입|Snyk\s*대체|GitHub\s*대체|runtime\s+authorization\s+enforcement/i,
  )
  assert.match(card, /not approval, automatic upload, certification, scanner parity, or runtime authorization\/session enforcement/)
})
