import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-evidence-expiry-revalidation-card.md')

const requiredFixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-transcript.log',
  'examples/agent-policy.yaml',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
] as const

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://raw.githubusercontent.com/snyk/agent-scan/main/README.md',
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

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX evidence expiry revalidation card exists and is linked from the root README', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-evidence-expiry-revalidation-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX evidence expiry revalidation card\]\(docs\/ax-evidence-expiry-revalidation-card\.md\)/)
})

test('AX evidence expiry revalidation card contains Korean-first expiry and rerun sections', () => {
  const card = readCard()
  const requiredHeadings = [
    '## 언제 evidence가 stale 되는가',
    '## Revalidation commands',
    '## SARIF handoff evidence',
    '## Machine-contract boundaries',
    '## Public reference borrow/avoid/action notes',
    '## Non-claim guardrails',
  ] as const

  assert.match(card, /^# AX evidence expiry revalidation card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['회사 문제 변경', 'tool permission', 'secret', 'control', 'rerun', 'artifact hash/path'] as const) {
    expectLiteral(card, term)
  }
})

test('AX evidence expiry revalidation card uses exact existing fixture-backed commands', () => {
  const card = readCard()

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(card, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(card, command)
  }

  expectLiteral(card, '.agentguard-demo/agentguard.sarif')
  assert.match(card, /upload workflow condition/i)
})

test('AX evidence expiry revalidation card cites public references with borrow avoid action language', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /빌릴 점|Borrow/i)
  assert.match(card, /피할 점|Avoid/i)
  assert.match(card, /AgentGuard action|조치/i)
})

test('AX evidence expiry revalidation card preserves machine contracts and output-contract caution', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'output contract/version',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.doesNotMatch(card, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|API|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX evidence expiry revalidation card bans unsupported adoption certification and parity claims', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|Snyk|GitHub)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(card, /(?:SaaS|dashboard|auth|customer data|고객\s*데이터)[^\n]*(?:available|지원|제공|운영|production)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
