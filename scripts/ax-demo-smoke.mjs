#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliRelativePath = 'dist/index.js'
const cliPath = repoPath(cliRelativePath)
const evidenceDir = process.env.AGENTGUARD_AX_DEMO_EVIDENCE_DIR
  ? resolve(process.env.AGENTGUARD_AX_DEMO_EVIDENCE_DIR)
  : join(repoRoot, '.agentguard-demo', 'ax-evidence-smoke')

const prDiffInputPath = 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff'

const checks = [
  {
    surface: 'pr-diff',
    args: ['scan-diff', '--json'],
    inputPath: prDiffInputPath,
    artifactName: 'pr-diff-findings.json',
    expectedStatus: 1,
    expectedRuleIds: ['generic-secret-assignment', 'denied-command'],
  },
  {
    surface: 'mcp-config',
    args: ['scan-mcp', '--json'],
    inputPath: 'examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json',
    artifactName: 'mcp-config-findings.json',
    expectedStatus: 1,
    expectedRuleIds: ['mcp-filesystem-wide-root', 'mcp-filesystem-writable-path', 'mcp-env-token'],
  },
  {
    surface: 'transcript-log',
    args: ['scan-log', '--json', '--policy', 'examples/agent-policy.yaml'],
    inputPath: 'examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log',
    policyPath: 'examples/agent-policy.yaml',
    artifactName: 'transcript-log-findings.json',
    expectedStatus: 0,
    expectedRuleIds: ['denied-command'],
  },
]

const publicReferenceSignals = [
  {
    source: 'MCP Security Best Practices',
    url: 'https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices',
    borrow: 'Least-privilege, explicit consent, token-boundary, and tool-boundary language for MCP config review.',
    avoid:
      'Do not claim AgentGuard enforces live MCP consent, runtime OAuth/session policy, token policy, or MCP conformance.',
    agentGuardAction:
      'Route the signal to the mcp-config smoke row and static MCP config approval evidence.',
  },
  {
    source: 'GitHub SARIF upload docs',
    url: 'https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github',
    borrow: 'Reviewer artifact handoff and code scanning upload vocabulary for SARIF evidence.',
    avoid: 'Do not claim automatic SARIF upload, GitHub-native triage, or external approval.',
    agentGuardAction:
      'Route the signal to the sarif-artifact smoke row and reviewer-owned upload/archive handoff.',
  },
  {
    source: 'Claude Code Security',
    url: 'https://docs.anthropic.com/en/docs/claude-code/security',
    borrow: 'Workspace trust, tool permission review, and human approval boundary wording.',
    avoid: 'Do not imply Anthropic approval, private workspace access, or sandbox/runtime guarantees.',
    agentGuardAction:
      'Route the signal to transcript/log and MCP approval-owner review before rollout.',
  },
  {
    source: 'agent-scan registry fallback',
    url: 'https://registry.npmjs.org/agent-scan/latest',
    borrow:
      'Public registry category-pressure signal for AI-agent activity scanning when the npmjs web page returned HTTP 403.',
    avoid: 'Do not claim adoption, maturity, scanner parity, replacement, or package-quality proof from metadata alone.',
    agentGuardAction:
      'Keep AgentGuard differentiation on rerunnable PR diff, MCP config, transcript/log, and SARIF source-of-record evidence.',
  },
]

const approvalDecisionMap = {
  PASS: {
    approvalAction: 'accept',
    koreanHandoff: 'PASS는 현재 증거 기준으로 배포 승인 가능 후보입니다.',
    reviewerNextStep: 'Verify freshness, artifact hashes, and policy scope before final approval.',
  },
  REVIEW: {
    approvalAction: 'conditional-review',
    koreanHandoff: 'REVIEW는 담당자 조건부 검토와 수정 조건 합의가 필요한 후보입니다.',
    reviewerNextStep: 'Assign an approval owner, inspect findings, apply fix/policy conditions, then rerun evidence.',
  },
  BLOCK: {
    approvalAction: 'block-rollout',
    koreanHandoff: 'BLOCK은 rollout 중지 후 수정 또는 정책 변경 전까지 승인하면 안 되는 후보입니다.',
    reviewerNextStep: 'Stop rollout, fix or tighten policy, regenerate artifacts, and require a fresh PASS/REVIEW decision.',
  },
}

const approvalOwnerRoutes = [
  {
    surface: 'pr-diff',
    ownerRole: 'code-review-owner',
    reviewerChannel: 'PR comment plus JSON findings artifact',
    decisionCondition: 'Review risky diff findings and approve only after secrets or denied commands are removed or explicitly justified.',
    rerunTrigger: 'Rerun npm run smoke:ax-demo whenever the PR diff fixture, policy scope, or generated findings artifact changes.',
  },
  {
    surface: 'mcp-config',
    ownerRole: 'security-approval-owner',
    reviewerChannel: 'MCP config review packet plus mcp-config findings artifact',
    decisionCondition: 'Block rollout until broad filesystem roots, writable paths, and env-token exposure have an owner-approved mitigation.',
    rerunTrigger: 'Rerun npm run smoke:ax-demo whenever MCP server config, allowlist policy, or risk ownership changes.',
  },
  {
    surface: 'transcript-log',
    ownerRole: 'agent-operations-owner',
    reviewerChannel: 'Transcript/log reviewer note plus policy-backed findings artifact',
    decisionCondition: 'Keep REVIEW until the denied-command evidence has an accountable operator decision and rerunnable policy proof.',
    rerunTrigger: 'Rerun npm run smoke:ax-demo whenever transcript evidence or examples/agent-policy.yaml changes.',
  },
  {
    surface: 'sarif-artifact',
    ownerRole: 'ci-security-reviewer',
    reviewerChannel: 'SARIF artifact archive or reviewer-owned GitHub code scanning upload step',
    decisionCondition: 'Use SARIF as machine-readable reviewer handoff; approval still depends on owner inspection and matching manifest evidence.',
    rerunTrigger: 'Rerun npm run smoke:ax-demo whenever SARIF output path, PR diff evidence, or CI artifact retention changes.',
  },
]

if (!existsSync(cliPath)) {
  fail(`Built CLI not found at ${cliPath}. Run: npm run build`)
}

mkdirSync(evidenceDir, { recursive: true })

const bundleStartedAt = new Date().toISOString()
const bundleStartedAtMs = performance.now()
const manifest = []
for (const check of checks) {
  const sourcePath = repoPath(check.inputPath)
  const startedAt = new Date().toISOString()
  const startedAtMs = performance.now()
  const result = runCli(check.args, check.inputPath)
  const durationMs = Math.round(performance.now() - startedAtMs)
  const completedAt = new Date().toISOString()
  const artifactPath = join(evidenceDir, check.artifactName)
  writeFileSync(artifactPath, result.stdout)

  ensure(
    result.status === check.expectedStatus,
    `${check.surface}: expected exit ${check.expectedStatus}, got ${result.status}. stderr=${result.stderr}`,
  )

  const findings = parseFindings(result.stdout, check.surface)
  const ruleIds = new Set(findings.map((finding) => finding.id))
  for (const ruleId of check.expectedRuleIds) {
    ensure(ruleIds.has(ruleId), `${check.surface}: missing expected rule ${ruleId}`)
  }

  manifest.push({
    surface: check.surface,
    command: `node dist/index.js ${check.args.join(' ')} < ${check.inputPath}`,
    commandArgs: ['node', cliRelativePath, ...check.args],
    cwd: '.',
    inputPath: check.inputPath,
    ...(check.policyPath ? { policyPath: check.policyPath } : {}),
    exitCode: result.status,
    expectedExitCode: check.expectedStatus,
    acceptedNonZero: result.status !== 0,
    ...(result.status !== 0
      ? {
          acceptedNonZeroReason:
            'Expected risky fixture evidence: observed non-zero exit matches expectedExitCode and preserves REVIEW/BLOCK handoff proof.',
        }
      : {}),
    verdict: verdictForFindings(findings),
    startedAt,
    completedAt,
    durationMs,
    artifact: relativeArtifactPath(artifactPath),
    sourceSha256: sha256File(sourcePath),
    artifactSha256: sha256File(artifactPath),
    sourceBytes: byteSize(sourcePath),
    artifactBytes: byteSize(artifactPath),
    ...(check.policyPath ? { policySha256: sha256File(repoPath(check.policyPath)), policyBytes: byteSize(repoPath(check.policyPath)) } : {}),
    expectedRuleIds: [...check.expectedRuleIds].sort(),
    ruleIds: [...ruleIds].sort(),
  })
}

const sarifPath = join(evidenceDir, 'agentguard.sarif')
ensure(checks.length > 0, 'sarif: at least one source check is required')
const sarifStartedAt = new Date().toISOString()
const sarifStartedAtMs = performance.now()
const sarifResult = runCli(['scan-diff', '--sarif', '--out', sarifPath], checks[0].inputPath)
const sarifDurationMs = Math.round(performance.now() - sarifStartedAtMs)
const sarifCompletedAt = new Date().toISOString()
ensure(sarifResult.status === 1, `sarif: expected exit 1 for risky PR diff, got ${sarifResult.status}. stderr=${sarifResult.stderr}`)
const sarif = parseSarif(readFileSync(sarifPath, 'utf8'))
const sarifRuleIds = new Set(sarif.runs.flatMap((run) => run.results.map((result) => result.ruleId)))
ensure(sarif.version === '2.1.0', `sarif: expected version 2.1.0, got ${sarif.version}`)
ensure(sarifRuleIds.has('generic-secret-assignment'), 'sarif: missing generic-secret-assignment result')
ensure(sarifRuleIds.has('denied-command'), 'sarif: missing denied-command result')
manifest.push({
  surface: 'sarif-artifact',
  command: `node dist/index.js scan-diff --sarif --out ${relativeArtifactPath(sarifPath)} < ${checks[0].inputPath}`,
  commandArgs: ['node', cliRelativePath, 'scan-diff', '--sarif', '--out', relativeArtifactPath(sarifPath)],
  cwd: '.',
  inputPath: checks[0].inputPath,
  exitCode: sarifResult.status,
  expectedExitCode: checks[0].expectedStatus,
  acceptedNonZero: true,
  acceptedNonZeroReason:
    'Expected risky fixture evidence: observed non-zero exit matches expectedExitCode and preserves REVIEW/BLOCK handoff proof.',
  verdict: manifest.find((item) => item.surface === 'pr-diff')?.verdict ?? 'BLOCK',
  startedAt: sarifStartedAt,
  completedAt: sarifCompletedAt,
  durationMs: sarifDurationMs,
  artifact: relativeArtifactPath(sarifPath),
  sourceSha256: sha256File(repoPath(prDiffInputPath)),
  artifactSha256: sha256File(sarifPath),
  sourceBytes: byteSize(repoPath(prDiffInputPath)),
  artifactBytes: byteSize(sarifPath),
  expectedRuleIds: [...checks[0].expectedRuleIds].sort(),
  ruleIds: [...sarifRuleIds].sort(),
})

const manifestPath = join(evidenceDir, 'manifest.json')
const packageJson = parseJson(readFileSync(repoPath('package.json'), 'utf8'), 'package.json')
ensure(isObject(packageJson), 'package.json: root must be an object')
const packageName = packageJson.name
ensure(typeof packageName === 'string' && packageName.length > 0, 'package.json: name must be a non-empty string')
const packageVersion = packageJson.version
ensure(typeof packageVersion === 'string' && packageVersion.length > 0, 'package.json: version must be a non-empty string')
const npmVersion = currentNpmVersion()
const ciRun = githubActionsCiRun()
const bundleCompletedAt = new Date().toISOString()
const bundleDurationMs = Math.round(performance.now() - bundleStartedAtMs)
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      schemaVersion: '1.0.0',
      runId: smokeRunId(),
      generatedBy: 'agentguard ax-demo-smoke',
      evidencePurpose:
        'AX Rollout Guard fixture-backed smoke evidence for PR diff, MCP config, transcript/log, and SARIF reviewer handoff',
      producerIntent:
        'Reviewer source-of-record handoff for rerunnable AX smoke evidence; not approval, automatic upload, certification, scanner parity, or runtime authorization/session enforcement.',
      claimBoundaries: [
        'Not approval evidence by itself; reviewers must inspect checks, artifacts, and rerun commands.',
        'Does not automatically upload SARIF or own GitHub code-scanning workflow execution.',
        'Does not implement runtime MCP authorization, OAuth/session enforcement, or consent UI.',
        'Does not claim parity, replacement, certification, customer adoption, or vendor-scale scanner coverage.',
      ],
      publicReferenceSignals,
      approvalDecisionMap,
      approvalOwnerRoutes,
      replayCommand: 'npm run smoke:ax-demo',
      replayCommandArgs: ['npm', 'run', 'smoke:ax-demo'],
      replayWorkingDirectory: '.',
      freshCloneSetup: ['npm ci', 'npm run build'],
      evidenceSurfaces: manifest.map((item) => item.surface),
      evidenceDirectory: relativeArtifactPath(evidenceDir),
      manifestPath: relativeArtifactPath(manifestPath),
      requiredArtifacts: manifest.map((item) => item.artifact),
      requiredSources: requiredSources(manifest),
      startedAt: bundleStartedAt,
      completedAt: bundleCompletedAt,
      durationMs: bundleDurationMs,
      generatedAt: new Date().toISOString(),
      cliPath: cliRelativePath,
      cliSha256: sha256File(cliPath),
      packageName,
      packageVersion,
      npmVersion,
      packageManager: `npm@${npmVersion}`,
      packageLockSha256: sha256File(repoPath('package-lock.json')),
      repositoryUrl: repositoryOriginUrl(),
      gitCommitSha: currentGitCommitSha(),
      gitBranch: currentGitBranch(),
      gitTreeState: currentGitTreeState(),
      ...(ciRun ? { ciRun } : {}),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      summary: summarizeChecks(manifest),
      checks: manifest,
    },
    null,
    2,
  )}\n`,
)

console.log(`AX demo smoke passed: ${relativeArtifactPath(manifestPath)}`)
for (const item of manifest) {
  console.log(`- ${item.surface}: exit ${item.exitCode}, rules ${item.ruleIds.join(', ')}`)
}

function runCli(args, inputPath) {
  const fullInputPath = repoPath(inputPath)
  if (!existsSync(fullInputPath)) {
    fail(`Required fixture input not found at: ${inputPath}`)
  }
  const input = readFileSync(fullInputPath)
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
  })
  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error)
    fail(`Process failed to start: ${message}`)
  }
  if (result.signal) {
    fail(`Process terminated due to signal: ${result.signal}. stderr=${result.stderr}`)
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function repoPath(path) {
  return join(repoRoot, path)
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function byteSize(path) {
  const stat = statSync(path)
  if (!stat.isFile()) {
    fail(`Expected a regular file for byte-size provenance: ${path}`)
  }
  return stat.size
}

function summarizeChecks(checks) {
  return checks.reduce(
    (summary, check) => {
      summary.total += 1
      if (check.verdict === 'PASS') summary.pass += 1
      if (check.verdict === 'REVIEW') summary.review += 1
      if (check.verdict === 'BLOCK') summary.block += 1
      if (check.acceptedNonZero === true) summary.acceptedNonZero += 1
      return summary
    },
    { total: 0, pass: 0, review: 0, block: 0, acceptedNonZero: 0 },
  )
}

function requiredSources(checks) {
  const sources = []
  for (const check of checks) {
    for (const source of [check.inputPath, check.policyPath]) {
      if (typeof source === 'string' && source.length > 0 && !sources.includes(source)) {
        sources.push(source)
      }
    }
  }
  return sources
}

function smokeRunId() {
  const configuredRunId = process.env.AGENTGUARD_AX_DEMO_RUN_ID?.trim()
  if (configuredRunId) {
    ensure(
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(configuredRunId),
      'AGENTGUARD_AX_DEMO_RUN_ID must be 1-128 characters and use only letters, numbers, dot, underscore, colon, or dash',
    )
    return configuredRunId
  }
  return `ax-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`
}

function repositoryOriginUrl() {
  const originResult = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (originResult.error) {
    const message = originResult.error instanceof Error ? originResult.error.message : String(originResult.error)
    fail(`repository URL could not be read: ${message}`)
  }
  if (originResult.status === 0) {
    const originUrl = originResult.stdout.trim()
    ensure(originUrl.length > 0, 'repository origin URL must be non-empty')
    return originUrl
  }

  const remotesResult = spawnSync('git', ['config', '--get-regexp', '^remote\\..*\\.url$'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (remotesResult.error) {
    const message = remotesResult.error instanceof Error ? remotesResult.error.message : String(remotesResult.error)
    fail(`repository URL could not be read: ${message}`)
  }
  if (remotesResult.status !== 0) {
    fail(`repository URL could not be read. stderr=${originResult.stderr || remotesResult.stderr}`)
  }
  const firstRemoteLine = remotesResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  ensure(firstRemoteLine, 'repository URL must include at least one configured git remote')
  const url = firstRemoteLine.slice(firstRemoteLine.indexOf(' ') + 1).trim()
  ensure(url.length > 0 && url !== firstRemoteLine, 'repository URL must be non-empty')
  return url
}

function currentGitCommitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error)
    fail(`git commit SHA could not be read: ${message}`)
  }
  if (result.status !== 0) {
    fail(`git commit SHA could not be read. stderr=${result.stderr}`)
  }
  const sha = result.stdout.trim()
  ensure(/^[0-9a-f]{40}$/.test(sha), `git commit SHA must be a 40-character lowercase hex SHA, got: ${sha}`)
  return sha
}

function currentNpmVersion() {
  const versionFromUserAgent = npmVersionFromUserAgent(process.env.npm_config_user_agent)
  if (versionFromUserAgent) return versionFromUserAgent

  const result = spawnSync(npmCommand(), ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 10_000,
  })
  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error)
    fail(`npm version could not be read: ${message}`)
  }
  if (result.status !== 0) {
    fail(`npm version could not be read. stderr=${result.stderr}`)
  }
  const version = result.stdout.trim()
  ensure(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version), `npm version must be semver-like, got: ${version}`)
  return version
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function npmVersionFromUserAgent(userAgent) {
  if (typeof userAgent !== 'string') return undefined
  const match = userAgent.match(/(?:^|\s)npm\/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)(?:\s|$)/)
  return match?.[1]
}

function currentGitBranch() {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error)
    fail(`git branch could not be read: ${message}`)
  }
  if (result.status !== 0) {
    fail(`git branch could not be read. stderr=${result.stderr}`)
  }

  const branch = result.stdout.trim()
  const branchOrRef = branch && branch !== 'HEAD' ? branch : process.env.GITHUB_REF_NAME?.trim()
  ensure(typeof branchOrRef === 'string' && branchOrRef.length > 0, 'git branch/ref name must be non-empty')
  ensure(
    /^[A-Za-z0-9._\/-]+$/.test(branchOrRef),
    `git branch/ref name must contain only safe reviewer-handoff characters, got: ${branchOrRef}`,
  )
  return branchOrRef
}

function currentGitTreeState() {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.error) {
    const message = result.error instanceof Error ? result.error.message : String(result.error)
    fail(`git tree state could not be read: ${message}`)
  }
  if (result.status !== 0) {
    fail(`git tree state could not be read. stderr=${result.stderr}`)
  }
  return result.stdout.trim().length === 0 ? 'clean' : 'dirty'
}

function githubActionsCiRun() {
  if (process.env.GITHUB_ACTIONS !== 'true') return undefined

  const ciRun = compactObject({
    serverUrl: safeCiString(process.env.GITHUB_SERVER_URL),
    repository: safeCiString(process.env.GITHUB_REPOSITORY),
    runId: safeCiString(process.env.GITHUB_RUN_ID),
    runAttempt: safeCiString(process.env.GITHUB_RUN_ATTEMPT),
    workflow: safeCiString(process.env.GITHUB_WORKFLOW),
    ref: safeCiString(process.env.GITHUB_REF),
    sha: safeCiString(process.env.GITHUB_SHA),
  })
  ensure(Object.keys(ciRun).length > 0, 'GitHub Actions CI provenance requires at least one safe GITHUB_* value')
  return ciRun
}

function safeCiString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  ensure(!/[\r\n\t\u0000-\u001f\u007f]/.test(trimmed), 'CI provenance values must not contain control characters')
  ensure(trimmed.length <= 512, 'CI provenance values must be at most 512 characters')
  return trimmed
}

function compactObject(entries) {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => typeof value === 'string' && value.length > 0))
}

function parseFindings(stdout, surface) {
  const parsed = parseJson(stdout, surface)
  ensure(Array.isArray(parsed), `${surface}: JSON output must be an array`)
  return parsed.map((item) => {
    ensure(isObject(item), `${surface}: finding must be an object`)
    const id = item.id
    ensure(typeof id === 'string' && id.length > 0, `${surface}: finding.id must be a non-empty string`)
    const severityValue = item.severity
    ensure(typeof severityValue === 'string' && severityValue.length > 0, `${surface}: finding.severity must be a non-empty string`)
    const severity = severityValue.toLowerCase()
    ensure(
      ['low', 'medium', 'high', 'critical'].includes(severity),
      `${surface}: finding.severity must be one of low, medium, high, or critical`,
    )
    return { id, severity }
  })
}

function verdictForFindings(findings) {
  const severityWeight = { low: 1, medium: 2, high: 3, critical: 4 }
  const score = findings.reduce((sum, finding) => sum + (severityWeight[finding.severity] ?? 0), 0)
  if (score === 0) return 'PASS'
  if (score >= 8) return 'BLOCK'
  return 'REVIEW'
}

function parseSarif(text) {
  const parsed = parseJson(text, 'sarif')
  ensure(isObject(parsed), 'sarif: root must be an object')
  const version = parsed.version
  ensure(typeof version === 'string', 'sarif: version must be a string')
  const runsValue = parsed.runs
  ensure(Array.isArray(runsValue), 'sarif: runs must be an array')
  const runs = runsValue.map((run) => {
    ensure(isObject(run), 'sarif: run must be an object')
    const resultsValue = run.results
    ensure(Array.isArray(resultsValue), 'sarif: results must be an array')
    return {
      results: resultsValue.map((result) => {
        ensure(isObject(result), 'sarif: result must be an object')
        const ruleId = result.ruleId
        ensure(typeof ruleId === 'string' && ruleId.length > 0, 'sarif: result.ruleId must be a non-empty string')
        return { ruleId }
      }),
    }
  })
  return { version, runs }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(`${label}: could not parse JSON: ${message}`)
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function relativeArtifactPath(path) {
  const relativePath = path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path
  return relativePath.replace(/\\/g, '/')
}

function ensure(condition, message) {
  if (!condition) fail(message)
}

function fail(message) {
  console.error(`AX demo smoke failed: ${message}`)
  process.exit(1)
}
