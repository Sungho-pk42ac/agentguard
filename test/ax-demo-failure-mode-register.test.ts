import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const registerPath = join(repoRoot, 'docs', 'ax-demo-failure-mode-register.md')
const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

const requiredFixturePaths = [
  'examples/agent-policy.yaml',
  'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
  'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
  'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
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

function readRegister(): string {
  return readFileSync(registerPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function runCli(
  mode: 'scan-diff' | 'scan-mcp' | 'scan-log',
  fixturePath: string,
  extraArgs: readonly string[] = [],
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', mode, ...extraArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: readFileSync(join(repoRoot, fixturePath), 'utf8'),
    timeout: 10_000,
  })

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

test('AX demo failure mode register exists and is linked from public docs', () => {
  assert.ok(existsSync(registerPath), 'docs/ax-demo-failure-mode-register.md should exist')
  assert.match(rootReadme, /\[AX demo failure mode register\]\(docs\/ax-demo-failure-mode-register\.md\)/)
  assert.match(examplesDoc, /\[AX demo failure mode register\]\(ax-demo-failure-mode-register\.md\)/)
})

test('AX demo failure mode register maps demo failures to judge-visible AgentGuard evidence', () => {
  const register = readRegister()
  const requiredHeadings = [
    '## 사용 목적',
    '## Failure-mode register',
    '## Exact smoke commands',
    '## Judge-defense sentences',
    '## Public references',
    '## 하지 않는 주장 / Non-claims',
  ] as const

  for (const heading of requiredHeadings) {
    assert.match(register, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  const requiredColumnLabels = [
    'Demo failure mode',
    'AgentGuard surface',
    'Exact fixture-backed command',
    'Expected verdict',
    'Mitigation',
    'Judge-defense sentence',
  ] as const

  for (const label of requiredColumnLabels) {
    expectLiteral(register, label)
  }

  for (const term of [
    '라이브 데모 실패',
    'PR diff',
    'MCP config',
    'agent transcript/log',
    'SARIF',
    'approval-required',
    'BLOCK',
    'REVIEW',
    'PASS',
    '수정/정책',
    '대상권',
  ] as const) {
    expectLiteral(register, term)
  }
})

test('AX demo failure mode register commands use existing fixtures and implemented CLI surfaces', () => {
  const register = readRegister()

  for (const fixturePath of requiredFixturePaths) {
    assert.ok(existsSync(join(repoRoot, fixturePath)), `${fixturePath} should exist`)
    expectLiteral(register, fixturePath)
  }

  const requiredCommands = [
    'node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    'node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json',
    'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
    'node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json',
    'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff',
    'node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff',
    'node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
  ] as const

  for (const command of requiredCommands) {
    expectLiteral(register, command)
  }
})


test('AX demo failure mode register fixture commands reproduce the documented verdict shape', () => {
  const enterprisePr = runCli('scan-diff', 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff')
  const enterpriseMcp = runCli('scan-mcp', 'examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json')
  const transcript = runCli('scan-log', 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log', [
    '--policy',
    'examples/agent-policy.yaml',
  ])
  const riskyMcp = runCli('scan-mcp', 'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json')
  const fixedMcp = runCli('scan-mcp', 'examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json')
  const riskyDiff = runCli('scan-diff', 'examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff')
  const fixedDiff = runCli('scan-diff', 'examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff')

  assert.equal(enterprisePr.status, 1, enterprisePr.stderr)
  assert.match(enterprisePr.stdout, /\*\*판정:\*\*\s*REVIEW|\*\*Verdict:\*\*\s*REVIEW/)

  assert.equal(enterpriseMcp.status, 0, enterpriseMcp.stderr)
  assert.match(enterpriseMcp.stdout, /\*\*판정:\*\*\s*REVIEW|\*\*Verdict:\*\*\s*REVIEW/)

  assert.equal(transcript.status, 0, transcript.stderr)
  assert.match(transcript.stdout, /\*\*판정:\*\*\s*REVIEW|\*\*Verdict:\*\*\s*REVIEW/)

  assert.equal(riskyMcp.status, 1, riskyMcp.stderr)
  assert.match(riskyMcp.stdout, /\*\*판정:\*\*\s*BLOCK|\*\*Verdict:\*\*\s*BLOCK/)

  assert.equal(fixedMcp.status, 0, fixedMcp.stderr)
  assert.match(fixedMcp.stdout, /\*\*판정:\*\*\s*PASS|\*\*Verdict:\*\*\s*PASS/)
  assert.match(fixedMcp.stdout, /탐지 건수:\*\*\s*0|Findings:\*\*\s*0/)

  assert.equal(riskyDiff.status, 1, riskyDiff.stderr)
  assert.match(riskyDiff.stdout, /\*\*판정:\*\*\s*REVIEW|\*\*Verdict:\*\*\s*REVIEW/)

  assert.equal(fixedDiff.status, 0, fixedDiff.stderr)
  assert.match(fixedDiff.stdout, /\*\*판정:\*\*\s*PASS|\*\*Verdict:\*\*\s*PASS/)
  assert.match(fixedDiff.stdout, /탐지 건수:\*\*\s*0|Findings:\*\*\s*0/)
})

test('AX demo failure mode register cites public references without unsupported claims', () => {
  const register = readRegister()
  const requiredUrls = [
    'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/',
    'https://github.com/snyk/agent-scan',
    'https://docs.anthropic.com/en/docs/claude-code/security',
    'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning',
  ] as const

  for (const url of requiredUrls) {
    expectLiteral(register, url)
  }

  assert.doesNotMatch(register, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객/i)
  assert.doesNotMatch(register, /SOC\s*2|ISO\s*27001|공식\s*인증|certified|conformance/i)
  assert.doesNotMatch(register, /(?:full|complete|전체)\s+(?:platform|red[-\s]?team|coverage|커버리지|플랫폼)/i)
  assert.doesNotMatch(register, /GitHub\s+security\s+products?\s+replacement/i)
  assert.doesNotMatch(register, /OWASP\s+(?:certified|verified|approved)/i)
  assert.doesNotMatch(register, /Snyk\s+(?:replacement|equivalent)|agent-scan\s+parity/i)
  assert.doesNotMatch(register, /Anthropic\s+(?:approved|endorsed|certified)/i)
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
