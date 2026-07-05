import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { resolveCommand } from '../src/cli/table.js'

function runCli(args: string[], input?: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', ...args], {
    cwd: process.cwd(),
    input,
    encoding: 'utf8',
  })
}

// ── Byte-identity: multi-word verb forms vs legacy hyphenated forms ─────────

test('CLI scan-diff and "scan diff" produce byte-identical output', () => {
  const diff = readFileSync('examples/risky-pr.diff', 'utf8')
  const legacy = runCli(['scan-diff'], diff)
  const multiWord = runCli(['scan', 'diff'], diff)

  assert.equal(multiWord.status, legacy.status)
  assert.equal(multiWord.stdout, legacy.stdout)
  assert.equal(multiWord.stderr, legacy.stderr)
})

test('CLI scan-mcp and "scan mcp" produce byte-identical output', () => {
  const legacy = runCli(['scan-mcp', 'examples/risky-mcp.json'])
  const multiWord = runCli(['scan', 'mcp', 'examples/risky-mcp.json'])

  assert.equal(multiWord.status, legacy.status)
  assert.equal(multiWord.stdout, legacy.stdout)
  assert.equal(multiWord.stderr, legacy.stderr)
})

test('CLI scan-files and "scan files" produce byte-identical output', () => {
  const legacy = runCli(['scan-files', 'examples'])
  const multiWord = runCli(['scan', 'files', 'examples'])

  assert.equal(multiWord.status, legacy.status)
  assert.equal(multiWord.stdout, legacy.stdout)
  assert.equal(multiWord.stderr, legacy.stderr)
})

// ── Unknown commands still fall through to usage(2) ─────────────────────────

test('CLI rejects an unknown one-word command with usage on stderr and exit 2', () => {
  const result = runCli(['frobnicate'])

  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

test('CLI rejects an unknown two-word command with usage on stderr and exit 2', () => {
  const result = runCli(['scan', 'everything'])

  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

// ── Precedence regression: doctor/posture stay resolved before the table ───

test('CLI doctor still resolves before the dispatch table (doctor --lang en)', () => {
  const result = runCli(['doctor', '--lang', 'en'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /readiness/i)
})

test('CLI posture still resolves before the dispatch table', () => {
  const result = runCli(['posture', '--json'])

  assert.equal(result.status === 0 || result.status === 1, true, result.stderr)
})

// ── resolveCommand unit tests ────────────────────────────────────────────────

test('resolveCommand matches a two-word verb+subcommand form', () => {
  const resolved = resolveCommand(['scan', 'files', '.'])
  assert.deepEqual(resolved, { canonical: 'scan-files', rest: ['.'] })
})

test('resolveCommand matches a two-word "scan diff" form', () => {
  const resolved = resolveCommand(['scan', 'diff', '--json'])
  assert.deepEqual(resolved, { canonical: 'scan-diff', rest: ['--json'] })
})

test('resolveCommand passes through an exact one-word legacy command', () => {
  const resolved = resolveCommand(['scan-files', '.'])
  assert.deepEqual(resolved, { canonical: 'scan-files', rest: ['.'] })
})

test('resolveCommand passes through the flat "report" command', () => {
  const resolved = resolveCommand(['report', '--push'])
  assert.deepEqual(resolved, { canonical: 'report', rest: ['--push'] })
})

test('resolveCommand tolerates flags appearing before the verb', () => {
  const resolved = resolveCommand(['--json', 'scan', 'diff'])
  assert.deepEqual(resolved, { canonical: 'scan-diff', rest: ['--json'] })
})

test('resolveCommand tolerates flags before a one-word legacy command', () => {
  const resolved = resolveCommand(['--sarif', 'scan-mcp', 'config.toml'])
  assert.deepEqual(resolved, { canonical: 'scan-mcp', rest: ['--sarif', 'config.toml'] })
})

test('resolveCommand returns undefined for an unknown one-word command', () => {
  assert.equal(resolveCommand(['frobnicate']), undefined)
})

test('resolveCommand returns undefined for an unknown two-word command', () => {
  assert.equal(resolveCommand(['scan', 'everything']), undefined)
})

test('resolveCommand returns undefined for empty argv', () => {
  assert.equal(resolveCommand([]), undefined)
})

test('resolveCommand excludes preTable entries (doctor/posture) from matching', () => {
  // doctor/posture are documented in the table for completeness, but their
  // precedence branches live in src/index.ts BEFORE resolveCommand runs.
  // resolveCommand must not match them so it never shadows that precedence.
  assert.equal(resolveCommand(['doctor']), undefined)
  assert.equal(resolveCommand(['posture']), undefined)
})

// ── M1c: open/login/logout/enroll verbs are registered (minimal smoke) ─────

test('CLI "open" with no path argument exits 2 with usage on stderr', () => {
  const result = runCli(['open'])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

test('CLI "login" without --endpoint/--email exits 2 with usage on stderr', () => {
  const result = runCli(['login'])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

test('CLI "enroll" without --endpoint/--org/--code exits 2 with usage on stderr', () => {
  const result = runCli(['enroll'])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})
