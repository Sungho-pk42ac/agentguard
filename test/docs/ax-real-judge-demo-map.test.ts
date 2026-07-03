import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const demoMapPath = join(repoRoot, 'docs', 'ax-real-judge-demo-map.md')

const fixturePaths = [
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'node dist/index.js scan-log < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
] as const

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://github.com/snyk/agent-scan',
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

function readDemoMap(): string {
  return readFileSync(demoMapPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX real judge demo map exists and is linked from public docs', () => {
  assert.ok(existsSync(demoMapPath), 'docs/ax-real-judge-demo-map.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX real judge demo map\]\(docs\/ax-real-judge-demo-map\.md\)/)
  assert.match(examplesDoc, /\[AX real judge demo map\]\(ax-real-judge-demo-map\.md\)/)
})

test('AX real judge demo map has required judge-facing sections', () => {
  const demoMap = readDemoMap()

  const requiredHeadings = [
    '## 사용 목적',
    '## Public references',
    '## REAL PROBLEM',
    '## REAL JUDGE',
    '## REAL OUTPUT',
    '## Exact evidence commands',
    '## Approval sentence',
    '## Forbidden claims',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(demoMap, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['한국어 우선', '대상권', 'AX 인재전쟁', 'REAL PROBLEM', 'REAL JUDGE', 'REAL OUTPUT'] as const) {
    expectLiteral(demoMap, term)
  }
})

test('AX real judge demo map cites public references without overclaiming them', () => {
  const demoMap = readDemoMap()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(demoMap, referenceUrl)
  }

  for (const term of [
    'tool misuse',
    'excessive agency',
    'sensitive data exposure',
    'least privilege',
    'consent',
    'authorization',
    'excessive scope',
    'AI agent/MCP/skill scanner',
  ] as const) {
    expectLiteral(demoMap, term)
  }
})

test('AX real judge demo map pins exact fixture-backed commands', () => {
  const demoMap = readDemoMap()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(demoMap, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(demoMap, command)
  }

  assert.match(demoMap, /승인 문장|approval sentence/i)
})

test('AX real judge demo map avoids fake adoption certification replacement and runtime claims', () => {
  const demoMap = readDemoMap()

  assert.doesNotMatch(demoMap, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(
    demoMap,
    /(?:OWASP|MCP|Snyk|조코딩)[^\n|.]{0,80}(?:공식\s*(?:인증|검증|승인|보증)|(?:인증|검증|승인|보증)(?:을\s*)?(?:받았|받은|완료|했다|했습니다|함|했음|였음|적임)|certified|verified|approved|endorsed)/i,
  )
  assert.doesNotMatch(demoMap, /(?:Snyk|GitHub\s+security\s+products?)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
  assert.doesNotMatch(demoMap, /(?:replace|replaces|대체|대신한다|우위)[^\n|.]{0,160}(?:Snyk|scanner|platform|플랫폼|tool)/i)
  assert.doesNotMatch(
    demoMap,
    /AgentGuard[^\n]{0,120}(?:MCP\s*서버\s*실행|런타임\s*제어|MCP runtime|runtime controls)[^\n]{0,120}(?:강제합니다|강제함|강제했다|직접\s*차단합니다|직접\s*차단함|대신\s*수행합니다|대신\s*수행함|executes|enforces)/i,
  )
  assert.doesNotMatch(
    demoMap,
    /(?:gated\s+portal|final\s+company\s+problem|최종\s*기업\s*문제|포탈)[^\n|.]{0,160}(?:confirmed|확정(?:됐|되었|입니다)|알고\s*(?:있습니다|있음)|파악(?:했|됨))/i,
  )
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
