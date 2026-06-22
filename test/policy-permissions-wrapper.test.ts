import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'

test('loadPolicy accepts top-level permissions blocks for policy lists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  permissions:',
      '    deny_commands:',
      '      - baseline-command',
      'permissions:',
      '  deny_read:',
      '    - private/**',
      '  denied_commands:',
      '    - deploy --force',
      '  approval_required_operations:',
      '    - production-release',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.ok(policy.denyRead.includes('private/**'))
  assert.deepEqual(policy.denyCommands, ['baseline-command', 'deploy --force'])
  assert.ok(policy.requireApproval.includes('production-release'))
})

test('loadPolicy rejects conflicting aliases inside top-level permissions without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'permissions:',
      '  deny_commands:',
      '    - sk-abcdefghijklmnopqrstuvwxyz',
      '  denied_commands:',
      '    - rm -rf /tmp/demo',
    ].join('\n'),
  )

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.match(error.message, /malformed policy file/)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      assert.doesNotMatch(error.message, /rm -rf/)
      return true
    },
  )
})
