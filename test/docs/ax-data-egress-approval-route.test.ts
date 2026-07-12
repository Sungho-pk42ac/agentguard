import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-data-egress-approval-route.md')

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/data-egress/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const requiredHeadings = [
  '# AX data egress approval route',
  '## 사용 목적',
  '## 30초 data egress approval flow',
  '## Company problem → egress surface → evidence command → approval decision',
  '## Public reference borrow / avoid / AgentGuard action',
  '## Static pre-rollout boundary',
  '## English-compatible machine contracts',
  '## Non-claim guardrails',
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
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

function readDoc(): string {
  return readFileSync(docPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX data egress approval route exists and is linked from README and examples index', () => {
  assert.ok(existsSync(docPath), 'docs/ax-data-egress-approval-route.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesReadme = readFileSync(join(repoRoot, 'examples', 'README.md'), 'utf8')

  assert.match(rootReadme, /\[AX data egress approval route\]\(docs\/ax-data-egress-approval-route\.md\)/)
  assert.match(
    examplesReadme,
    /\[AX data egress approval route\]\(\.\.\/docs\/ax-data-egress-approval-route\.md\)/,
  )
})

test('AX data egress approval route keeps Korean-first ordered sections', () => {
  const doc = readDoc()
  let previousIndex = -1

  for (const heading of requiredHeadings) {
    const headingIndex = doc.indexOf(heading)
    assert.ok(headingIndex > previousIndex, `${heading} should appear after the previous required heading`)
    previousIndex = headingIndex
  }

  assert.match(doc, /한국어 우선/)
  assert.match(doc, /30초/)
  assert.match(doc, /data egress|데이터 반출/i)
})

test('AX data egress approval route uses exact fixture-backed evidence commands', () => {
  const doc = readDoc()

  assert.match(
    doc,
    /\|\s*Company problem\s*\|\s*Egress surface\s*\|\s*Exact evidence command\s*\|\s*Expected verdict\s*\|\s*Approval decision\s*\|/,
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
    'Markdown report',
    'BLOCK',
    'REVIEW',
    'PASS',
    '.agentguard-demo/data-egress/agentguard.sarif',
  ] as const) {
    expectLiteral(doc, term)
  }
})

test('AX data egress approval route cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /tool misuse|excessive permission/i)
  assert.match(doc, /authorization|session|redirect/i)
  assert.match(doc, /SARIF/i)
  assert.match(doc, /agent-scan/i)
})

test('AX data egress approval route preserves machine contracts and static boundary language', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'node dist/index.js scan-diff',
    'node dist/index.js scan-mcp',
    'node dist/index.js scan-log',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'denied-command',
    'approval-required',
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

  assert.match(doc, /static pre-rollout/i)
  assert.match(doc, /runtime authorization을 구현하지 않습니다/)
  assert.doesNotMatch(doc, /(?:CLI commands?|rule IDs?|machine fields?|JSON|SARIF|API)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
})

test('AX data egress approval route bans fake adoption certification parity upload and runtime enforcement claims', () => {
  const doc = readDoc()

  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(doc, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|Snyk|Tencent)[^\n|.]{0,80}(?:공식\s*검증|인증\s*완료|검증\s*완료|approved|verified)/i)
  assert.doesNotMatch(doc, /(?:Snyk|Tencent|GitHub\s+code\s+scanning)[^\n|.]{0,80}(?:대체합니다|replacement\s+for|has\s+parity|동등합니다)/i)
  assert.match(doc, /대체하거나 동등하다고 말하지 않습니다/)
  assert.doesNotMatch(doc, /automatic\s+SARIF\s+upload[^\n.]{0,80}(?:available|enabled|done|complete)/i)
  assert.doesNotMatch(doc, /runtime\s+(?:OAuth|authorization|session)[^\n.]{0,80}(?:available|enabled|enforced|controls?\s+enabled)/i)
  assert.doesNotMatch(doc, /real customer data[^\n.]{0,80}(?:scanned|scan evidence|검사\s*완료|스캔\s*완료)/i)
})
