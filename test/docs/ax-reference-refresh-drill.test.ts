import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const drillPath = join(repoRoot, 'docs', 'ax-reference-refresh-drill.md')

const publicSignalUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://github.com/snyk/agent-scan',
  'https://hackathon.jocodingax.ai/',
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

function readDrill(): string {
  return readFileSync(drillPath, 'utf8')
}

test('AX reference refresh drill exists and is linked from the root README', () => {
  assert.ok(existsSync(drillPath), 'docs/ax-reference-refresh-drill.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX reference refresh drill\]\(docs\/ax-reference-refresh-drill\.md\)/)
})

test('AX reference refresh drill is Korean-first and keeps public signal rows actionable', () => {
  const drill = readDrill()

  assert.match(drill, /^# AX reference refresh drill/m)
  assert.match(drill, /한국어 우선/)
  assert.match(drill, /대상권|target-prize/i)
  assert.match(drill, /\|\s*Public signal\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|\s*Evidence command\s*\|\s*Freshness check\s*\|/)

  for (const signalUrl of publicSignalUrls) {
    assert.ok(drill.includes(signalUrl), `${signalUrl} should be cited`)
  }

  const publicSignalRows = drill
    .split('\n')
    .filter((line) => line.startsWith('| [') && publicSignalUrls.some((signalUrl) => line.includes(signalUrl)))
  assert.ok(publicSignalRows.length >= 3, 'at least three public signals should be mapped in table rows')

  for (const row of publicSignalRows) {
    assert.match(row, /빌릴 점|Borrow/i)
    assert.match(row, /피할 점|Avoid/i)
    assert.match(row, /AgentGuard|`node dist\/index\.js scan-/)
    assert.match(row, /`node dist\/index\.js scan-(?:diff|mcp|log)/)
    assert.match(row, /최신|fresh|refresh|last checked|HTTP 200/i)
  }
})

test('AX reference refresh drill uses only fixture-backed evidence commands', () => {
  const drill = readDrill()

  for (const { command, fixtures } of fixtureBackedCommands) {
    assert.ok(drill.includes(command), `${command} should be documented exactly`)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(drill.includes(fixturePath), `${fixturePath} should be documented`)
    }
  }

  assert.match(drill, /SARIF/)
  assert.match(drill, /Markdown/)
  assert.match(drill, /fixture-backed|합성 fixture|저장소 fixture/i)
})

test('AX reference refresh drill preserves machine-facing AgentGuard contracts', () => {
  const drill = readDrill()

  for (const contract of [
    'AgentGuard',
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'SARIF',
    'rule IDs',
  ] as const) {
    assert.ok(drill.includes(contract), `${contract} should stay documented`)
  }

  assert.doesNotMatch(drill, /(?:CLI|명령어|rule ID|룰 ID|규칙 ID|제품명|product name)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX reference refresh drill bans unsupported adoption, certification, and coverage claims', () => {
  const drill = readDrill()

  assert.doesNotMatch(drill, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(drill, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(drill, /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(drill, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
})
