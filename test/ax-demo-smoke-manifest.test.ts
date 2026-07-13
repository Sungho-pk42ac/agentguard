import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(testDir, '..')
const hexSha256 = /^[0-9a-f]{64}$/

type SmokeManifest = {
  readonly schemaVersion: string
  readonly generatedBy: string
  readonly evidencePurpose: string
  readonly cliPath?: string
  readonly cliSha256?: string
  readonly packageVersion?: string
  readonly gitCommitSha: string
  readonly checks?: readonly SmokeManifestCheck[]
}

type SmokeManifestCheck = {
  readonly surface?: string
  readonly command?: string
  readonly commandArgs?: readonly string[]
  readonly inputPath?: string
  readonly policyPath?: string
  readonly exitCode?: number
  readonly acceptedNonZero?: boolean
  readonly verdict?: string
  readonly artifact?: string
  readonly ruleIds?: readonly string[]
  readonly sourceSha256?: string
  readonly artifactSha256?: string
  readonly policySha256?: string
}

test('AX demo smoke manifest records SHA-256 provenance for source inputs and artifacts', { timeout: 120_000 }, () => {
  execFileSync(process.execPath, [join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc')], {
    cwd: repoRoot,
    stdio: 'pipe',
    timeout: 120_000,
  })

  const evidenceDir = mkdtempSync(join(tmpdir(), 'agentguard-ax-smoke-'))
  try {
    execFileSync(process.execPath, [join(repoRoot, 'scripts', 'ax-demo-smoke.mjs')], {
      cwd: repoRoot,
      env: { ...process.env, AGENTGUARD_AX_DEMO_EVIDENCE_DIR: evidenceDir },
      stdio: 'pipe',
      timeout: 120_000,
    })

    const manifest = JSON.parse(readFileSync(join(evidenceDir, 'manifest.json'), 'utf8')) as SmokeManifest
    assert.equal(manifest.schemaVersion, '1.0.0', 'manifest should record the smoke manifest contract version')
    assert.equal(
      manifest.generatedBy,
      'agentguard ax-demo-smoke',
      'manifest should identify the producer that generated the evidence bundle',
    )
    assert.equal(
      manifest.evidencePurpose,
      'AX Rollout Guard fixture-backed smoke evidence for PR diff, MCP config, transcript/log, and SARIF reviewer handoff',
      'manifest should explain the reviewer-facing purpose without parsing prose docs',
    )
    assert.equal(manifest.cliPath, 'dist/index.js', 'manifest should name the built CLI artifact used for the smoke')
    assert.match(manifest.cliSha256 ?? '', hexSha256, 'manifest cliSha256 should be lowercase SHA-256 hex')
    assert.match(manifest.packageVersion ?? '', /^\d+\.\d+\.\d+/, 'manifest should record package.json version')
    assert.match(manifest.gitCommitSha ?? '', /^[0-9a-f]{40}$/, 'manifest should record the git commit SHA used for smoke evidence')
    assert.ok(Array.isArray(manifest.checks), 'manifest.checks should be an array')
    assert.equal(manifest.checks.length, 4, 'manifest should cover PR diff, MCP config, transcript/log, and SARIF')

    for (const check of manifest.checks) {
      assert.equal(typeof check.surface, 'string', 'surface should stay present')
      assert.equal(typeof check.command, 'string', `${check.surface ?? 'check'} command should stay present`)
      assert.ok(Array.isArray(check.commandArgs), `${check.surface ?? 'check'} commandArgs should stay present`)
      assert.equal(check.commandArgs?.[0], 'node', `${check.surface ?? 'check'} commandArgs should describe the node CLI runner`)
      assert.equal(check.commandArgs?.[1], 'dist/index.js', `${check.surface ?? 'check'} commandArgs should name the built CLI`)
      assert.equal(typeof check.inputPath, 'string', `${check.surface ?? 'check'} inputPath should stay present`)
      assert.equal(typeof check.exitCode, 'number', `${check.surface ?? 'check'} exitCode should stay present`)
      assert.equal(typeof check.acceptedNonZero, 'boolean', `${check.surface ?? 'check'} acceptedNonZero should stay present`)
      assert.match(check.verdict ?? '', /^(PASS|REVIEW|BLOCK)$/, `${check.surface ?? 'check'} verdict should be present`)
      assert.equal(typeof check.artifact, 'string', `${check.surface ?? 'check'} artifact should stay present`)
      assert.ok(Array.isArray(check.ruleIds), `${check.surface ?? 'check'} ruleIds should stay present`)
      assert.match(check.sourceSha256 ?? '', hexSha256, `${check.surface ?? 'check'} sourceSha256 should be lowercase SHA-256 hex`)
      assert.match(
        check.artifactSha256 ?? '',
        hexSha256,
        `${check.surface ?? 'check'} artifactSha256 should be lowercase SHA-256 hex`,
      )
    }

    const transcriptCheck = manifest.checks.find((check) => check.surface === 'transcript-log')
    assert.equal(
      transcriptCheck?.policyPath,
      'examples/agent-policy.yaml',
      'transcript-log should expose the policy fixture path without parsing command text',
    )
    assert.match(transcriptCheck?.policySha256 ?? '', hexSha256, 'transcript-log policySha256 should be lowercase SHA-256 hex')

    assert.deepEqual(
      Object.fromEntries(manifest.checks.map((check) => [check.surface, check.verdict])),
      {
        'pr-diff': 'REVIEW',
        'mcp-config': 'BLOCK',
        'transcript-log': 'REVIEW',
        'sarif-artifact': 'REVIEW',
      },
      'manifest should expose reviewer-ready verdicts for each evidence surface',
    )
  } finally {
    rmSync(evidenceDir, { recursive: true, force: true })
  }
})
