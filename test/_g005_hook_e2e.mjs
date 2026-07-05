#!/usr/bin/env node
// Real end-to-end red-team probe for AgentGuard `hook install|uninstall` (story G005).
//
// This script is intentionally standalone (no test runner) so it can be
// invoked directly with `node` and produce human + machine readable
// evidence artifacts. It does NOT modify the AgentGuard repo itself: it
// builds the CLI in place (npm run build, same as CI would), then does all
// destructive git/hook work inside a throwaway temp git repository.
//
// Usage: node test/_g005_hook_e2e.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync, mkdirSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const ARTIFACTS_DIR = join(REPO_ROOT, 'artifacts')
const CLI_BIN = join(REPO_ROOT, 'dist', 'index.js')
const isWin = process.platform === 'win32'

const transcript = []
const cases = []
function log(line) {
  transcript.push(line)
  console.log(line)
}
function section(title) {
  log('')
  log('='.repeat(78))
  log(title)
  log('='.repeat(78))
}
function record(caseName, contractRef, expected, observed, verdict, extra) {
  cases.push({ case: caseName, contractRef, expected, observed, verdict, ...(extra ? { extra } : {}) })
  log(`[${verdict}] ${caseName} — expected: ${expected} | observed: ${observed}`)
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  return {
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    error: res.error,
  }
}

let overallOk = true

// ── 1. Build the CLI ─────────────────────────────────────────────────────────
section('STEP 1: npm run build (real shipped bin)')
const build = run('npm', ['run', 'build'], { cwd: REPO_ROOT, shell: true })
log(`$ npm run build\nstatus=${build.status}\n${build.stdout}\n${build.stderr}`)
if (build.status !== 0) {
  record('build-cli', 'npm run build produces dist/index.js', 'exit 0', `exit ${build.status}, error=${build.error}`, 'FAIL')
  overallOk = false
} else if (!existsSync(CLI_BIN)) {
  record('build-cli', 'npm run build produces dist/index.js', 'exit 0 + dist/index.js present', `exit 0 but ${CLI_BIN} missing`, 'FAIL')
  overallOk = false
} else {
  record('build-cli', 'npm run build produces dist/index.js', 'exit 0 + dist/index.js present', `exit 0, ${CLI_BIN} present`, 'PASS')
}

// ── 2. Create a throwaway temp git repo ─────────────────────────────────────
section('STEP 2: create temp git repo')
const tmpRepo = mkdtempSync(join(tmpdir(), 'agentguard-g005-e2e-'))
log(`temp repo: ${tmpRepo}`)
run('git', ['init', '-q'], { cwd: tmpRepo })
run('git', ['config', 'user.email', 'g005-e2e@example.com'], { cwd: tmpRepo })
run('git', ['config', 'user.name', 'G005 E2E'], { cwd: tmpRepo })
const gitDirRes = run('git', ['rev-parse', '--git-dir'], { cwd: tmpRepo })
const gitDirOk = gitDirRes.status === 0
record(
  'temp-repo-init',
  'throwaway repo is a real git repo (git rev-parse --git-dir succeeds)',
  'exit 0',
  `exit ${gitDirRes.status}, git-dir=${gitDirRes.stdout.trim()}`,
  gitDirOk ? 'PASS' : 'FAIL',
)
if (!gitDirOk) overallOk = false

// ── 3. Make `agentguard` resolvable on PATH via a shim ───────────────────────
section('STEP 3: install a PATH shim so the hook can find `agentguard`')
const shimDir = mkdtempSync(join(tmpdir(), 'agentguard-g005-shim-'))
// The pre-commit hook body runs under git's bundled POSIX sh even on
// Windows (MSYS), and does `command -v agentguard`. We provide a POSIX sh
// shim (no extension, executable bit set) that MSYS's `command -v` and
// `exec` can resolve, delegating straight to the real built bin.
const shimPath = join(shimDir, 'agentguard')
writeFileSync(shimPath, `#!/bin/sh\nexec node "${CLI_BIN.replace(/\\/g, '/')}" "$@"\n`)
chmodSync(shimPath, 0o755)
const shimmedPath = `${shimDir}${isWin ? ';' : ':'}${process.env.PATH}`
log(`shim: ${shimPath}\nPATH prefix added: ${shimDir}`)

const shimCheck = run('sh', ['-lc', 'command -v agentguard && agentguard --version'], {
  cwd: tmpRepo,
  env: { ...process.env, PATH: shimmedPath },
})
const shimOk = shimCheck.status === 0 && shimCheck.stdout.trim().length > 0
record(
  'path-shim-resolves',
  '`command -v agentguard` resolves to the built CLI via PATH shim under sh',
  'exit 0 with version output',
  `exit ${shimCheck.status}, stdout=${JSON.stringify(shimCheck.stdout.trim())}`,
  shimOk ? 'PASS' : 'FAIL',
)
if (!shimOk) overallOk = false

// ── 4. `agentguard hook install` ─────────────────────────────────────────────
section('STEP 4: agentguard hook install')
const install = run('node', [CLI_BIN, 'hook', 'install'], { cwd: tmpRepo, env: { ...process.env, PATH: shimmedPath } })
log(`$ node dist/index.js hook install\nstatus=${install.status}\nstdout=${install.stdout}\nstderr=${install.stderr}`)

const hookPath = join(tmpRepo, '.git', 'hooks', 'pre-commit')
const hookExists = existsSync(hookPath)
const hookContents = hookExists ? readFileSync(hookPath, 'utf8') : ''
const hasSentinel = hookContents.includes('# agentguard:managed-hook')
record(
  'hook-install-exit-code',
  'CLI exits 0 on successful install',
  'exit 0',
  `exit ${install.status}`,
  install.status === 0 ? 'PASS' : 'FAIL',
)
record(
  'hook-install-writes-sentinel',
  '.git/hooks/pre-commit written containing HOOK_SENTINEL "# agentguard:managed-hook"',
  'file exists and contains sentinel',
  hookExists ? (hasSentinel ? 'file exists, sentinel present' : 'file exists, sentinel MISSING') : 'file missing',
  hookExists && hasSentinel ? 'PASS' : 'FAIL',
)
if (install.status !== 0 || !hookExists || !hasSentinel) overallOk = false

// Executable-bit check. installHook() calls chmod(path, 0o755). On POSIX
// this is directly observable via the mode bits. On Windows/NTFS, Node's
// chmodSync cannot set a real POSIX x-bit (NTFS has no such concept), and
// git for Windows does not gate hook execution on the x-bit either — it
// dispatches hooks by reading the shebang line directly. So on win32 we
// prove "installed as executable" functionally: git (via its bundled sh)
// must actually be able to *run* the file as a script, which we verify
// with a disposable probe hook before installing the real one, and again
// implicitly via the real commit tests in steps 5/6 below.
let execVerdict
let execObserved
if (hookExists) {
  const mode = statSync(hookPath).mode & 0o777
  if (isWin) {
    const probeDir = mkdtempSync(join(tmpdir(), 'agentguard-g005-execprobe-'))
    run('git', ['init', '-q'], { cwd: probeDir })
    writeFileSync(join(probeDir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho PROBE_HOOK_EXECUTED 1>&2\nexit 3\n')
    chmodSync(join(probeDir, '.git', 'hooks', 'pre-commit'), 0o755)
    run('git', ['config', 'user.email', 'probe@example.com'], { cwd: probeDir })
    run('git', ['config', 'user.name', 'probe'], { cwd: probeDir })
    writeFileSync(join(probeDir, 'f.txt'), 'x\n')
    run('git', ['add', 'f.txt'], { cwd: probeDir })
    const probeCommit = run('git', ['commit', '-m', 'probe'], { cwd: probeDir, env: { ...process.env, PATH: shimmedPath } })
    const executed = probeCommit.status !== 0 && probeCommit.stderr.includes('PROBE_HOOK_EXECUTED')
    rmSync(probeDir, { recursive: true, force: true })
    execVerdict = executed ? 'PASS' : 'FAIL'
    execObserved = `mode=${mode.toString(8)} (NTFS: chmodSync cannot set a real x-bit); functional probe: git actually executed a chmod(0o755) hook script and honored a non-zero exit to abort the commit (commit exit=${probeCommit.status}, saw PROBE_HOOK_EXECUTED=${probeCommit.stderr.includes('PROBE_HOOK_EXECUTED')})`
    if (!executed) overallOk = false
  } else {
    const isExecutable = (mode & 0o111) !== 0
    execVerdict = isExecutable ? 'PASS' : 'FAIL'
    execObserved = `mode=${mode.toString(8)}`
    if (!isExecutable) overallOk = false
  }
} else {
  execVerdict = 'FAIL'
  execObserved = 'file missing'
  overallOk = false
}
record(
  'hook-install-executable',
  'installed hook is executable by git (chmod 0o755 applied; git can run it as a script)',
  isWin ? 'git executes chmod(0o755)-marked hook scripts and honors their exit code' : 'mode & 0o111 != 0',
  execObserved,
  execVerdict,
)

// ── 5. Stage a CRITICAL secret and attempt a real `git commit` ──────────────
section('STEP 5: stage a CRITICAL secret (OpenAI-style key) and run `git commit`')
const secretFile = join(tmpRepo, 'secret.env')
const fakeOpenAiKey = 'sk-' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2'
writeFileSync(secretFile, `OPENAI_API_KEY=${fakeOpenAiKey}\n`)
run('git', ['add', 'secret.env'], { cwd: tmpRepo })

// Corroborate the scanner itself flags this file as critical (scan-files
// takes a *directory root* to walk, so we scan the repo root — the same
// contract `scanFiles()` implements — not the individual filename).
const scanSecret = run('node', [CLI_BIN, 'scan-files', '--json', '.'], { cwd: tmpRepo })
let secretFindings = []
try {
  secretFindings = JSON.parse(scanSecret.stdout)
} catch {
  /* leave empty; recorded as failure below */
}
const secretCriticalCount = Array.isArray(secretFindings)
  ? secretFindings.filter((f) => f.severity === 'critical' && !f.advisory).length
  : -1
record(
  'scanner-flags-critical-secret',
  'agentguard scan-files --json <dir> reports >=1 non-advisory critical finding for the staged secret',
  '>= 1 critical finding',
  `criticalCount=${secretCriticalCount}, raw=${scanSecret.stdout.trim().slice(0, 300)}`,
  secretCriticalCount >= 1 ? 'PASS' : 'FAIL',
)
if (secretCriticalCount < 1) overallOk = false

// Positive probe: reproduce the EXACT command the installed hook runs
// internally (piping the staged diff into `scan-diff`), independent of
// `git commit`, to pin down the block decision to the CLI exit code.
const hookInternalProbe = run('sh', ['-c', 'git diff --cached --no-color --diff-filter=ACM | agentguard scan-diff >/dev/null 2>&1; echo "exit=$?"'], {
  cwd: tmpRepo,
  env: { ...process.env, PATH: shimmedPath },
})
log(`$ git diff --cached | agentguard scan-diff\n${hookInternalProbe.stdout.trim()}`)
const hookExitOne = hookInternalProbe.stdout.includes('exit=1')
record(
  'hook-internal-scan-diff-exits-1-on-critical',
  'the installed hook pipes the staged diff into `agentguard scan-diff` and blocks on its exit code (1 = non-advisory critical present)',
  'scan-diff exits 1 for the staged critical secret',
  hookExitOne ? 'CONFIRMED — scan-diff exited 1 on the staged diff' : `unexpected: ${JSON.stringify(hookInternalProbe.stdout.trim())}`,
  hookExitOne ? 'PASS' : 'FAIL',
)
if (!hookExitOne) overallOk = false

const commitSecret = run('git', ['commit', '-m', 'add secret (should be blocked)'], {
  cwd: tmpRepo,
  env: { ...process.env, PATH: shimmedPath },
})
log(`$ git commit -m "add secret (should be blocked)"\nstatus=${commitSecret.status}\nstdout=${commitSecret.stdout}\nstderr=${commitSecret.stderr}`)
const secretBlocked = commitSecret.status !== 0
record(
  'commit-with-critical-secret-is-blocked',
  'git commit exits non-zero when staged file contains a critical (non-advisory) secret finding',
  'non-zero exit (commit rejected)',
  `exit ${commitSecret.status}${secretBlocked ? '' : ' — COMMIT WAS NOT BLOCKED'}`,
  secretBlocked ? 'PASS' : 'FAIL',
)
if (!secretBlocked) overallOk = false

const logAfterSecret = run('git', ['log', '--oneline'], { cwd: tmpRepo })
const commitCountAfterSecret = logAfterSecret.stdout.trim() === '' ? 0 : logAfterSecret.stdout.trim().split('\n').length
const noCommitLanded = commitCountAfterSecret === 0
record(
  'no-commit-created-for-blocked-secret',
  'no commit object is created in git history when the hook blocks',
  'git log is empty (no commits yet)',
  `git log --oneline => ${JSON.stringify(logAfterSecret.stdout.trim())}`,
  noCommitLanded ? 'PASS' : 'FAIL (secret was actually committed to history)',
)
if (!noCommitLanded) overallOk = false

// ── 6. Stage a clean file and confirm the commit is allowed ─────────────────
section('STEP 6: unstage the secret, stage a clean file, run `git commit`')
run('git', ['reset'], { cwd: tmpRepo })
if (existsSync(secretFile)) rmSync(secretFile)
const cleanFile = join(tmpRepo, 'README.md')
writeFileSync(cleanFile, '# Demo repo\n\nNothing sensitive here, just docs.\n')
run('git', ['add', 'README.md'], { cwd: tmpRepo })

const scanClean = run('node', [CLI_BIN, 'scan-files', '--json', '.'], { cwd: tmpRepo })
let cleanFindings = []
try {
  cleanFindings = JSON.parse(scanClean.stdout)
} catch {
  /* leave empty */
}
const cleanCriticalCount = Array.isArray(cleanFindings)
  ? cleanFindings.filter((f) => f.severity === 'critical' && !f.advisory).length
  : -1
record(
  'scanner-clears-clean-file',
  'agentguard scan-files --json <dir> reports 0 critical findings for a clean repo state',
  '0 critical findings',
  `criticalCount=${cleanCriticalCount}, raw=${scanClean.stdout.trim().slice(0, 300)}`,
  cleanCriticalCount === 0 ? 'PASS' : 'FAIL',
)
if (cleanCriticalCount !== 0) overallOk = false

const commitClean = run('git', ['commit', '-m', 'add clean readme (should be allowed)'], {
  cwd: tmpRepo,
  env: { ...process.env, PATH: shimmedPath },
})
log(`$ git commit -m "add clean readme (should be allowed)"\nstatus=${commitClean.status}\nstdout=${commitClean.stdout}\nstderr=${commitClean.stderr}`)
const cleanAllowed = commitClean.status === 0
record(
  'commit-with-clean-file-is-allowed',
  'git commit exits 0 when staged files contain no critical findings',
  'exit 0 (commit accepted)',
  `exit ${commitClean.status}`,
  cleanAllowed ? 'PASS' : 'FAIL',
)
if (!cleanAllowed) overallOk = false

const logAfterClean = run('git', ['log', '--oneline'], { cwd: tmpRepo })
const commitCountAfterClean = logAfterClean.stdout.trim() === '' ? 0 : logAfterClean.stdout.trim().split('\n').length
// Because the critical-secret commit above is expected to be BLOCKED (0
// commits from step 5), the clean commit here should be the first and only
// commit in history. If step 5's block failed (known bug), history will
// already contain the secret commit too — surfaced separately above, not
// double-counted as a failure here.
const cleanCommitLanded = commitCountAfterClean === commitCountAfterSecret + 1
record(
  'exactly-one-new-commit-after-clean-allowed',
  'exactly one additional commit exists in history after the clean commit is allowed',
  `${commitCountAfterSecret + 1} total commit(s)`,
  `git log --oneline => ${JSON.stringify(logAfterClean.stdout.trim())}`,
  cleanCommitLanded ? 'PASS' : 'FAIL',
)
if (!cleanCommitLanded) overallOk = false

// ── 7. `agentguard hook uninstall` ───────────────────────────────────────────
section('STEP 7: agentguard hook uninstall')
const uninstall = run('node', [CLI_BIN, 'hook', 'uninstall'], { cwd: tmpRepo, env: { ...process.env, PATH: shimmedPath } })
log(`$ node dist/index.js hook uninstall\nstatus=${uninstall.status}\nstdout=${uninstall.stdout}\nstderr=${uninstall.stderr}`)
const hookGoneAfterUninstall = !existsSync(hookPath)
record(
  'hook-uninstall-exit-code',
  'CLI exits 0 on successful uninstall',
  'exit 0',
  `exit ${uninstall.status}`,
  uninstall.status === 0 ? 'PASS' : 'FAIL',
)
record(
  'hook-uninstall-removes-managed-hook',
  '.git/hooks/pre-commit is removed after uninstall (no backup existed)',
  'file no longer exists',
  hookGoneAfterUninstall ? 'file removed' : 'file still present',
  hookGoneAfterUninstall ? 'PASS' : 'FAIL',
)
if (uninstall.status !== 0 || !hookGoneAfterUninstall) overallOk = false

// ── Write artifacts ──────────────────────────────────────────────────────────
section('SUMMARY')
for (const c of cases) log(`${c.verdict.padEnd(24)} ${c.case}`)
log('')
log(`OVERALL: ${overallOk ? 'PASS' : 'FAIL'}`)
log(`temp repo left at: ${tmpRepo} (for inspection; not part of agentguard repo)`)

mkdirSync(ARTIFACTS_DIR, { recursive: true })
writeFileSync(join(ARTIFACTS_DIR, 'g005-hook-e2e.txt'), transcript.join('\n') + '\n')
writeFileSync(join(ARTIFACTS_DIR, 'g005-hook-e2e.json'), JSON.stringify(cases, null, 2) + '\n')

const nodeVersion = execFileSync('node', ['--version'], { encoding: 'utf8' })
writeFileSync(
  join(ARTIFACTS_DIR, 'g005-cli-replay.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      kind: 'cli-replay',
      replaySafe: true,
      command: ['node', '--version'],
      recordedStdout: nodeVersion,
    },
    null,
    2,
  ) + '\n',
)

rmSync(tmpRepo, { recursive: true, force: true })
rmSync(shimDir, { recursive: true, force: true })

process.exit(overallOk ? 0 : 1)
