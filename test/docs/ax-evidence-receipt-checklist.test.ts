import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistPath = join(repoRoot, 'docs', 'ax-evidence-receipt-checklist.md')

const requiredHeadings = [
  '# AX evidence receipt checklist',
  '## Evidence receipt format',
  '## Surface checklist',
  '## Fixture-backed commands',
  '## Public reference borrow/avoid guide',
  '## Reviewer handoff receipt',
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

const publicReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
  'https://github.com/snyk/agent-scan',
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX evidence receipt checklist exists and is linked from reviewer-facing docs', () => {
  assert.ok(existsSync(checklistPath), 'docs/ax-evidence-receipt-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX evidence receipt checklist\]\(docs\/ax-evidence-receipt-checklist\.md\)/)
  assert.match(examplesDoc, /\[AX evidence receipt checklist\]\(ax-evidence-receipt-checklist\.md\)/)
})

test('AX evidence receipt checklist covers receipt headings and handoff surfaces', () => {
  const checklist = readChecklist()

  for (const heading of requiredHeadings) {
    assert.match(checklist, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const surface of ['PR diff', 'MCP', 'transcript/log', 'SARIF', 'reviewer handoff'] as const) {
    assert.match(checklist, new RegExp(escapeRegExp(surface), 'i'))
  }

  assert.match(checklist, /한국어 우선/)
  assert.match(checklist, /evidence receipt/i)
  assert.match(checklist, /PASS|REVIEW|BLOCK/)
})

test('AX evidence receipt checklist uses exact fixture-backed commands with existing paths', () => {
  const checklist = readChecklist()

  for (const { command, fixtures } of fixtureBackedCommands) {
    assert.ok(checklist.includes(command), `${command} should be documented exactly`)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      assert.ok(checklist.includes(fixturePath), `${fixturePath} should be documented`)
    }
  }
})

test('AX evidence receipt checklist grounds public references without unsupported claims', () => {
  const checklist = readChecklist()

  for (const referenceUrl of publicReferenceUrls) {
    assert.ok(checklist.includes(referenceUrl), `${referenceUrl} should be cited`)
  }

  assert.match(checklist, /borrow/i)
  assert.match(checklist, /avoid/i)
  assert.match(checklist, /Snyk agent-scan/i)
  assert.match(checklist, /GitHub SARIF support/i)
  assert.match(checklist, /OWASP Agentic AI threats\/mitigations/i)

  assert.doesNotMatch(checklist, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|fake adoption/i)
  assert.doesNotMatch(checklist, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(checklist, /(?:OWASP|GitHub|Snyk|AX)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(checklist, /(?:GitHub\s+security\s+products?|Snyk|agent-scan)[^\n|.]{0,80}(?:대체|replacement|parity|동등)/i)
})
