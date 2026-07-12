import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-agent-runner-sandbox-boundary.md')

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
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-runner-sandbox/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const requiredHeadings = [
  '# AX agent runner sandbox boundary',
  '## 사용 목적',
  '## 30초 agent runner sandbox boundary flow',
  '## Company problem → runner surface → evidence command → sandbox/approval decision',
  '## Public reference borrow / avoid / AgentGuard action',
  '## Static pre-run boundary',
  '## English-compatible machine contracts',
  '## Non-claim guardrails',
] as const

const publicReferenceUrls = [
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX agent runner sandbox boundary exists and is linked from README and examples index', () => {
  assert.ok(existsSync(docPath), 'docs/ax-agent-runner-sandbox-boundary.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')

  assert.match(rootReadme, /\[AX agent runner sandbox boundary\]\(docs\/ax-agent-runner-sandbox-boundary\.md\)/)
  assert.match(
    examplesReadme,
    /\[AX agent runner sandbox boundary\]\(\.\.\/docs\/ax-agent-runner-sandbox-boundary\.md\)/,
  )
})

test('AX agent runner sandbox boundary keeps Korean-first ordered sections', () => {
  const doc = readDoc()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = doc.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /30초/)
  assert.match(doc, /sandbox|runner|실행|승인/i)
})

test('AX agent runner sandbox boundary uses exact fixture-backed evidence commands', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*Company problem\s*\|\s*Runner surface\s*\|\s*Exact evidence command\s*\|\s*Expected verdict\s*\|\s*Sandbox\/approval decision\s*\|/,
  )

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const term of [
    'PR diff',
    'MCP config',
    'transcript/log',
    'SARIF',
    '.agentguard-demo/agent-runner-sandbox/agentguard.sarif',
    'sandbox',
    'approval',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX agent runner sandbox boundary cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /least privilege|consent|confused deputy|SSRF|token/i)
  assert.match(doc, /tool misuse|excessive agency|mitigation|control/i)
  assert.match(doc, /SARIF|code scanning|artifact/i)
})

test('AX agent runner sandbox boundary preserves machine contracts and static boundary language', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'node dist/index.js scan-diff',
    'node dist/index.js scan-mcp',
    'node dist/index.js scan-log',
    'mcp.broad_filesystem_access',
    'mcp.env_credential',
    'denied-command',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'ruleId',
    'result',
    'location',
    'artifact',
    'BLOCK',
    'REVIEW',
    'PASS',
  ] as const) {
    expectLiteral(doc, contract)
  }

  assert.match(doc, /static pre-run/i)
  assert.match(doc, /runtime sandbox를 제공하지 않습니다/)
  assert.match(doc, /OAuth\/session enforcement를 제공하지 않습니다/)
  assert.match(doc, /consent UI를 제공하지 않습니다/)
  assert.match(doc, /automatic SARIF upload를 제공하지 않습니다/)
  assert.match(doc, /customer-adoption evidence를 제공하지 않습니다/)
  assert.match(doc, /external certification을 제공하지 않습니다/)
  assert.doesNotMatch(doc, /(?:CLI commands?|rule IDs?|machine fields?|JSON|SARIF|API)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX agent runner sandbox boundary bans fake adoption certification parity upload and runtime enforcement claims', () => {
  const doc = readDoc()

  assert.doesNotMatch(
    doc,
    /(?:실제\s*)?고객사[^.\n]*(?:확보|사용|스캔|도입|완료)|도입\s*(?:완료|사례)[^.\n]*(?:있|확보)|레퍼런스\s*고객|real customer adoption[^.\n]*(?:available|complete|evidence)/i,
  )
  assert.doesNotMatch(doc, /(?:SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance)[^.\n]*(?:획득|완료|보유|passed|available|certified)/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub)[^\n|.]{0,80}(?:공식\s*검증|인증\s*완료|검증\s*완료|approved|verified)/i)
  assert.doesNotMatch(doc, /(?:GitHub\s+code\s+scanning)[^\n|.]{0,80}(?:대체합니다|replacement\s+for|has\s+parity|동등합니다)/i)
  assert.match(doc, /대체하거나 동등하다고 말하지 않습니다/)
  assert.doesNotMatch(doc, /automatic\s+SARIF\s+upload[^\n.]{0,80}(?:available|enabled|done|complete)/i)
  assert.doesNotMatch(doc, /runtime\s+(?:sandbox|OAuth|authorization|session|consent)[^\n.]{0,80}(?:available|enabled|enforced|controls?\s+enabled)/i)
  assert.doesNotMatch(doc, /real customer data[^\n.]{0,80}(?:scanned|scan evidence|검사\s*완료|스캔\s*완료)/i)
})
