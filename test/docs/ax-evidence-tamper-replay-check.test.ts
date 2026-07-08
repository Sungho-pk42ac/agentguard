import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-evidence-tamper-replay-check.md')

const requiredHeadings = [
  '# AX evidence tamper/replay check',
  '## 사용 목적',
  '## Tamper/replay checklist',
  '## Surface evidence map',
  '## Exact fixture-backed commands',
  '## Public reference borrow/avoid/action table',
  '## Non-claim guardrails',
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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file',
  'https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support',
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX evidence tamper/replay check exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-evidence-tamper-replay-check.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX evidence tamper\/replay check\]\(docs\/ax-evidence-tamper-replay-check\.md\)/)
  assert.match(examplesDoc, /\[AX evidence tamper\/replay check\]\(ax-evidence-tamper-replay-check\.md\)/)
})

test('AX evidence tamper/replay check has Korean-first required sections', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /변조/)
  assert.match(doc, /replay/i)
  assert.match(doc, /hash/i)
  assert.match(doc, /freshness/i)
})

test('AX evidence tamper/replay check maps every surface to replay controls', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*Surface\s*\|\s*Source artifact\s*\|\s*Rerun command\s*\|\s*Hash\/freshness cue\s*\|\s*Approver action\s*\|/,
  )

  for (const surface of ['PR diff', 'MCP config', 'transcript/log', 'SARIF/report'] as const) {
    expectLiteral(doc, surface)
    assert.match(doc, new RegExp(`${escapeRegExp(surface)}[\\s\\S]{0,900}(?:hash|freshness|SHA|timestamp)`, 'i'))
    assert.match(doc, new RegExp(`${escapeRegExp(surface)}[\\s\\S]{0,900}(?:approver|reviewer|승인자|재실행)`, 'i'))
  }
})

test('AX evidence tamper/replay check uses exact fixture-backed commands with existing paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const requiredTerm of ['same-input regeneration', 'artifact hash', 'freshness', 'rerun trigger'] as const) {
    expectLiteral(doc, requiredTerm)
  }
})

test('AX evidence tamper/replay check cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /OWASP/i)
  assert.match(doc, /MCP Security Best Practices/i)
  assert.match(doc, /GitHub SARIF/i)
  assert.match(doc, /빌릴 점|Borrow/i)
  assert.match(doc, /피할 점|Avoid/i)
})

test('AX evidence tamper/replay check keeps fake claims out', () => {
  const doc = readDoc()

  for (const requiredNonClaim of [
    'no scanner behavior change',
    'no automatic SARIF upload',
    'no MCP runtime auth/consent enforcement',
    'no external certification',
    'no real customer/adoption claim',
  ] as const) {
    assert.match(doc, new RegExp(escapeRegExp(requiredNonClaim), 'i'))
  }

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(doc, /(?:SOC\s*2|ISO\s*27001|external certification|공식\s*인증)[^.\n|]{0,80}(?:achieved|complete|보유|획득|완료)/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|SARIF)[^\r\n|.]{0,80}(?:공식\s*검증|검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등)/i)
  assert.doesNotMatch(doc, /(?:upload|triage|approval)[^\r\n|.]{0,80}(?:automatic|자동)/i)
  assert.doesNotMatch(doc, /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
})
