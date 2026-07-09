#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliPath = join(repoRoot, 'dist', 'index.js')
const evidenceDir = process.env.AGENTGUARD_AX_DEMO_EVIDENCE_DIR
  ? resolve(process.env.AGENTGUARD_AX_DEMO_EVIDENCE_DIR)
  : join(repoRoot, '.agentguard-demo', 'ax-evidence-smoke')

const checks = [
  {
    surface: 'pr-diff',
    args: ['scan-diff', '--json'],
    inputPath: 'examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff',
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
    exitCode: result.status,
    acceptedNonZero: result.status !== 0,
    artifact: relativeArtifactPath(artifactPath),
    ruleIds: [...ruleIds].sort(),
  })
}

const sarifPath = join(evidenceDir, 'agentguard.sarif')
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
  exitCode: sarifResult.status,
  acceptedNonZero: true,
  artifact: relativeArtifactPath(sarifPath),
  ruleIds: [...sarifRuleIds].sort(),
})

const manifestPath = join(evidenceDir, 'manifest.json')
writeFileSync(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), checks: manifest }, null, 2)}\n`)

console.log(`AX demo smoke passed: ${relativeArtifactPath(manifestPath)}`)
for (const item of manifest) {
  console.log(`- ${item.surface}: exit ${item.exitCode}, rules ${item.ruleIds.join(', ')}`)
}

function runCli(args, inputPath) {
  const fullInputPath = join(repoRoot, inputPath)
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

function parseFindings(stdout, surface) {
  const parsed = parseJson(stdout, surface)
  ensure(Array.isArray(parsed), `${surface}: JSON output must be an array`)
  return parsed.map((item) => {
    ensure(isObject(item), `${surface}: finding must be an object`)
    const id = item.id
    ensure(typeof id === 'string' && id.length > 0, `${surface}: finding.id must be a non-empty string`)
    return { id }
  })
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
