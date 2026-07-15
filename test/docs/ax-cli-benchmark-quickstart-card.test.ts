import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-cli-benchmark-quickstart-card.md')

const requiredHeadings = [
  '# AX CLI benchmark quickstart card',
  '## 사용 목적',
  '## Fresh clone quickstart',
  '## Benchmark signal map',
  '## Research provenance checked this run',
  '## Fixture-backed AgentGuard commands',
  '## Agentic guardrail evidence ladder',
  '## SARIF handoff contract',
  '## Machine contracts',
  '## Non-claim guardrails',
] as const

const publicReferenceUrls = [
  'https://cli.github.com/manual/',
  'https://vercel.com/docs/cli',
  'https://raw.githubusercontent.com/stripe/stripe-cli/master/README.md',
  'https://docs.sentry.io/cli/',
  'https://docs.snyk.io/snyk-cli',
] as const

const publicAgenticGuardrailUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  'https://github.com/openai/openai-agents-js',
] as const

const fixtureBackedCommands = [
  {
    command: 'node dist/index.js doctor',
    fixtures: [] as const,
  },
  {
    command: 'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'] as const,
  },
  {
    command: 'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json'] as const,
  },
  {
    command:
      'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'] as const,
  },
  {
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-benchmark-quickstart.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'] as const,
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

function readCard(): string {
  return readFileSync(cardPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

test('AX CLI benchmark quickstart card exists and is linked from README and examples docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-cli-benchmark-quickstart-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX CLI benchmark quickstart card\]\(docs\/ax-cli-benchmark-quickstart-card\.md\)/)
  assert.match(examplesDoc, /\[AX CLI benchmark quickstart card\]\(ax-cli-benchmark-quickstart-card\.md\)/)
})

test('AX CLI benchmark quickstart card is Korean-first with stable English machine contracts', () => {
  const card = readCard()

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  assert.match(card, /한국어 우선/)
  for (const machineContract of [
    'agentguard doctor',
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    '--sarif',
    '--out',
    'CLI commands',
    'rule IDs',
    'JSON',
    'SARIF',
    'machine contracts',
    'PASS',
    'REVIEW',
    'BLOCK',
  ] as const) {
    expectLiteral(card, machineContract)
  }
})

test('AX CLI benchmark quickstart card maps five public CLI benchmarks to borrow avoid action', () => {
  const card = readCard()

  assert.match(card, /\|\s*Public CLI benchmark\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
    assert.match(card, new RegExp(`${escapeRegExp(referenceUrl)}[\\s\\S]{0,700}Borrow:`))
    assert.match(card, new RegExp(`${escapeRegExp(referenceUrl)}[\\s\\S]{0,700}Avoid:`))
  }

  for (const borrowedSignal of [
    'manual surface',
    'install/login/status/config vocabulary',
    'login/help/rehearsal discipline',
    'release/artifact/CI evidence language',
    'remediation/rerun language',
  ] as const) {
    expectLiteral(card, borrowedSignal)
  }
})

test('AX CLI benchmark quickstart card records public research provenance for this slice', () => {
  const card = readCard()

  assert.match(card, /\|\s*Source path\s*\|\s*Run status\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  for (const provenance of [
    'Public HTML fetch returned 200 for GitHub CLI manual',
    'Public HTML fetch returned 200 for OWASP Agentic AI threats and mitigations',
    'Public HTML fetch returned 200 for MCP Security Best Practices',
    'Public HTML fetch returned 200 for GitHub SARIF upload docs',
    'GitHub API returned 200 for Snyk agent-scan metadata',
    'GitHub API returned 200 for OpenAI agents-js metadata',
    'insane-search escalation was not required because public fallback fetches returned 200',
  ] as const) {
    expectLiteral(card, provenance)
  }

  assert.match(card, /status\/manual vocabulary/i)
  assert.match(card, /agentic risk\/mitigation vocabulary/i)
  assert.match(card, /least privilege|explicit user consent/i)
  assert.match(card, /SARIF artifact handoff/i)
  assert.match(card, /public scanner category pressure/i)
  assert.match(card, /multi-agent workflow|agent workflow framework/i)
})

test('AX CLI benchmark quickstart card connects agentic guardrail references to a first-minute evidence ladder', () => {
  const card = readCard()

  assert.match(card, /\|\s*Public agentic guardrail reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard evidence action\s*\|/)
  for (const referenceUrl of publicAgenticGuardrailUrls) {
    expectLiteral(card, referenceUrl)
    assert.match(card, new RegExp(`${escapeRegExp(referenceUrl)}[\\s\\S]{0,900}Borrow:`))
    assert.match(card, new RegExp(`${escapeRegExp(referenceUrl)}[\\s\\S]{0,900}Avoid:`))
  }

  assert.match(card, /doctor[^\n]{0,160}scan-diff[^\n]{0,160}scan-mcp[^\n]{0,160}scan-log[^\n]{0,160}SARIF/i)
  assert.match(card, /tool misuse|excessive agency|human control|mitigation/i)
  assert.match(card, /authorization|token|session|permission boundary/i)
  assert.match(card, /static pre-rollout|point-in-time/i)
})

test('AX CLI benchmark quickstart card uses exact fresh-clone commands backed by existing fixtures', () => {
  const card = readCard()

  for (const setupCommand of ['npm ci', 'npm run build', 'mkdir -p .agentguard-demo'] as const) {
    expectLiteral(card, setupCommand)
  }

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(card, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(card, fixturePath)
    }
  }
})

test('AX CLI benchmark quickstart card preserves SARIF handoff and honest reviewer gaps', () => {
  const card = readCard()

  assert.match(card, /SARIF[^\n]{0,140}(?:reviewer|handoff|artifact)/i)
  assert.match(card, /artifact[^\n]{0,140}(?:owner|path|rerun|evidence)/i)
  assert.match(card, /fresh clone|build/i)
  assert.match(card, /fixture-backed local commands/i)
  assert.match(card, /honest gaps|known gaps|남는 gap/i)
})

test('AX CLI benchmark quickstart card bans fake platform adoption certification and scanner-parity claims', () => {
  const card = readCard()

  for (const requiredNonClaim of [
    'No adoption claim',
    'No certification claim',
    'No hosted auth claim',
    'No dashboard claim',
    'No scanner parity claim',
    'No product rename',
  ] as const) {
    expectLiteral(card, requiredNonClaim)
  }

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:GitHub|Vercel|Stripe|Sentry|Snyk)[^\n|.]{0,100}(?:approved|endorsed|verified|인증|공식\s*검증)/i)
  assert.doesNotMatch(
    card,
    /AgentGuard[^\n|.]{0,120}(?:Snyk|GitHub code scanning|Sentry)[^\n|.]{0,100}(?:replacement|parity|대체|동등)/i,
  )
  assert.doesNotMatch(card, /AgentGuard[^\n|.]{0,120}(?:full|complete|전체)\s+(?:agentic\s+)?security\s+(?:platform|coverage|scanner)/i)
  assert.doesNotMatch(
    card,
    /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i,
  )
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
