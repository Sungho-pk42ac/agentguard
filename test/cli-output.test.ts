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
