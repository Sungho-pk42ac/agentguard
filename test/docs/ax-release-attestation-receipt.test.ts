import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const receiptPath = join(repoRoot, 'docs', 'ax-release-attestation-receipt.md')

const requiredHeadings = [
  '# AX release attestation receipt',
  '## 사용 목적',
  '## Release receipt checklist',
  '## Exact fixture-backed evidence commands',
  '## Public reference borrow/avoid/action table',
  '## Approval owner map',
  '## Receipt template',
  '## Machine-contract and non-claim boundaries',
] as const

const publicReferenceUrls = [
  'https://modelcontextprotocol.io/specification/draft/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://docs.snyk.io/developer-tools/snyk-cli/commands/monitor',
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
] as const

const evidenceCommands: Array<{
  command: string
  fixture: string
  expectedExit: string
  expectedVerdict?: string
  artifact?: string
}> = [
  {
    command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
    fixture: 'examples/risky-pr.diff',
    expectedExit: 'Expected exit: `1`',
    expectedVerdict: 'Expected verdict: `BLOCK`',
  },
  {
    command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
    fixture: 'examples/risky-mcp.json',
    expectedExit: 'Expected exit: `1`',
    expectedVerdict: 'Expected verdict: `BLOCK`',
  },
  {
    command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
    fixture: 'examples/agent-transcript.log',
    expectedExit: 'Expected exit: `0`',
    expectedVerdict: 'Expected verdict: `REVIEW`',
  },
  {
    command:
      'mkdir -p .agentguard-demo/release-attestation && node dist/index.js scan-diff --sarif --out .agentguard-demo/release-attestation/agentguard.sarif < examples/risky-pr.diff',
    fixture: 'examples/risky-pr.diff',
    expectedExit: 'Expected exit: `1`',
    artifact: '.agentguard-demo/release-attestation/agentguard.sarif',
  },
]

function findRepoRoot(startDir: string): string {
  let currentDir = startDir
  while (true) {
    if (existsSync(join(currentDir, 'package.json'))) return currentDir
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) throw new Error('Could not find package.json in the directory tree')
    currentDir = parentDir
  }
}

function readReceipt(): string {
  return readFileSync(receiptPath, 'utf8')
}

function expectLiteral(content: string, value: string): void {
  assert.ok(content.includes(value), `${value} should be present`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('AX release attestation receipt exists and is linked from public entrypoints', () => {
  assert.ok(existsSync(receiptPath), 'docs/ax-release-attestation-receipt.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX release attestation receipt\]\(docs\/ax-release-attestation-receipt\.md\)/)
  assert.match(examplesDoc, /\[AX release attestation receipt\]\(ax-release-attestation-receipt\.md\)/)
})

test('AX release attestation receipt is Korean-first and pins required receipt sections', () => {
  const receipt = readReceipt()

  for (const heading of requiredHeadings) {
    assert.match(receipt, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    'release attestation receipt',
    'source-of-record',
    'fresh clone',
    'git SHA',
    'artifact hash',
    'sha256sum',
    'Approval owner',
    'Rerun trigger',
    'Residual risk',
    'security reviewer',
    'business owner',
    'CI owner',
    'rollout lead',
  ] as const) {
    expectLiteral(receipt, term)
  }
})

test('AX release attestation receipt maps exact commands to existing fixtures and artifact evidence', () => {
  const receipt = readReceipt()

  for (const { command, fixture, expectedExit, expectedVerdict, artifact } of evidenceCommands) {
    expectLiteral(receipt, command)
    expectLiteral(receipt, fixture)
    expectLiteral(receipt, expectedExit)
    assert.ok(existsSync(join(repoRoot, fixture)), `${fixture} should exist`)
    if (expectedVerdict) expectLiteral(receipt, expectedVerdict)
    if (artifact) expectLiteral(receipt, artifact)
  }

  for (const term of [
    'version: 2.1.0',
    'runs[]',
    'tool.driver.rules[]',
    'results[]',
    'ruleId',
    'locations',
    'PASS',
    'REVIEW',
    'BLOCK',
    'Markdown',
    'JSON',
    'SARIF',
  ] as const) {
    expectLiteral(receipt, term)
  }
})

test('AX release attestation receipt live-smokes pinned CLI verdict and exit examples', () => {
  const commandCases = [
    {
      command: 'node dist/index.js scan-diff < examples/risky-pr.diff',
      args: ['scan-diff'],
      inputFixture: 'examples/risky-pr.diff',
      expectedExitCode: 1,
      expectedVerdict: 'BLOCK',
    },
    {
      command: 'node dist/index.js scan-mcp < examples/risky-mcp.json',
      args: ['scan-mcp'],
      inputFixture: 'examples/risky-mcp.json',
      expectedExitCode: 1,
      expectedVerdict: 'BLOCK',
    },
    {
      command: 'node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log',
      args: ['scan-log', '--policy', 'examples/agent-policy.yaml'],
      inputFixture: 'examples/agent-transcript.log',
      expectedExitCode: 0,
      expectedVerdict: 'REVIEW',
    },
  ] as const

  for (const { command, args, inputFixture, expectedExitCode, expectedVerdict } of commandCases) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: readFileSync(join(repoRoot, inputFixture), 'utf8'),
      timeout: 15_000,
    })

    assert.equal(result.status, expectedExitCode, `${command} exit code should match the receipt; stderr: ${result.stderr}`)
    assert.match(
      result.stdout,
      new RegExp(`\\*\\*판정:\\*\\* ${expectedVerdict}`),
      `${command} verdict should match the receipt; stdout: ${result.stdout}; stderr: ${result.stderr}`,
    )
    assert.equal(result.error, undefined)
  }
})

test('AX release attestation receipt live-smokes SARIF artifact shape in a temp directory', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'agentguard-release-attestation-'))
  const sarifPath = join(tempDir, 'agentguard.sarif')

  try {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'src/index.ts',
        'scan-diff',
        '--sarif',
        '--out',
        sarifPath,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        input: readFileSync(join(repoRoot, 'examples/risky-pr.diff'), 'utf8'),
        timeout: 15_000,
      },
    )

    assert.equal(result.status, 1, `risky SARIF smoke should preserve the documented nonzero exit; stderr: ${result.stderr}`)
    assert.equal(result.error, undefined)
    assert.ok(existsSync(sarifPath), 'SARIF artifact should be created in the temp directory')

    const sarif = JSON.parse(readFileSync(sarifPath, 'utf8')) as {
      version: string
      runs: Array<{ results: unknown[]; tool: { driver: { rules: unknown[] } } }>
    }
    assert.equal(sarif.version, '2.1.0')
    assert.ok(sarif.runs.length > 0, 'SARIF should contain at least one run')
    assert.ok(sarif.runs[0].results.length > 0, 'SARIF should contain results')
    assert.ok(sarif.runs[0].tool.driver.rules.length > 0, 'SARIF should contain rule metadata')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('AX release attestation receipt cites public references and preserves machine-contract guardrails', () => {
  const receipt = readReceipt()

  for (const url of publicReferenceUrls) {
    expectLiteral(receipt, url)
  }

  for (const term of [
    'least privilege',
    'explicit user consent',
    'token audience',
    'SARIF artifact',
    'reviewer handoff',
    'recurring snapshot',
    'agent risk vocabulary',
    'CLI commands',
    'command flags',
    'rule IDs',
    'severity names',
    'verdict values',
    'JSON',
    'SARIF',
    'API',
    'English-compatible',
  ] as const) {
    expectLiteral(receipt, term)
  }
})

test('AX release attestation receipt keeps fake-claim bans explicit', () => {
  const receipt = readReceipt()

  for (const forbiddenClaimBoundary of [
    'does not claim hosted monitoring',
    'runtime OAuth enforcement',
    'live MCP consent enforcement',
    'automatic SARIF upload',
    'automatic triage',
    'Snyk/GitHub/OWASP parity',
    'certification',
    'endorsement',
    'adoption',
    'customer proof',
    'not implementation proof',
    'agent self-report',
  ] as const) {
    expectLiteral(receipt, forbiddenClaimBoundary)
  }

  assert.doesNotMatch(receipt, /AgentGuard (guarantees|certifies|replaces).{0,100}(Snyk|GitHub|OWASP|SARIF|MCP)/i)
  assert.doesNotMatch(receipt, /automatic SARIF upload.{0,80}(enabled|complete|guaranteed)/i)
  assert.doesNotMatch(receipt, /runtime OAuth.{0,80}(enforced|guaranteed|solved)/i)
})
