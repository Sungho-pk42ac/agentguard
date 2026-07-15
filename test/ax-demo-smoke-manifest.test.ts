import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(testDir, '..')
const hexSha256 = /^[0-9a-f]{64}$/

function normalizeManifestPath(path: string): string {
  return path.replace(/\\/g, '/')
}

function resolveManifestPath(path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(repoRoot, path)
}

function isPathInside(basePath: string, candidatePath: string): boolean {
  const relativePath = relative(basePath, candidatePath)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

function expectedRepositoryUrl(): string {
  try {
    return execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10_000,
    }).trim()
  } catch {
    const remoteConfig = execFileSync('git', ['config', '--get-regexp', '^remote\\..*\\.url$'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10_000,
    })
    const firstRemoteLine = remoteConfig
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean)
    assert.ok(firstRemoteLine, 'test repository should have at least one git remote URL')
    const url = firstRemoteLine.slice(firstRemoteLine.indexOf(' ') + 1).trim()
    assert.ok(url && url !== firstRemoteLine, 'test repository remote URL should be non-empty')
    return url
  }
}

function expectedGitBranch(): string {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10_000,
  }).trim()
  if (branch && branch !== 'HEAD') return branch

  const refName = process.env.GITHUB_REF_NAME?.trim()
  assert.ok(refName, 'detached HEAD smoke evidence should provide GITHUB_REF_NAME')
  return refName
}

function expectedGitTreeState(): 'clean' | 'dirty' {
  const porcelain = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10_000,
  }).trim()
  return porcelain.length === 0 ? 'clean' : 'dirty'
}

type SmokeManifest = {
  readonly schemaVersion: string
  readonly runId?: string
  readonly generatedBy: string
  readonly evidencePurpose: string
  readonly producerIntent?: string
  readonly replayCommand: string
  readonly replayWorkingDirectory: string
  readonly freshCloneSetup: readonly string[]
  readonly evidenceSurfaces?: readonly string[]
  readonly evidenceDirectory?: string
  readonly manifestPath?: string
  readonly requiredArtifacts?: readonly string[]
  readonly generatedAt?: string
  readonly cliPath?: string
  readonly cliSha256?: string
  readonly packageVersion?: string
  readonly repositoryUrl?: string
  readonly gitCommitSha: string
  readonly gitBranch?: string
  readonly gitTreeState?: 'clean' | 'dirty'
  readonly nodeVersion: string
  readonly platform: string
  readonly arch: string
  readonly summary?: SmokeManifestSummary
  readonly checks?: readonly SmokeManifestCheck[]
}

type SmokeManifestSummary = {
  readonly total?: number
  readonly pass?: number
  readonly review?: number
  readonly block?: number
  readonly acceptedNonZero?: number
}

type SmokeManifestCheck = {
  readonly surface?: string
  readonly command?: string
  readonly commandArgs?: readonly string[]
  readonly cwd?: string
  readonly inputPath?: string
  readonly policyPath?: string
  readonly exitCode?: number
  readonly expectedExitCode?: number
  readonly acceptedNonZero?: boolean
  readonly verdict?: string
  readonly expectedRuleIds?: readonly string[]
  readonly startedAt?: string
  readonly completedAt?: string
  readonly durationMs?: number
  readonly artifact?: string
  readonly ruleIds?: readonly string[]
  readonly sourceSha256?: string
  readonly artifactSha256?: string
  readonly policySha256?: string
  readonly sourceBytes?: number
  readonly artifactBytes?: number
  readonly policyBytes?: number
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
    assert.match(
      manifest.runId ?? '',
      /^ax-smoke-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}$/,
      'manifest should record a generated safe runId when AGENTGUARD_AX_DEMO_RUN_ID is not set',
    )
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
    assert.equal(
      manifest.producerIntent,
      'Reviewer source-of-record handoff for rerunnable AX smoke evidence; not approval, automatic upload, certification, scanner parity, or runtime authorization/session enforcement.',
      'manifest should state the producer intent and non-claim boundary for reviewer handoff',
    )
    assert.equal(
      manifest.replayCommand,
      'npm run smoke:ax-demo',
      'manifest should expose the top-level command that replays this evidence bundle',
    )
    assert.equal(
      manifest.replayWorkingDirectory,
      '.',
      'manifest should expose repo-root as the top-level replay working directory',
    )
    assert.deepEqual(
      manifest.freshCloneSetup,
      ['npm ci', 'npm run build'],
      'manifest should expose fresh-clone setup steps before replaying smoke evidence',
    )
    assert.deepEqual(
      manifest.evidenceSurfaces,
      ['pr-diff', 'mcp-config', 'transcript-log', 'sarif-artifact'],
      'manifest should expose top-level evidence surface coverage for quick reviewer handoff',
    )
    assert.ok(manifest.evidenceDirectory, 'manifest.evidenceDirectory should be present')
    assert.equal(
      normalizeManifestPath(manifest.evidenceDirectory),
      normalizeManifestPath(evidenceDir),
      'manifest should record the evidence directory that contains manifest.json and same-run artifacts',
    )
    const resolvedEvidenceDirectory = resolveManifestPath(manifest.evidenceDirectory)
    assert.equal(
      normalizeManifestPath(manifest.manifestPath ?? ''),
      normalizeManifestPath(join(manifest.evidenceDirectory, 'manifest.json')),
      'manifest should record the source-of-record manifest.json path inside the evidence directory',
    )
    assert.equal(
      resolveManifestPath(manifest.manifestPath ?? ''),
      join(resolvedEvidenceDirectory, 'manifest.json'),
      'manifestPath should resolve to manifest.json within the same evidenceDirectory',
    )
    assert.ok(
      (manifest.checks ?? []).every(
        (check) => !check.artifact || isPathInside(resolvedEvidenceDirectory, resolveManifestPath(check.artifact)),
      ),
      'manifest artifact paths should live under the manifest evidenceDirectory source-of-record',
    )
    assert.deepEqual(
      manifest.requiredArtifacts,
      (manifest.checks ?? []).map((check) => check.artifact),
      'manifest should expose top-level requiredArtifacts derived from checks[].artifact in order',
    )
    assert.ok(
      (manifest.requiredArtifacts ?? []).every((artifact) =>
        isPathInside(resolvedEvidenceDirectory, resolveManifestPath(artifact)),
      ),
      'manifest requiredArtifacts should resolve inside the evidenceDirectory source-of-record',
    )
    assert.match(
      manifest.generatedAt ?? '',
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      'manifest generatedAt should record bundle-level ISO-8601 UTC freshness',
    )
    const manifestGeneratedAtMs = Date.parse(manifest.generatedAt ?? '')
    assert.ok(Number.isFinite(manifestGeneratedAtMs), 'manifest generatedAt should be parseable')
    assert.ok(
      (manifest.checks ?? []).every((check) => Date.parse(check.startedAt ?? '') <= manifestGeneratedAtMs),
      'manifest generatedAt should not precede per-check startedAt timestamps',
    )
    assert.ok(
      (manifest.checks ?? []).every((check) => Date.parse(check.completedAt ?? '') <= manifestGeneratedAtMs),
      'manifest generatedAt should not precede per-check completedAt timestamps',
    )
    assert.equal(manifest.cliPath, 'dist/index.js', 'manifest should name the built CLI artifact used for the smoke')
    assert.match(manifest.cliSha256 ?? '', hexSha256, 'manifest cliSha256 should be lowercase SHA-256 hex')
    assert.match(manifest.packageVersion ?? '', /^\d+\.\d+\.\d+/, 'manifest should record package.json version')
    const expectedRemoteUrl = expectedRepositoryUrl()
    assert.equal(
      manifest.repositoryUrl,
      expectedRemoteUrl,
      'manifest should record the repository remote URL that produced this evidence bundle',
    )
    assert.match(
      manifest.repositoryUrl ?? '',
      /^(?:https:\/\/github\.com\/[^/\s]+\/agentguard(?:\.git)?\/?|git@github\.com:[^/\s]+\/agentguard(?:\.git)?|ssh:\/\/git@github\.com\/[^/\s]+\/agentguard(?:\.git)?\/?)$/,
      'manifest repositoryUrl should point at a GitHub AgentGuard repository origin without parsing prose docs',
    )
    assert.match(manifest.gitCommitSha ?? '', /^[0-9a-f]{40}$/, 'manifest should record the git commit SHA used for smoke evidence')
    assert.equal(
      manifest.gitBranch,
      expectedGitBranch(),
      'manifest should record the git branch/ref that produced the smoke evidence',
    )
    assert.match(
      manifest.gitBranch ?? '',
      /^[A-Za-z0-9._\/-]+$/,
      'manifest gitBranch should be a safe branch/ref string for reviewer handoff',
    )
    assert.equal(
      manifest.gitTreeState,
      expectedGitTreeState(),
      'manifest should record whether tracked source files were clean or dirty when smoke evidence was produced',
    )
    assert.match(manifest.gitTreeState ?? '', /^(clean|dirty)$/, 'manifest gitTreeState should be clean or dirty')
    assert.equal(manifest.nodeVersion, process.version, 'manifest should record the exact Node.js runtime version')
    assert.match(manifest.nodeVersion ?? '', /^v\d+\.\d+\.\d+/, 'manifest nodeVersion should be a safe Node semver string')
    assert.equal(manifest.platform, process.platform, 'manifest should record the exact Node.js platform')
    assert.equal(typeof manifest.platform, 'string', 'manifest platform should be a string')
    assert.ok((manifest.platform ?? '').length > 0, 'manifest platform should be non-empty')
    assert.equal(manifest.arch, process.arch, 'manifest should record the exact Node.js architecture')
    assert.equal(typeof manifest.arch, 'string', 'manifest arch should be a string')
    assert.ok((manifest.arch ?? '').length > 0, 'manifest arch should be non-empty')
    assert.ok(Array.isArray(manifest.checks), 'manifest.checks should be an array')
    assert.equal(manifest.checks.length, 4, 'manifest should cover PR diff, MCP config, transcript/log, and SARIF')
    assert.deepEqual(
      manifest.evidenceSurfaces,
      manifest.checks.map((check) => check.surface),
      'manifest evidenceSurfaces should be derived from checks[] surface order',
    )
    assert.deepEqual(
      manifest.summary,
      {
        total: manifest.checks.length,
        pass: manifest.checks.filter((check) => check.verdict === 'PASS').length,
        review: manifest.checks.filter((check) => check.verdict === 'REVIEW').length,
        block: manifest.checks.filter((check) => check.verdict === 'BLOCK').length,
        acceptedNonZero: manifest.checks.filter((check) => check.acceptedNonZero === true).length,
      },
      'manifest summary should be derived from checks for reviewer/CI source-of-record use',
    )

    for (const check of manifest.checks) {
      assert.equal(typeof check.surface, 'string', 'surface should stay present')
      assert.equal(typeof check.command, 'string', `${check.surface ?? 'check'} command should stay present`)
      assert.ok(Array.isArray(check.commandArgs), `${check.surface ?? 'check'} commandArgs should stay present`)
      assert.equal(check.commandArgs?.[0], 'node', `${check.surface ?? 'check'} commandArgs should describe the node CLI runner`)
      assert.equal(check.commandArgs?.[1], 'dist/index.js', `${check.surface ?? 'check'} commandArgs should name the built CLI`)
      assert.equal(check.cwd, '.', `${check.surface ?? 'check'} cwd should record repo-root replay working directory`)
      assert.equal(typeof check.inputPath, 'string', `${check.surface ?? 'check'} inputPath should stay present`)
      assert.equal(typeof check.exitCode, 'number', `${check.surface ?? 'check'} exitCode should stay present`)
      assert.equal(
        typeof check.expectedExitCode,
        'number',
        `${check.surface ?? 'check'} expectedExitCode should expose the acceptance contract`,
      )
      assert.equal(
        check.exitCode,
        check.expectedExitCode,
        `${check.surface ?? 'check'} observed exitCode should match expectedExitCode`,
      )
      assert.equal(typeof check.acceptedNonZero, 'boolean', `${check.surface ?? 'check'} acceptedNonZero should stay present`)
      assert.match(check.verdict ?? '', /^(PASS|REVIEW|BLOCK)$/, `${check.surface ?? 'check'} verdict should be present`)
      assert.ok(Array.isArray(check.expectedRuleIds), `${check.surface ?? 'check'} expectedRuleIds should stay present`)
      assert.deepEqual(
        [...(check.expectedRuleIds ?? [])].sort(),
        check.expectedRuleIds,
        `${check.surface ?? 'check'} expectedRuleIds should be sorted for stable reviewer handoff`,
      )
      assert.ok(
        (check.expectedRuleIds ?? []).every((ruleId) => check.ruleIds?.includes(ruleId)),
        `${check.surface ?? 'check'} observed ruleIds should include every expectedRuleId`,
      )
      assert.match(
        check.startedAt ?? '',
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        `${check.surface ?? 'check'} startedAt should be an ISO-8601 UTC timestamp`,
      )
      assert.match(
        check.completedAt ?? '',
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        `${check.surface ?? 'check'} completedAt should be an ISO-8601 UTC timestamp`,
      )
      assert.ok(
        Date.parse(check.completedAt ?? '') >= Date.parse(check.startedAt ?? ''),
        `${check.surface ?? 'check'} completedAt should not be earlier than startedAt`,
      )
      assert.equal(typeof check.durationMs, 'number', `${check.surface ?? 'check'} durationMs should stay present`)
      assert.ok(Number.isInteger(check.durationMs), `${check.surface ?? 'check'} durationMs should be an integer`)
      assert.ok((check.durationMs ?? -1) >= 0, `${check.surface ?? 'check'} durationMs should be non-negative`)
      assert.equal(typeof check.artifact, 'string', `${check.surface ?? 'check'} artifact should stay present`)
      assert.ok(Array.isArray(check.ruleIds), `${check.surface ?? 'check'} ruleIds should stay present`)
      assert.match(check.sourceSha256 ?? '', hexSha256, `${check.surface ?? 'check'} sourceSha256 should be lowercase SHA-256 hex`)
      assert.match(
        check.artifactSha256 ?? '',
        hexSha256,
        `${check.surface ?? 'check'} artifactSha256 should be lowercase SHA-256 hex`,
      )
      assert.equal(typeof check.sourceBytes, 'number', `${check.surface ?? 'check'} sourceBytes should be present`)
      assert.ok(Number.isInteger(check.sourceBytes), `${check.surface ?? 'check'} sourceBytes should be an integer`)
      assert.ok((check.sourceBytes ?? 0) > 0, `${check.surface ?? 'check'} sourceBytes should be positive`)
      assert.equal(typeof check.artifactBytes, 'number', `${check.surface ?? 'check'} artifactBytes should be present`)
      assert.ok(Number.isInteger(check.artifactBytes), `${check.surface ?? 'check'} artifactBytes should be an integer`)
      assert.ok((check.artifactBytes ?? 0) > 0, `${check.surface ?? 'check'} artifactBytes should be positive`)
    }

    const transcriptCheck = manifest.checks.find((check) => check.surface === 'transcript-log')
    assert.equal(
      transcriptCheck?.policyPath,
      'examples/agent-policy.yaml',
      'transcript-log should expose the policy fixture path without parsing command text',
    )
    assert.match(transcriptCheck?.policySha256 ?? '', hexSha256, 'transcript-log policySha256 should be lowercase SHA-256 hex')
    assert.equal(typeof transcriptCheck?.policyBytes, 'number', 'transcript-log policyBytes should be present')
    assert.ok(Number.isInteger(transcriptCheck?.policyBytes), 'transcript-log policyBytes should be an integer')
    assert.ok((transcriptCheck?.policyBytes ?? 0) > 0, 'transcript-log policyBytes should be positive')

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

    const explicitRunEvidenceDir = mkdtempSync(join(tmpdir(), 'agentguard-ax-smoke-runid-'))
    try {
      execFileSync(process.execPath, [join(repoRoot, 'scripts', 'ax-demo-smoke.mjs')], {
        cwd: repoRoot,
        env: {
          ...process.env,
          AGENTGUARD_AX_DEMO_EVIDENCE_DIR: explicitRunEvidenceDir,
          AGENTGUARD_AX_DEMO_RUN_ID: 'cron:20260713T130000Z.issue-537',
        },
        stdio: 'pipe',
        timeout: 120_000,
      })

      const explicitRunManifest = JSON.parse(
        readFileSync(join(explicitRunEvidenceDir, 'manifest.json'), 'utf8'),
      ) as SmokeManifest
      assert.equal(
        explicitRunManifest.runId,
        'cron:20260713T130000Z.issue-537',
        'manifest should preserve caller-provided AGENTGUARD_AX_DEMO_RUN_ID exactly',
      )
    } finally {
      rmSync(explicitRunEvidenceDir, { recursive: true, force: true })
    }
  } finally {
    rmSync(evidenceDir, { recursive: true, force: true })
  }
})
