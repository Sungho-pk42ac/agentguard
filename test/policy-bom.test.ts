import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy } from '../src/policy.js'

test('loadPolicy parses JSON policy files with a UTF-8 BOM', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.json')
  writeFileSync(path, `\uFEFF${JSON.stringify({ deny_commands: ['agentguard-bom-command'] })}`)

  const policy = loadPolicy(path)

  assert.ok(policy.denyCommands.includes('agentguard-bom-command'))
})
