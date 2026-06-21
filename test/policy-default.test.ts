import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy } from '../src/policy.js'

test('loadPolicy uses local agent-policy.yaml when policy path is omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  writeFileSync(join(dir, 'agent-policy.yaml'), 'deny_commands:\n  - local-policy-command\n')
  const previousCwd = process.cwd()

  try {
    process.chdir(dir)

    const policy = loadPolicy()

    assert.ok(policy.denyCommands.includes('local-policy-command'))
  } finally {
    process.chdir(previousCwd)
  }
})
