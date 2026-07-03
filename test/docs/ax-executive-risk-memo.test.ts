import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const memoPath = join(repoRoot, 'docs', 'ax-executive-risk-memo.md')

const publicReferenceSignals = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
] as const

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

function readMemo(): string {
  return readFileSync(memoPath, 'utf8')
}

test('AX executive risk memo exists and is linked from README', () => {
  assert.ok(existsSync(memoPath), 'docs/ax-executive-risk-memo.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX executive risk memo\]\(docs\/ax-executive-risk-memo\.md\)/)
})

test('AX executive risk memo is Korean-first and has the required decision headings', () => {
  const memo = readMemo()

  assert.match(memo, /^# AX executive risk memo/m)
  assert.match(memo, /한국어 우선/)

  for (const heading of [
    '## 언제 사용하나',
    '## 메모 템플릿',
    '## 증거 명령',
    '## Public reference signals',
    '## Approval wording',
    '## Honesty guardrails',
  ] as const) {
    assert.ok(memo.includes(heading), `${heading} should be present`)
  }
})

test('AX executive risk memo cites public references as borrow avoid action signals', () => {
  const memo = readMemo()

  assert.match(memo, /\|\s*Public reference signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*Memo use\s*\|/)
  for (const publicReferenceSignal of publicReferenceSignals) {
    assert.ok(memo.includes(publicReferenceSignal), `${publicReferenceSignal} should be cited`)
  }
  assert.match(memo, /OWASP/)
  assert.match(memo, /Snyk/)
  assert.match(memo, /Tencent/)
  assert.match(memo, /Agentic Radar/)
  assert.match(memo, /SARIF/)
})

test('AX executive risk memo uses exact fixture-backed evidence commands', () => {
  const memo = readMemo()

  for (const { command, fixtures } of fixtureBackedCommands) {
    assert.ok(memo.includes(command), `${command} should be documented exactly`)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(memo.includes(fixturePath), `${fixturePath} should be documented`)
    }
  }
})

test('AX executive risk memo preserves machine contracts and approval vocabulary', () => {
  const memo = readMemo()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'SARIF',
    'BLOCK',
    'REVIEW',
    'PASS',
    'go/no-go',
  ] as const) {
    assert.ok(memo.includes(contract), `${contract} should stay documented`)
  }
})

test('AX executive risk memo bans fake customer certification parity and adoption claims', () => {
  const memo = readMemo()

  assert.doesNotMatch(memo, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(memo, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(
    memo,
    /(?:OWASP|Snyk|Tencent|splx|GitHub)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement|대체)/i,
  )
  assert.doesNotMatch(memo, /(?:full|complete|전체)\s+(?:AI\s+)?(?:red[-\s]?team|security)\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(memo, /(?:SARIF|GitHub)[^\n|.]{0,80}(?:자동\s*)?(?:채택|adoption|fingerprint guarantee|지문 보장)/i)
})
