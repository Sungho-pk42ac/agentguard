import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-agent-feedback-loop-evidence-card.md')

const requiredHeadings = [
  '# AX agent feedback-loop evidence card',
  '## 사용 목적',
  '## Finding → owner → fix condition → rerun artifact → approval decision',
  '## Evidence loop card',
  '## Fixture-backed rerun commands',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract preservation',
  '## Non-claim guardrails',
] as const

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
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: [
      'examples/agent-policy.yaml',
      'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    ],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-agent-feedback-loop-evidence-card.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
] as const

const publicReferenceUrls = [
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  'https://modelcontextprotocol.io/specification/draft/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://docs.snyk.io/developer-tools/snyk-cli/commands',
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX agent feedback-loop evidence card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-agent-feedback-loop-evidence-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX agent feedback-loop evidence card\]\(docs\/ax-agent-feedback-loop-evidence-card\.md\)/)
  assert.match(examplesDoc, /\[AX agent feedback-loop evidence card\]\(ax-agent-feedback-loop-evidence-card\.md\)/)
})

test('AX agent feedback-loop evidence card contains Korean-first feedback-loop sections', () => {
  const card = readCard()

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)
  assert.match(card, /finding\s*→\s*owner\s*→\s*fix condition\s*→\s*rerun command\/artifact\s*→\s*approval decision/i)

  for (const term of ['finding', 'owner', 'fix condition', 'rerun command/artifact', 'approval decision'] as const) {
    expectLiteral(card, term)
  }
})

test('AX agent feedback-loop evidence card uses exact commands backed by existing fixtures', () => {
  const card = readCard()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }
})

test('AX agent feedback-loop evidence card cites public references with borrow avoid action notes', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(card, /OWASP Top 10 for LLM Applications/)
  assert.match(card, /MCP Authorization spec/)
  assert.match(card, /GitHub SARIF upload/)
  assert.match(card, /Snyk CLI commands/)
})

test('AX agent feedback-loop evidence card preserves machine contracts and current local scope', () => {
  const card = readCard()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    '--policy',
    '--sarif',
    '--out',
    'rule IDs',
    'secret.github_token',
    'mcp.broad_filesystem_access',
    'agent.dangerous_command',
    'JSON',
    'SARIF',
    'PASS',
    'REVIEW',
    'BLOCK',
  ] as const) {
    expectLiteral(card, contract)
  }

  assert.match(card, /local static\/pre-rollout evidence/i)
  assert.match(card, /reviewer\/approval handoff/i)
  assert.match(card, /not runtime OAuth\/session\/control/i)
})

test('AX agent feedback-loop evidence card rejects unsupported customer certification parity auth and upload claims', () => {
  const card = readCard()

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|certification|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP)[^\r\n|.]{0,80}(?:endorsement|endorsed|full\s+coverage|전체\s*커버리지|공식\s*검증|검증\s*완료|인증\s*완료|approved|verified)/i)
  assert.doesNotMatch(card, /(?:Snyk|GitHub|SARIF|code\s+scanning)[^\r\n|.]{0,80}(?:replacement|parity|동등|대체)/i)
  assert.doesNotMatch(card, /(?:runtime\s+OAuth|session\s+enforcement|runtime\s+authorization|authorization\s+server|OAuth\s+session)[^\r\n|.]{0,80}(?:enforced|validated|controlled|지원|제공|수행)/i)
  assert.doesNotMatch(card, /(?:automatic|자동)[^\r\n|.]{0,80}(?:GitHub\s+)?(?:SARIF\s+)?(?:upload|업로드|triage|분류|approval|승인)/i)
})
