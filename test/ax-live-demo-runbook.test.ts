import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const runbookPath = join(repoRoot, 'docs', 'ax-live-demo-runbook.md')
const requiredFixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-transcript.log',
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

function readRunbook(): string {
  return readFileSync(runbookPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX live demo runbook exists and is linked from both root READMEs', () => {
  assert.ok(existsSync(runbookPath), 'docs/ax-live-demo-runbook.md should exist')

  const koreanReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const englishReadme = readFileSync(join(repoRoot, 'README.en.md'), 'utf8')

  assert.match(koreanReadme, /\[AX live demo runbook\]\(docs\/ax-live-demo-runbook\.md\)/)
  assert.match(englishReadme, /\[AX live demo runbook\]\(docs\/ax-live-demo-runbook\.md\)/)
})

test('AX live demo runbook has Korean-first demo operation sections', () => {
  const runbook = readRunbook()
  const requiredHeadings = [
    '## 준비 / Setup',
    '## 30초 토크 트랙',
    '## 시나리오 선택',
    '## 정확한 실행 명령',
    '## 예상 BLOCK/REVIEW evidence',
    '## 정리 / Cleanup',
    '## 하지 않는 주장 / Non-claims',
    '## 공개 참고 자료',
    '## 다음 현장 adaptation step',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(runbook, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['회사 문제', 'agent/tool surface', 'risk evidence', 'BLOCK', '수정/정책/PASS'] as const) {
    expectLiteral(runbook, term)
  }
})

test('AX live demo runbook commands use existing fixtures and implemented CLI surfaces', () => {
  const runbook = readRunbook()

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(runbook, fixturePath)
  }

  const requiredCommands = [
    'npm run build',
    'mkdir -p .agentguard-demo',
    'node dist/index.js scan-diff < examples/risky-pr.diff',
    'node dist/index.js scan-mcp < examples/risky-mcp.json',
    'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    'rm -rf .agentguard-demo',
  ] as const

  for (const command of requiredCommands) {
    expectLiteral(runbook, command)
  }

  assert.match(runbook, /판정:\s*BLOCK|Verdict:\s*BLOCK/)
  assert.match(runbook, /판정:\s*REVIEW|Verdict:\s*REVIEW/)
  assert.match(runbook, /SARIF/)
})

test('AX live demo runbook cites public references without unsupported claims', () => {
  const runbook = readRunbook()
  const requiredUrls = [
    'https://hackathon.jocodingax.ai/',
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
    'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
    'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
    'https://github.com/snyk/agent-scan',
    'https://github.com/Tencent/AI-Infra-Guard',
    'https://github.com/splx-ai/agentic-radar',
  ] as const

  for (const url of requiredUrls) {
    expectLiteral(runbook, url)
  }

  assert.doesNotMatch(runbook, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(runbook, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(runbook, /(?:full|complete|전체)\s+(?:platform|red[-\s]?team|coverage|커버리지|플랫폼)/i)
  assert.doesNotMatch(runbook, /GitHub\s+security\s+products?\s+replacement/i)
  assert.doesNotMatch(runbook, /OWASP\s+(?:certified|verified|approved)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
