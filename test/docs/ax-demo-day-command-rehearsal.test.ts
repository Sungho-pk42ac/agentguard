import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const rehearsalPath = join(repoRoot, 'docs', 'ax-demo-day-command-rehearsal.md')

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
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-demo-day-command-rehearsal.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: [],
  },
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/snyk/agent-scan',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/stripe/stripe-cli',
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

function readRehearsal(): string {
  return readFileSync(rehearsalPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX demo-day command rehearsal exists and is linked from README', () => {
  assert.ok(existsSync(rehearsalPath), 'docs/ax-demo-day-command-rehearsal.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  assert.match(rootReadme, /\[AX demo-day command rehearsal\]\(docs\/ax-demo-day-command-rehearsal\.md\)/)
})

test('AX demo-day command rehearsal contains the required Korean-first sections', () => {
  const rehearsal = readRehearsal()
  const requiredHeadings = [
    '## 목적',
    '## 3-minute command rehearsal',
    '## Fixture-backed commands',
    '## Expected verdicts and artifacts',
    '## Public reference borrow/avoid/action notes',
    '## Machine-contract boundaries',
    '## Non-claim guardrails',
  ] as const

  assert.match(rehearsal, /^# AX demo-day command rehearsal/m)
  assert.match(rehearsal, /한국어 우선/)
  assert.match(rehearsal, /AX Rollout Guard/)
  for (const heading of requiredHeadings) {
    assert.match(rehearsal, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }
})

test('AX demo-day command rehearsal uses exact fixture-backed commands and existing fixtures', () => {
  const rehearsal = readRehearsal()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(rehearsal, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(rehearsal, fixturePath)
    }
  }

  const packageJson = readFileSync(join(repoRoot, 'package.json'), 'utf8')
  assert.match(packageJson, /"smoke:ax-demo"/)
})

test('AX demo-day command rehearsal states expected verdict and artifact language', () => {
  const rehearsal = readRehearsal()

  assert.match(rehearsal, /scan-diff[\s\S]{0,700}`REVIEW`|`REVIEW`[\s\S]{0,700}scan-diff/i)
  assert.match(rehearsal, /scan-mcp[\s\S]{0,700}`REVIEW`|`REVIEW`[\s\S]{0,700}scan-mcp/i)
  assert.match(rehearsal, /scan-log[\s\S]{0,600}`REVIEW`|`REVIEW`[\s\S]{0,600}scan-log/i)
  assert.match(rehearsal, /SARIF[\s\S]{0,600}\.agentguard-demo\/ax-demo-day-command-rehearsal\.sarif/i)
  assert.match(rehearsal, /smoke:ax-demo[\s\S]{0,900}manifest|manifest[\s\S]{0,900}smoke:ax-demo/i)
  assert.match(rehearsal, /approval|승인/)
  assert.match(rehearsal, /artifact|아티팩트/)
})

test('AX demo-day command rehearsal cites public references with borrow avoid action notes', () => {
  const rehearsal = readRehearsal()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(rehearsal, referenceUrl)
  }

  assert.match(rehearsal, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(rehearsal, /빌릴 점|Borrow/i)
  assert.match(rehearsal, /피할 점|Avoid/i)
  assert.match(rehearsal, /AgentGuard action|조치/i)
})

test('AX demo-day command rehearsal preserves English-compatible machine contracts', () => {
  const rehearsal = readRehearsal()

  for (const machineContract of [
    'agentguard',
    'scan-diff',
    'scan-mcp',
    'scan-log',
    'PASS',
    'REVIEW',
    'BLOCK',
    'rule IDs',
    'JSON',
    'SARIF',
    'SARIF 2.1.0',
    'machine fields',
    'generic-secret-assignment',
    'denied-command',
  ] as const) {
    expectLiteral(rehearsal, machineContract)
  }

  assert.doesNotMatch(
    rehearsal,
    /(?:CLI|command|rule IDs?|JSON|SARIF|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename)/i,
  )
})

test('AX demo-day command rehearsal bans unsupported adoption certification platform and product claims', () => {
  const rehearsal = readRehearsal()

  assert.doesNotMatch(rehearsal, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(rehearsal, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance|audited\s+by/i)
  assert.doesNotMatch(
    rehearsal,
    /(?:OWASP|Snyk|GitHub|Stripe)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i,
  )
  assert.doesNotMatch(rehearsal, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(rehearsal, /(?:SaaS|auth|dashboard|customer data|고객\s*데이터)[^\n]*(?:available|지원|제공|운영|production)/i)
  assert.doesNotMatch(rehearsal, /(?:package publishing|scanner behavior|rule severity)[^\n]*(?:changed|변경됨|바뀜)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
