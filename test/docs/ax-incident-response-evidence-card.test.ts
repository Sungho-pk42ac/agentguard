import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-incident-response-evidence-card.md')

const requiredHeadings = [
  '## Incident triage map',
  '## Fixture-backed rerun commands',
  '## Public reference grounding',
  '## Machine-contract boundaries',
  '## Non-claim guardrails',
] as const

const fixturePaths = [
  'examples/risky-pr.diff',
  'examples/risky-mcp.json',
  'examples/agent-policy.yaml',
  'examples/agent-transcript.log',
] as const

const exactCommands = [
  'node dist/index.js scan-diff < examples/risky-pr.diff',
  'node dist/index.js scan-mcp < examples/risky-mcp.json',
  'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
  'node dist/index.js scan-diff --sarif --out .agentguard-demo/incident-response.sarif < examples/risky-pr.diff',
] as const

const publicReferenceUrls = [
  'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://github.com/snyk/agent-scan',
  'https://github.com/Tencent/AI-Infra-Guard',
  'https://github.com/splx-ai/agentic-radar',
] as const

const fixtureBackedRuleIds = [
  'openai-key',
  'anthropic-api-key',
  'denied-command',
  'mcp-env-token',
  'mcp-filesystem',
  'mcp-github',
  'mcp-filesystem-wide-root',
] as const

const machineContracts = [
  'CLI commands',
  'rule IDs',
  'JSON',
  'SARIF',
  'machine fields',
  'ruleId',
  ...fixtureBackedRuleIds,
] as const

type Finding = { readonly id: string }
type SarifRun = { readonly results?: readonly { readonly ruleId?: string }[] }
type SarifLog = { readonly runs?: readonly SarifRun[] }

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

function runAgentguardJson(args: readonly string[], inputFixture: string): readonly Finding[] {
  const input = readFileSync(join(repoRoot, inputFixture))
  try {
    const stdout = execFileSync('node', ['--import', 'tsx', 'src/index.ts', ...args], {
      cwd: repoRoot,
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10_000,
    })
    return JSON.parse(stdout) as readonly Finding[]
  } catch (error) {
    const stdout = (error as { stdout?: Buffer | string }).stdout
    assert.ok(stdout, `agentguard ${args.join(' ')} should emit JSON even on risky-input nonzero exit`)
    return JSON.parse(String(stdout)) as readonly Finding[]
  }
}

test('AX incident response evidence card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-incident-response-evidence-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX incident response evidence card\]\(docs\/ax-incident-response-evidence-card\.md\)/)
  assert.match(examplesDoc, /\[AX incident response evidence card\]\(ax-incident-response-evidence-card\.md\)/)
})

test('AX incident response evidence card maps BLOCK and REVIEW findings to incident actions', () => {
  const card = readCard()

  assert.match(card, /^# AX incident response evidence card/m)
  assert.match(card, /한국어 우선/)
  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    'incident triage',
    'containment owner',
    'fix/policy condition',
    'rerun command',
    'approval/residual-risk sentence',
    'BLOCK',
    'REVIEW',
  ] as const) {
    expectLiteral(card, term)
  }

  assert.match(card, /BLOCK[\s\S]{0,900}containment owner[\s\S]{0,900}fix\/policy condition[\s\S]{0,900}approval\/residual-risk sentence/i)
  assert.match(card, /REVIEW[\s\S]{0,900}containment owner[\s\S]{0,900}fix\/policy condition[\s\S]{0,900}approval\/residual-risk sentence/i)
})

test('AX incident response evidence card uses exact fixture-backed commands and existing fixtures', () => {
  const card = readCard()

  for (const fixturePath of fixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(card, fixturePath)
  }

  for (const command of exactCommands) {
    expectLiteral(card, command)
  }
})

test('AX incident response evidence card cites public references with grounded action language', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard incident action\s*\|/)
  assert.match(card, /빌릴 점|Borrow/i)
  assert.match(card, /피할 점|Avoid/i)
})

test('AX incident response evidence card preserves fixture-backed CLI rule JSON SARIF and machine contracts', () => {
  const card = readCard()
  const diffIds = runAgentguardJson(['scan-diff', '--json'], 'examples/risky-pr.diff').map((finding) => finding.id)
  const mcpIds = runAgentguardJson(['scan-mcp', '--json'], 'examples/risky-mcp.json').map((finding) => finding.id)
  const logIds = runAgentguardJson(['scan-log', '--json', '--policy', 'examples/agent-policy.yaml'], 'examples/agent-transcript.log').map((finding) => finding.id)

  for (const id of new Set([...diffIds, ...mcpIds, ...logIds])) {
    expectLiteral(card, id)
  }
  for (const contract of machineContracts) {
    expectLiteral(card, contract)
  }

  const outDir = mkdtempSync(join(tmpdir(), 'agentguard-incident-sarif-'))
  const sarifPath = join(outDir, 'incident-response.sarif')
  try {
    try {
      execFileSync('node', ['--import', 'tsx', 'src/index.ts', 'scan-diff', '--sarif', '--out', sarifPath], {
        cwd: repoRoot,
        input: readFileSync(join(repoRoot, 'examples/risky-pr.diff')),
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10_000,
      })
    } catch {
      // Risky fixture exits non-zero after writing SARIF; artifact shape is asserted below.
    }
    const sarif = JSON.parse(readFileSync(sarifPath, 'utf8')) as SarifLog
    const sarifIds = new Set(sarif.runs?.flatMap((run) => run.results?.map((result) => result.ruleId ?? '') ?? []) ?? [])
    for (const id of diffIds) {
      assert.ok(sarifIds.has(id), `SARIF should include fixture-backed ruleId ${id}`)
      expectLiteral(card, id)
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }

  assert.doesNotMatch(card, /(?:secret\.github_token|generic-secret-assignment|mcp\.broad_filesystem_access|mcp\.filesystem_writable_path|mcp\.credential_env_passthrough)/)
  assert.doesNotMatch(card, /(?:CLI commands?|명령어|rule IDs?|룰 ID|규칙 ID|JSON|SARIF|machine fields?)[^\n]*(?:한국어로|한글로|번역|변경|바뀜|rename|renamed)/i)
  assert.doesNotMatch(card, /(?:scan-diff|scan-mcp|scan-log|--sarif|--out)[^\n]*(?:rename|renamed|이름\s*변경|표시용\s*변경)/i)
})

test('AX incident response evidence card bans unsupported customer certification parity and product claims', () => {
  const card = readCard()

  assert.match(card, /No fake adoption/)
  assert.match(card, /No customer claim/)
  assert.match(card, /No certification claim/)
  assert.match(card, /No parity claim/)
  assert.match(card, /No product rename/)

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(card, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|Snyk|Tencent|AI-Infra-Guard|splx-ai|agentic-radar)[^\n|.]{0,80}(?:검증\s*완료|인증\s*완료|approved|verified|replacement)/i)
  assert.doesNotMatch(card, /(?:full|complete|전체)\s+(?:AI\s+)?red[-\s]?team\s+(?:platform|coverage|플랫폼|커버리지)/i)
  assert.doesNotMatch(card, /(?:AX Rollout Guard|AgentGuard)[^\n]*(?:renamed|rename|이름\s*변경|제품명\s*변경)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
