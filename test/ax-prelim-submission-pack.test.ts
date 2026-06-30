import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const submissionPackPath = join(repoRoot, 'docs', 'ax-prelim-submission-pack.md')
const commerceScenarioRoot = join(repoRoot, 'examples', 'enterprise-scenarios', 'commerce-voc-agent')
const smokeFixturePaths = [
  join(commerceScenarioRoot, 'risky-pr.diff'),
  join(commerceScenarioRoot, 'risky-mcp.json'),
  join(commerceScenarioRoot, 'agent-transcript.log'),
  join(repoRoot, 'examples', 'agent-policy.yaml'),
] as const
const forbiddenClaimPatterns = [
  /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i,
  /(?:OWASP|MCP)[^\n|.]{0,50}(?:공식\s*인증|인증\s*완료|인증을\s*받은|검증\s*완료)/i,
  /(?:SOC\s*2|ISO\s*27001)[^\n|.]{0,50}(?:인증(?:\s*완료)?|준수(?:\s*완료)?|certified|compliant|verified)/i,
  /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team\s+)?(?:platform|플랫폼|coverage|conformance|준수|커버리지)/i,
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    const hasPackage = existsSync(join(currentDir, 'package.json'))
    const hasDocs = existsSync(join(currentDir, 'docs'))
    const hasTests = existsSync(join(currentDir, 'test'))
    if (hasPackage && hasDocs && hasTests) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

function readSubmissionPack(): string {
  return readFileSync(submissionPackPath, 'utf8')
}

test('AX prelim submission pack exists and is linked from the root README docs list', () => {
  assert.ok(existsSync(submissionPackPath), 'docs/ax-prelim-submission-pack.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX prelim submission pack\]\(docs\/ax-prelim-submission-pack\.md\)/)
})

test('AX prelim submission pack covers reviewer-readable prelim submission sections', () => {
  const submissionPack = readSubmissionPack()

  const requiredHeadings = [
    '## 한 문장 문제 정의',
    '## 예선 제출 요약',
    '## Smoke/demo commands',
    '## 30초 데모 스크립트',
    '## 한계와 non-claims',
    '## Public reference signals',
    '## Existing evidence links',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(submissionPack, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX prelim submission pack preserves implemented AgentGuard commands and evidence terms', () => {
  const submissionPack = readSubmissionPack()

  for (const fixturePath of smokeFixturePaths) {
    assert.ok(existsSync(fixturePath), `${fixturePath} should exist for copy-paste smoke commands`)
  }

  const requiredTerms = [
    'AX Rollout Guard',
    '예선 제출',
    'prelim',
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'SARIF',
    'BLOCK',
    'PASS',
  ] as const

  for (const term of requiredTerms) {
    assert.match(submissionPack, new RegExp(escapeRegExp(term)))
  }
})

test('AX prelim submission pack links existing AX docs and public references without unsupported claims', () => {
  const submissionPack = readSubmissionPack()

  const requiredLinks = [
    'docs/ax-company-problem-intake-kit.md',
    'docs/ax-demo-scenario-matrix.md',
    'docs/ax-competitive-comparison.md',
    'https://hackathon.jocodingax.ai/',
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
    'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
    'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
    'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  ] as const

  for (const link of requiredLinks) {
    assert.match(submissionPack, new RegExp(escapeRegExp(link)))
  }

  assert.match(submissionPack, /secret exposure/i)
  assert.match(submissionPack, /tool misuse/i)
  assert.match(submissionPack, /excessive agency/i)

  for (const forbiddenClaimPattern of forbiddenClaimPatterns) {
    assert.doesNotMatch(submissionPack, forbiddenClaimPattern)
  }
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
