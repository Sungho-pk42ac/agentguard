#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

if (!existsSync(cliPath)) {
  fail(`Built CLI not found at ${cliPath}. Run: npm run build`)
}

mkdirSync(evidenceDir, { recursive: true })

const manifest = []
for (const check of checks) {
  const sourcePath = repoPath(check.inputPath)
  const result = runCli(check.args, check.inputPath)
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
    inputPath: check.inputPath,
    ...(check.policyPath ? { policyPath: check.policyPath } : {}),
    exitCode: result.status,
    acceptedNonZero: result.status !== 0,
    verdict: verdictForFindings(findings),
    artifact: relativeArtifactPath(artifactPath),
    sourceSha256: sha256File(sourcePath),
    artifactSha256: sha256File(artifactPath),
    ...(check.policyPath ? { policySha256: sha256File(repoPath(check.policyPath)) } : {}),
    ruleIds: [...ruleIds].sort(),
  })
}

const sarifPath = join(evidenceDir, 'agentguard.sarif')
ensure(checks.length > 0, 'sarif: at least one source check is required')
const sarifResult = runCli(['scan-diff', '--sarif', '--out', sarifPath], checks[0].inputPath)
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
  inputPath: checks[0].inputPath,
  exitCode: sarifResult.status,
  acceptedNonZero: true,
  verdict: manifest.find((item) => item.surface === 'pr-diff')?.verdict ?? 'BLOCK',
  artifact: relativeArtifactPath(sarifPath),
  sourceSha256: sha256File(repoPath(prDiffInputPath)),
  artifactSha256: sha256File(sarifPath),
  ruleIds: [...sarifRuleIds].sort(),
})

const manifestPath = join(evidenceDir, 'manifest.json')
const packageJson = parseJson(readFileSync(repoPath('package.json'), 'utf8'), 'package.json')
ensure(isObject(packageJson), 'package.json: root must be an object')
const packageVersion = packageJson.version
ensure(typeof packageVersion === 'string' && packageVersion.length > 0, 'package.json: version must be a non-empty string')
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      cliPath: cliRelativePath,
      cliSha256: sha256File(cliPath),
      packageVersion,
      gitCommitSha: currentGitCommitSha(),
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
