import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const checklistPath = join(repoRoot, 'docs', 'ax-demo-evidence-freeze-checklist.md')

const requiredHeadings = [
  '# AX demo evidence freeze checklist',
  '## 10분 evidence freeze 순서',
  '## Fixture-backed freeze commands',
  '## Public reference borrow/avoid/action rows',
  '## Static evidence and runtime enforcement boundary',
  '## Judge replay packet',
] as const

const freezeRows = [
  {
    surface: 'PR diff',
    command: 'node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    artifact: '.agentguard-demo/ax-evidence-freeze/pr-diff-findings.json',
    expectedVerdict: 'Expected verdict: `BLOCK`',
  },
  {
    surface: 'MCP config',
    command: 'node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    artifact: '.agentguard-demo/ax-evidence-freeze/mcp-config-findings.json',
    expectedVerdict: 'Expected verdict: `BLOCK`',
  },
  {
    surface: 'transcript/log',
    command:
      'node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    artifact: '.agentguard-demo/ax-evidence-freeze/transcript-log-findings.json',
    expectedVerdict: 'Expected verdict: `REVIEW`',
  },
  {
    surface: 'SARIF/report artifact',
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-freeze/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    artifact: '.agentguard-demo/ax-evidence-freeze/agentguard.sarif',
    expectedVerdict: 'Expected verdict: `BLOCK`',
  },
  {
    surface: 'smoke manifest',
    command: 'npm run smoke:ax-demo',
    fixture: 'scripts/ax-demo-smoke.mjs',
    artifact: '.agentguard-demo/ax-evidence-smoke/manifest.json',
    expectedVerdict: 'Expected result: manifest includes PR diff, MCP config, transcript/log, and SARIF checks',
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://docs.snyk.io/developer-tools/snyk-cli/snyk-cli',
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

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX demo evidence freeze checklist exists and is linked from public docs', () => {
  assert.ok(existsSync(checklistPath), 'docs/ax-demo-evidence-freeze-checklist.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX demo evidence freeze checklist\]\(docs\/ax-demo-evidence-freeze-checklist\.md\)/)
  assert.match(examplesDoc, /\[AX demo evidence freeze checklist\]\(ax-demo-evidence-freeze-checklist\.md\)/)
})

test('AX demo evidence freeze checklist is Korean-first with required freeze sections', () => {
  const checklist = readChecklist()

  for (const heading of requiredHeadings) {
    assert.match(checklist, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const requiredTerm of [
    '한국어 우선',
    '10분',
    '회사 문제',
    '승인',
    '보류',
    '차단',
    '재현',
    'source-of-record',
  ] as const) {
    expectLiteral(checklist, requiredTerm)
  }
})

test('AX demo evidence freeze checklist lists exact fixture-backed commands and artifacts', () => {
  const checklist = readChecklist()

  for (const row of freezeRows) {
    assert.ok(existsSync(join(repoRoot, row.fixture)), `${row.fixture} should exist`)
    expectLiteral(checklist, row.surface)
    expectLiteral(checklist, row.command)
    expectLiteral(checklist, row.fixture)
    expectLiteral(checklist, row.artifact)
    expectLiteral(checklist, row.expectedVerdict)
  }

  for (const machineContract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'SARIF',
    'JSON',
    'PASS',
    'REVIEW',
    'BLOCK',
    'rule IDs',
  ] as const) {
    expectLiteral(checklist, machineContract)
  }
})

test('AX demo evidence freeze checklist maps public references with borrow avoid action rows', () => {
  const checklist = readChecklist()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(checklist, referenceUrl)
  }

  assert.match(checklist, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  const referenceRows = checklist
    .split('\n')
    .filter((line) => line.startsWith('| [') && publicReferenceUrls.some((referenceUrl) => line.includes(referenceUrl)))
  assert.equal(referenceRows.length, publicReferenceUrls.length)

  for (const row of referenceRows) {
    assert.match(row, /Borrow|빌릴 점/i)
    assert.match(row, /Avoid|피할 점/i)
    assert.match(row, /AgentGuard action/i)
  }
})

test('AX demo evidence freeze checklist separates static evidence from runtime enforcement and fake claims', () => {
  const checklist = readChecklist()

  for (const requiredBoundary of [
    'static AgentGuard evidence',
    'does not enforce runtime consent',
    'does not enforce OAuth',
    'does not run MCP servers',
    'does not upload SARIF automatically',
    'no scanner behavior change',
    'no CLI command change',
    'no verdict policy change',
    'no package publishing change',
    'no real credentials',
  ] as const) {
    assert.match(checklist, new RegExp(escapeRegExp(requiredBoundary), 'i'))
  }

  assert.doesNotMatch(checklist, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(checklist, /(?:SOC\s*2|ISO\s*27001|공식\s*인증|external certification|certified|conformance)/i)
  assert.doesNotMatch(checklist, /(?:OWASP|MCP|GitHub|Snyk|SARIF)[^\r\n|.]{0,100}(?:공식\s*검증|검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등|대체)/i)
  assert.doesNotMatch(checklist, /AgentGuard\s+(?:has|provides|delivers|implements|enforces)\s+[^.\n|]{0,100}(?:runtime consent|OAuth|session control|MCP authorization|SARIF upload)/i)
  assert.doesNotMatch(checklist, /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
})
