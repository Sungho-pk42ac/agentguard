import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('CLI applies JSON policy files from --policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.json')
  writeFileSync(policyPath, JSON.stringify({ deny_commands: ['agentguard-json-denied-command'] }))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: 'agentguard-json-denied-command',
    },
  )

  assert.equal(result.status, 0)
  assert.doesNotMatch(result.stderr, /agentguard-json-denied-command/)
  const findings: unknown = JSON.parse(result.stdout)
  assert.ok(Array.isArray(findings))
  assert.equal(findings[0]?.id, 'denied-command')
  assert.match(findings[0]?.title ?? '', /agentguard-json-denied-command/)
})
