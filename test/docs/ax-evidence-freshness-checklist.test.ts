import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistPath = join(repoRoot, 'docs', 'ax-evidence-freshness-checklist.md')

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/snyk/agent-scan',
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
  {
    command: 'node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
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

function readChecklist(): string {
  return readFileSync(checklistPath, 'utf8')
}

test('AX evidence freshness checklist exists and is linked from the root README', () => {
  assert.ok(existsSync(checklistPath), 'docs/ax-evidence-freshness-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX evidence freshness checklist\]\(docs\/ax-evidence-freshness-checklist\.md\)/)
})

test('AX evidence freshness checklist maps public references to safe AgentGuard actions', () => {
  const checklist = readChecklist()

  assert.match(checklist, /^# AX evidence freshness checklist/m)
  assert.match(checklist, /한국어 우선/)
  assert.match(checklist, /AX 인재전쟁|company problem|회사 문제/i)
  assert.match(checklist, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|\s*Freshness proof\s*\|/)

  for (const referenceUrl of publicReferenceUrls) {
    assert.ok(checklist.includes(referenceUrl), `${referenceUrl} should be cited`)
  }

  const publicReferenceRows = checklist
    .split('\n')
    .filter((line) => line.startsWith('| [') && publicReferenceUrls.some((referenceUrl) => line.includes(referenceUrl)))
  assert.ok(publicReferenceRows.length >= 3, 'at least three public references should be mapped in table rows')

  for (const row of publicReferenceRows) {
    assert.match(row, /빌릴 점|Borrow/i)
    assert.match(row, /피할 점|Avoid/i)
    assert.match(row, /AgentGuard action|AgentGuard/i)
    assert.match(row, /fresh|freshness|rerun|재실행|최신|last checked|HTTP 200/i)
  }
})

test('AX evidence freshness checklist uses exact fixture-backed commands and existing fixtures', () => {
  const checklist = readChecklist()

  for (const { command, fixtures } of fixtureBackedCommands) {
    assert.ok(checklist.includes(command), `${command} should be documented exactly`)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(checklist.includes(fixturePath), `${fixturePath} should be documented`)
    }
  }

  assert.match(checklist, /fixture-backed|합성 fixture|저장소 fixture/i)
  assert.match(checklist, /BLOCK/)
  assert.match(checklist, /REVIEW/)
  assert.match(checklist, /PASS/)
})

test('AX evidence freshness checklist preserves machine-facing contracts', () => {
  const checklist = readChecklist()

  for (const contract of [
    'AgentGuard',
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'SARIF',
    'JSON',
    'rule IDs',
  ] as const) {
    assert.ok(checklist.includes(contract), `${contract} should stay documented`)
  }

  assert.doesNotMatch(checklist, /(?:CLI|명령어|rule ID|룰 ID|규칙 ID|verdict|판정|SARIF|JSON)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX evidence freshness checklist bans unsupported gated-rule, adoption, certification, and parity claims', () => {
  const checklist = readChecklist()

  assert.doesNotMatch(checklist, /비공개\s*(?:심사표|채점표|scoring)|gated\s*(?:scoring|submission)\s*(?:verified|confirmed)/i)
  assert.doesNotMatch(checklist, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(checklist, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(checklist, /(?:OWASP|MCP|GitHub|Snyk)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(checklist, /(?:vendor[-\s]?scale|동급|parity|대체재)/i)
})
