import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const docPath = join(repoRoot, 'docs', 'ax-judging-lens-trace-card.md')

const requiredHeadings = [
  '# AX judging lens trace card',
  '## 사용 목적',
  '## AX judging lens → current AgentGuard evidence',
  '## Exact fixture-backed command set',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract boundaries',
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
    fixtures: ['examples/agent-policy.yaml', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log'],
  },
  {
    command: 'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-judging-lens-trace-card.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixtures: ['examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'],
  },
  {
    command: 'npm run smoke:ax-demo',
    fixtures: ['scripts/ax-demo-smoke.mjs'],
  },
] as const

const requiredSourcePaths = [
  'docs/ax-company-problem-intake-kit.md',
  'docs/ax-approval-owner-escalation-matrix.md',
  'docs/ax-30-second-demo-card.md',
  'docs/ax-real-judge-demo-map.md',
  'docs/ax-rule-compliance-checklist.md',
  'docs/ax-assumption-ledger.md',
] as const

const requiredReferenceUrls = [
  'https://hackathon.jocodingax.ai/',
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://github.com/snyk/agent-scan',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/Tencent/AI-Infra-Guard',
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

test('AX judging lens trace card exists and is linked from public docs', () => {
  assert.ok(existsSync(docPath), 'docs/ax-judging-lens-trace-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX judging lens trace card\]\(docs\/ax-judging-lens-trace-card\.md\)/)
  assert.match(examplesDoc, /\[AX judging lens trace card\]\(ax-judging-lens-trace-card\.md\)/)
})

test('AX judging lens trace card has Korean-first judging sections and all 8 lenses', () => {
  const doc = readDoc()

  for (const heading of requiredHeadings) {
    assert.match(doc, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const lens of [
    '회사 문제 적응력',
    '현업성',
    'AX 적합성',
    '결과물성',
    '차별성',
    '재현성·검증성',
    '발표력',
    '정직성',
  ] as const) {
    expectLiteral(doc, lens)
  }

  assert.match(doc, /REAL PROBLEM[\s\S]{0,160}REAL JUDGE[\s\S]{0,160}REAL OUTPUT/)
  assert.match(doc, /company problem[\s\S]{0,500}risk evidence[\s\S]{0,500}approval condition/i)
})

test('AX judging lens trace card uses exact fixture-backed commands with existing paths', () => {
  const doc = readDoc()

  for (const { command, fixtures } of fixtureBackedCommands) {
    expectLiteral(doc, command)
    for (const fixturePath of fixtures) {
      assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
      expectLiteral(doc, fixturePath)
    }
  }

  for (const sourcePath of requiredSourcePaths) {
    assert.ok(existsSync(join(repoRoot, sourcePath)), `${sourcePath} should exist`)
    expectLiteral(doc, sourcePath)
  }
})

test('AX judging lens trace card cites public references with borrow avoid action rows', () => {
  const doc = readDoc()

  for (const referenceUrl of requiredReferenceUrls) {
    expectLiteral(doc, referenceUrl)
  }

  assert.match(doc, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  assert.match(doc, /AX 인재전쟁[\s\S]{0,900}gated scoring/i)
  assert.match(doc, /OWASP[\s\S]{0,900}runtime prevention/i)
  assert.match(doc, /Snyk agent-scan[\s\S]{0,900}platform parity/i)
  assert.match(doc, /GitHub SARIF[\s\S]{0,900}automatic SARIF upload/i)
})

test('AX judging lens trace card preserves machine contracts and bans fake claims', () => {
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
    'no real customer/adoption claim',
    'no external certification',
    'no platform parity claim',
    'no automatic SARIF upload',
    'no runtime authorization claim',
    'no hidden scoring claim',
    'no scanner behavior change',
    'no default verdict/severity change',
  ] as const) {
    assert.match(doc, new RegExp(escapeRegExp(requiredNonClaim), 'i'))
  }

  const proseWithoutGuardrailsOrReferenceRows = doc
    .split('\n')
    .filter((line) => {
      if (line.startsWith('- no ')) return false
      if (line.includes('are not translated or renamed')) return false
      if (line.startsWith('| Public reference') || line.startsWith('|---')) return false
      if (/^\|\s*(?:AX 인재전쟁|OWASP|Snyk agent-scan|GitHub SARIF|Tencent AI-Infra-Guard)\b/.test(line)) return false
      return true
    })
    .join('\n')

  assert.doesNotMatch(proseWithoutGuardrailsOrReferenceRows, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|real customer adoption/i)
  assert.doesNotMatch(proseWithoutGuardrailsOrReferenceRows, /(?:SOC\s*2|ISO\s*27001|external certification|공식\s*인증)[^.\n|]{0,80}(?:achieved|complete|보유|획득|완료)/i)
  assert.doesNotMatch(proseWithoutGuardrailsOrReferenceRows, /(?:Snyk|Tencent|GitHub|OWASP)[^\r\n|.]{0,80}(?:replacement|parity|동등|대체|공식\s*검증|검증\s*완료)/i)
  assert.doesNotMatch(proseWithoutGuardrailsOrReferenceRows, /(?:upload|triage|approval)[^\r\n|.]{0,80}(?:automatic|자동)/i)
  assert.doesNotMatch(proseWithoutGuardrailsOrReferenceRows, /(?:runtime OAuth|session validation|redirect URI|sandbox)[^\r\n|.]{0,80}(?:implemented|구현|enforced|검증)/i)
})
