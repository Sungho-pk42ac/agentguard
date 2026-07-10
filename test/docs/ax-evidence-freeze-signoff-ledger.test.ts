import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const ledgerPath = join(repoRoot, 'docs', 'ax-evidence-freeze-signoff-ledger.md')

const freezeRows = [
  {
    surface: 'PR diff',
    command: 'node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
    artifact: '.agentguard-demo/ax-evidence-freeze/pr-diff-findings.json',
  },
  {
    surface: 'MCP config',
    command: 'node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'],
    artifact: '.agentguard-demo/ax-evidence-freeze/mcp-config-findings.json',
  },
  {
    surface: 'transcript/log',
    command:
      'node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
    artifact: '.agentguard-demo/ax-evidence-freeze/transcript-log-findings.json',
  },
  {
    surface: 'SARIF/report artifact',
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-freeze/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
    artifact: '.agentguard-demo/ax-evidence-freeze/agentguard.sarif',
  },
  {
    surface: 'smoke manifest',
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
    artifact: '.agentguard-demo/ax-evidence-smoke/manifest.json',
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

function readLedger(): string {
  return readFileSync(ledgerPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX evidence freeze sign-off ledger exists and is linked from public docs', () => {
  assert.ok(existsSync(ledgerPath), 'docs/ax-evidence-freeze-signoff-ledger.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX evidence freeze sign-off ledger\]\(docs\/ax-evidence-freeze-signoff-ledger\.md\)/)
  assert.match(examplesDoc, /\[AX evidence freeze sign-off ledger\]\(ax-evidence-freeze-signoff-ledger\.md\)/)
})

test('AX evidence freeze sign-off ledger is Korean-first with sign-off and rerun sections', () => {
  const ledger = readLedger()

  for (const heading of [
    '# AX evidence freeze sign-off ledger',
    '## Sign-off ledger',
    '## Public reference borrow/avoid/action rows',
    '## Static evidence boundary',
    '## Fake-claim guardrails',
  ] as const) {
    assert.match(ledger, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of ['한국어 우선', 'approver', 'sign-off', 'rerun', '승인자', '서명 조건', '재실행 trigger'] as const) {
    expectLiteral(ledger, term)
  }
})

test('AX evidence freeze sign-off ledger maps exact commerce VOC fixtures commands and artifacts', () => {
  const ledger = readLedger()

  for (const row of freezeRows) {
    expectLiteral(ledger, row.surface)
    expectLiteral(ledger, row.command)
    expectLiteral(ledger, row.artifact)
    for (const fixture of row.fixtures) {
      assert.ok(existsSync(join(repoRoot, fixture)), `${fixture} should exist`)
      expectLiteral(ledger, fixture)
    }
  }

  for (const machineContract of [
    'agentguard',
    'scan-diff',
    'scan-mcp',
    'scan-log',
    'PASS',
    'REVIEW',
    'BLOCK',
    'JSON',
    'SARIF',
    'rule IDs',
  ] as const) {
    expectLiteral(ledger, machineContract)
  }
})

test('AX evidence freeze sign-off ledger cites public references with borrow avoid action notes', () => {
  const ledger = readLedger()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(ledger, referenceUrl)
  }

  assert.match(ledger, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(ledger, /Borrow|빌릴 점/i)
  assert.match(ledger, /Avoid|피할 점/i)
  assert.match(ledger, /AgentGuard action|적용/i)
})

test('AX evidence freeze sign-off ledger keeps static boundaries and fake-claim guardrails', () => {
  const ledger = readLedger()

  for (const requiredBoundary of [
    'static AgentGuard evidence',
    'does not enforce runtime consent',
    'does not enforce OAuth',
    'does not enforce MCP authorization',
    'does not upload SARIF automatically',
    'no real credentials',
    'no customer data',
  ] as const) {
    assert.match(ledger, new RegExp(escapeRegExp(requiredBoundary), 'i'))
  }

  assert.doesNotMatch(ledger, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(ledger, /(?:SOC\s*2|ISO\s*27001|공식\s*인증|external certification|certified|conformance)/i)
  assert.doesNotMatch(ledger, /(?:OWASP|MCP|GitHub|Snyk|SARIF)[^\r\n|.]{0,100}(?:공식\s*검증|검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등|대체)/i)
  assert.doesNotMatch(ledger, /AgentGuard\s+(?:has|provides|delivers|implements|enforces)\s+[^.\n|]{0,100}(?:runtime consent|OAuth|session control|MCP authorization|SARIF upload)/i)
  assert.doesNotMatch(ledger, /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
})
