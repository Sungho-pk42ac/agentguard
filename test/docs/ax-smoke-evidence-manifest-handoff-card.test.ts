import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = findRepoRoot(testDir)
const cardPath = join(repoRoot, 'docs', 'ax-smoke-evidence-manifest-handoff-card.md')

const requiredHeadings = [
  '# AX smoke evidence manifest handoff card',
  '## 사용 목적',
  '## Source-of-record handoff',
  '## Manifest check map',
  '## Reviewer handoff checklist',
  '## Public reference borrow/avoid/action table',
  '## Machine-contract and non-claim boundaries',
] as const

const smokeManifestRows = [
  {
    surface: 'PR diff',
    manifestSurface: 'pr-diff',
    command: 'node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    artifact: '.agentguard-demo/ax-evidence-smoke/pr-diff-findings.json',
    expectedExit: 'Expected exit: `1`',
    expectedVerdict: 'Expected verdict: `REVIEW`',
    ruleId: 'generic-secret-assignment',
  },
  {
    surface: 'MCP config',
    manifestSurface: 'mcp-config',
    command: 'node dist/index.js scan-mcp --json < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
    fixture: 'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
    artifact: '.agentguard-demo/ax-evidence-smoke/mcp-config-findings.json',
    expectedExit: 'Expected exit: `1`',
    expectedVerdict: 'Expected verdict: `BLOCK`',
    ruleId: 'mcp-filesystem-wide-root',
  },
  {
    surface: 'transcript/log',
    manifestSurface: 'transcript-log',
    command:
      'node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    artifact: '.agentguard-demo/ax-evidence-smoke/transcript-log-findings.json',
    expectedExit: 'Expected exit: `0`',
    expectedVerdict: 'Expected verdict: `REVIEW`',
    ruleId: 'denied-command',
  },
  {
    surface: 'SARIF',
    manifestSurface: 'sarif-artifact',
    command:
      'node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-smoke/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    fixture: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
    artifact: '.agentguard-demo/ax-evidence-smoke/agentguard.sarif',
    expectedExit: 'Expected exit: `1`',
    expectedVerdict: 'Expected verdict: `REVIEW`',
    ruleId: 'denied-command',
  },
] as const

const publicReferenceUrls = [
  'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
  'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
  'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
  'https://registry.npmjs.org/agent-scan',
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

test('AX smoke evidence manifest handoff card exists and is linked from public docs', () => {
  assert.ok(existsSync(cardPath), 'docs/ax-smoke-evidence-manifest-handoff-card.md should exist')

  const rootReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
  const examplesDoc = readFileSync(join(repoRoot, 'docs', 'examples.md'), 'utf8')

  assert.match(rootReadme, /\[AX smoke evidence manifest handoff card\]\(docs\/ax-smoke-evidence-manifest-handoff-card\.md\)/)
  assert.match(examplesDoc, /\[AX smoke evidence manifest handoff card\]\(ax-smoke-evidence-manifest-handoff-card\.md\)/)
})

test('AX smoke evidence manifest handoff card is Korean-first and frames manifest as reviewer source-of-record', () => {
  const card = readCard()

  for (const heading of requiredHeadings) {
    assert.match(card, new RegExp(`^${escapeRegExp(heading)}`, 'm'))
  }

  for (const term of [
    '한국어 우선',
    'source-of-record',
    'reviewer handoff artifact',
    'npm run smoke:ax-demo',
    '.agentguard-demo/ax-evidence-smoke/manifest.json',
    'AGENTGUARD_AX_DEMO_EVIDENCE_DIR',
    'AGENTGUARD_AX_DEMO_RUN_ID',
    'runId',
    'replayCommandArgs',
    'replayWorkingDirectory',
    'evidenceSurfaces',
    'evidenceDirectory',
    'manifestPath',
    'requiredArtifacts',
    'requiredSources',
    'producerIntent',
    'packageName',
    'npmVersion',
    'packageManager',
    'packageLockSha256',
  ] as const) {
    expectLiteral(card, term)
  }
})

test('AX smoke evidence manifest handoff card maps manifest checks to exact surfaces paths commands and verdicts', () => {
  const card = readCard()

  for (const row of smokeManifestRows) {
    assert.ok(existsSync(join(repoRoot, row.fixture)), `${row.fixture} should exist`)
    expectLiteral(card, row.surface)
    expectLiteral(card, row.manifestSurface)
    expectLiteral(card, row.command)
    expectLiteral(card, row.fixture)
    expectLiteral(card, row.artifact)
    expectLiteral(card, row.expectedExit)
    expectLiteral(card, row.expectedVerdict)
    expectLiteral(card, row.ruleId)
  }

  for (const manifestContract of [
    'checks[]',
    'summary',
    'evidenceSurfaces',
    'evidenceDirectory',
    'manifestPath',
    'requiredArtifacts',
    'requiredSources',
    'producerIntent',
    'packageName',
    'repositoryUrl',
    'gitBranch',
    'gitTreeState',
    'npmVersion',
    'packageManager',
    'packageLockSha256',
    'total',
    'pass',
    'review',
    'block',
    'runId',
    'replayCommandArgs',
    'replayWorkingDirectory',
    'surface',
    'command',
    'commandArgs',
    'cwd',
    'inputPath',
    'policyPath',
    'exitCode',
    'acceptedNonZero',
    'acceptedNonZeroReason',
    'startedAt',
    'completedAt',
    'durationMs',
    'artifact',
    'ruleIds',
    'sourceSha256',
    'artifactSha256',
    'sourceBytes',
    'artifactBytes',
    'policyBytes',
  ] as const) {
    expectLiteral(card, manifestContract)
  }
})

test('AX smoke evidence manifest handoff card requires hash-backed replay and freshness', () => {
  const card = readCard()

  for (const requiredTerm of [
    'Hash-backed replay/freshness for the smoke manifest',
    'sourceSha256',
    'artifactSha256',
    'policySha256',
    'sourceBytes',
    'artifactBytes',
    'policyBytes',
    'manifest hash',
    'referenced JSON/SARIF artifact hash',
    'source fixture hash',
    'package-lock.json hash',
    'dependency-lock provenance',
    'freshness expires',
    'npm run smoke:ax-demo',
  ] as const) {
    expectLiteral(card, requiredTerm)
  }

  assert.match(card, /manifest\.json[\s\S]{0,900}same evidence directory and run/i)
})

test('AX smoke evidence manifest handoff card cites public references with borrow avoid action rows', () => {
  const card = readCard()

  for (const referenceUrl of publicReferenceUrls) {
    expectLiteral(card, referenceUrl)
  }

  assert.match(card, /\|\s*Public reference\s*\|\s*Borrow\s*\|\s*Avoid\s*\|\s*AgentGuard action\s*\|/)
  const referenceRows = card
    .split('\n')
    .filter((line) => line.startsWith('| [') && publicReferenceUrls.some((referenceUrl) => line.includes(referenceUrl)))
  assert.equal(referenceRows.length, publicReferenceUrls.length)

  for (const row of referenceRows) {
    assert.match(row, /Borrow|빌릴 점/i)
    assert.match(row, /Avoid|피할 점/i)
    assert.match(row, /AgentGuard action/i)
  }

  expectLiteral(card, 'npmjs web page returned 403 in this environment')
  expectLiteral(card, 'registry JSON public fallback')
  expectLiteral(card, 'not insane-search evidence')
  expectLiteral(card, 'category-pressure')
})

test('AX smoke evidence manifest handoff card preserves machine contracts and bans fake claims', () => {
  const card = readCard()

  for (const requiredBoundary of [
    'no scanner behavior change',
    'no CLI command change',
    'no rule ID change',
    'no JSON/SARIF field name change',
    'no package publishing change',
    'no verdict policy change',
    'no external certification',
    'no MCP conformance/runtime auth',
    'no automatic SARIF upload',
    'no real customer/adoption claim',
  ] as const) {
    assert.match(card, new RegExp(escapeRegExp(requiredBoundary), 'i'))
  }

  assert.doesNotMatch(card, /(?:실제\s*)?고객사|도입\s*(?:완료|사례)|레퍼런스\s*고객|real customer adoption/i)
  assert.doesNotMatch(card, /(?:SOC\s*2|ISO\s*27001|external certification|공식\s*인증)[^.\n|]{0,80}(?:achieved|complete|보유|획득|완료)/i)
  assert.doesNotMatch(card, /(?:OWASP|MCP|GitHub|SARIF)[^\r\n|.]{0,80}(?:공식\s*검증|검증\s*완료|인증\s*완료|approved|verified|replacement|parity|동등)/i)
  assert.doesNotMatch(card, /(?:CLI commands?|rule IDs?|JSON|SARIF|machine contracts?)[^\r\n]*(?:한국어로|한글로|번역|변경|renamed?)/i)
  assert.doesNotMatch(
    card,
    /AgentGuard\s+(?:enforces|implements|provides|delivers)[^.\n|]{0,120}(?:runtime authorization|runtime MCP|OAuth|session control|consent UI)/i,
  )
  assert.doesNotMatch(card, /AgentGuard\s+(?:automatically\s+uploads|uploads\s+SARIF|자동\s*업로드)/i)
  assert.doesNotMatch(
    card,
    /AgentGuard[^\n|.]{0,120}(?:Snyk|agent-scan|GitHub code scanning|public scanner)[^\n|.]{0,120}(?:replacement|parity|대체|동등|equivalence|equivalent)/i,
  )
})
