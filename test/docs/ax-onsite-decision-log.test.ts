import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-onsite-decision-log.md')

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
    command: 'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json'],
  },
  {
    command: 'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
    fixtures: ['examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff'],
  },
  {
    command:
      'mkdir -p .agentguard-demo && node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
] as const

const requiredPublicReferences = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/draft/basic/authorization',
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

test('AX onsite decision log exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-onsite-decision-log.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX onsite decision log\]\(docs\/ax-onsite-decision-log\.md\)/)
  assert.match(examplesDoc, /\[AX onsite decision log\]\(ax-onsite-decision-log\.md\)/)
})

test('AX onsite decision log maps the onsite decision chain Korean-first', () => {
  const doc = readDoc()

  assert.match(doc, /^# AX onsite decision log/m)
  assert.match(doc, /한국어 우선/)
  assert.match(
    doc,
    /company problem[\s\S]{0,120}decision[\s\S]{0,120}evidence command[\s\S]{0,120}verdict[\s\S]{0,120}approver\/action[\s\S]{0,120}rerun trigger/i,
  )

  for (const requiredTerm of [
    '회사 문제',
    '의사결정',
    'evidence command',
    'verdict',
    'approver/action',
    'rerun trigger',
    '승인자',
    '재실행',
  ] as const) {
    expectLiteral(doc, requiredTerm)
  }
})

test('AX onsite decision log uses exact commands backed by existing fixtures', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const verdict of ['PASS', 'REVIEW', 'BLOCK'] as const) {
    expectLiteral(doc, verdict)
  }
})

test('AX onsite decision log cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of requiredPublicReferences) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /REAL PROBLEM/i)
  assert.match(doc, /OWASP Agentic AI threats and mitigations/)
  assert.match(doc, /MCP Authorization/)
  assert.match(doc, /GitHub SARIF upload/)
})

test('AX onsite decision log preserves machine contracts and rejects unsupported claims', () => {
  const doc = readDoc()

  for (const machineContract of [
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'PASS',
    'REVIEW',
    'BLOCK',
    'mcp.broad_filesystem_access',
    'secret.github_token',
  ] as const) {
    expectLiteral(doc, machineContract)
  }

  assert.doesNotMatch(doc, /(?:CLI|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|verdicts?|PASS|REVIEW|BLOCK)[^\r\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i)
  assert.doesNotMatch(doc, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(doc, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(doc, /(?:OWASP|MCP|GitHub|AX)[^\r\n|.]{0,100}(?:endorsed|validated|approved|공식\s*검증|검증\s*완료|인증\s*완료)/i)
  assert.doesNotMatch(doc, /(?:hidden|비공개|gated|게이트된)\s+(?:score|scoring|점수|채점)[^\r\n]*(?:반영|optimized|최적화)/i)
  assert.doesNotMatch(doc, /AgentGuard\s+(?:has|provides|delivers|implements)\s+MCP[^.\n|]{0,100}(?:runtime authorization|OAuth|session control|conformance)/i)
  assert.doesNotMatch(doc, /(?:dashboard|SaaS|auth|customer data|고객\s*데이터)[^\r\n]*(?:available|지원|제공|운영|production)/i)
})
