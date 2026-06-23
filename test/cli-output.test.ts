import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('CLI --out creates missing parent directories for report files', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-cli-out-'))
  const reportPath = join(workspace, 'nested', 'reports', 'agent-risk-report.md')

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--out', reportPath],
    {
      cwd: process.cwd(),
      input: 'agent completed without sensitive output\n',
      encoding: 'utf8',
    },
  )

  assert.equal(result.stdout, '')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(reportPath), true)
  assert.match(readFileSync(reportPath, 'utf8'), /^# AgentGuard Risk Report/)
})

test('CLI --out reports write failures without a raw stack trace', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'agentguard-cli-out-failure-'))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--out', workspace],
    {
      cwd: process.cwd(),
      input: 'agent completed without sensitive output\n',
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 2)
  assert.match(result.stderr, /Could not write output/)
  assert.doesNotMatch(result.stderr, /at .*src\/index\.ts/)
})

test('CLI help flags print usage to stdout with a success exit', () => {
  for (const helpFlag of ['--help', '-h']) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', helpFlag],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, `${helpFlag} should exit successfully`)
    assert.match(result.stdout, /^Usage:/, `${helpFlag} should print usage to stdout`)
    assert.equal(result.stderr, '', `${helpFlag} should not print usage to stderr`)
  }
})

test('CLI version flags print the package version to stdout with a success exit', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

  for (const versionFlag of ['--version', '-v']) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/index.ts', versionFlag],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    )

    assert.equal(result.status, 0, `${versionFlag} should exit successfully`)
    assert.equal(result.stdout, `${packageJson.version}\n`, `${versionFlag} should print the package version`)
    assert.equal(result.stderr, '', `${versionFlag} should not print to stderr`)
  }
})

test('CLI invalid commands still print usage to stderr with an error exit', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', '--definitely-not-an-option'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})
