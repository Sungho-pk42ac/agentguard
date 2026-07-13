import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-evidence-freshness-sla-card.md')

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
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/evidence-freshness-sla.sarif < examples/risky-pr.diff',
    fixtures: ['examples/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
] as const

const requiredReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
] as const

const requiredHeadings = [
  '# AX evidence freshness SLA card',
  '## 사용 목적',
  '## Freshness SLA matrix',
  '## Exact fixture-backed rerun commands',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract boundaries',
  '## Non-claim guardrails',
] as const

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  for (let depth = 0; depth < 20; depth += 1) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  throw new Error('Could not find package.json in the directory tree')
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

test('AX evidence freshness SLA card exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-evidence-freshness-sla-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX evidence freshness SLA card\]\(docs\/ax-evidence-freshness-sla-card\.md\)/)
  assert.match(examplesDoc, /\[AX evidence freshness SLA card\]\(ax-evidence-freshness-sla-card\.md\)/)
})

test('AX evidence freshness SLA card has Korean-first freshness sections', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    'AX Rollout Guard',
    'freshness SLA',
    'stale evidence',
    'rerun trigger',
    'approval owner',
    'source of record',
  ] as const) {
    expectLiteral(doc, term)
  }

  assert.match(doc, /PR diff[\s\S]{0,600}15분[\s\S]{0,600}rerun/i)
  assert.match(doc, /MCP config[\s\S]{0,600}30분[\s\S]{0,600}approval/i)
  assert.match(doc, /SARIF[\s\S]{0,600}artifact[\s\S]{0,600}hash/i)
})

test('AX evidence freshness SLA card uses exact fixture-backed commands with existing paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  assert.equal(packageJson.scripts?.['smoke:ax-demo'], 'node scripts/ax-demo-smoke.mjs')
})

test('AX evidence freshness SLA card cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of requiredReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /OWASP[\s\S]{0,900}agent\/tool misuse/i)
  assert.match(doc, /MCP Authorization[\s\S]{0,900}runtime OAuth/i)
  assert.match(doc, /GitHub SARIF[\s\S]{0,900}automatic SARIF upload/i)
})

test('AX evidence freshness SLA card preserves machine contracts and bans fake claims', () => {
  const doc = readDoc()

  for (const contract of [
    'agentguard scan-diff',
    'agentguard scan-mcp',
    'agentguard scan-log',
    'agentguard doctor',
    'PASS',
    'REVIEW',
    'BLOCK',
    'rule IDs',
    'JSON',
    'SARIF',
    'API',
    'machine fields',
    'ruleId',
    'artifactLocation.uri',
    'tool.driver.name',
  ] as const) {
    expectLiteral(doc, contract)
  }

  for (const requiredNonClaim of [
    'no scanner behavior change',
    'no exit-code semantics change',
    'no default verdict/severity change',
    'no automatic SARIF upload',
    'no runtime authorization claim',
    'no real customer/adoption claim',
    'no external certification',
    'no platform parity claim',
  ] as const) {
    assert.match(doc, new RegExp(escapeRegExp(requiredNonClaim), 'i'))
  }

  const proseWithoutGuardrailBullets = doc
    .split('\n')
    .filter((line) => {
      if (line.startsWith('- no ')) return false
      if (line.includes('are not translated or renamed')) return false
      if (line.startsWith('| Public reference') || line.startsWith('|---')) return false
      if (/^\|\s*(?:OWASP|MCP Authorization|GitHub SARIF)\b/.test(line)) return false
      return true
    })
    .join('\n')

  assert.doesNotMatch(proseWithoutGuardrailBullets, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(proseWithoutGuardrailBullets, /(?:SOC\s*2|ISO\s*27001|external certification|공식\s*인증)[^.\n|]{0,80}(?:achieved|complete|보유|획득|완료)/i)
  assert.doesNotMatch(proseWithoutGuardrailBullets, /(?:OWASP|GitHub|SARIF|MCP)[^\r\n|.]{0,80}(?:공식\s*검증|검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등)/i)
  assert.doesNotMatch(proseWithoutGuardrailBullets, /(?:upload|triage|approval)[^\r\n|.]{0,80}(?:automatic|자동)/i)
  assert.doesNotMatch(proseWithoutGuardrailBullets, /(?:runtime OAuth|session validation|redirect URI validation)[^\r\n|.]{0,80}(?:implemented|구현|enforced|검증)/i)
  assert.doesNotMatch(proseWithoutGuardrailBullets, /(?:CLI commands?|rule IDs?|JSON|SARIF|API|machine fields?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
})
