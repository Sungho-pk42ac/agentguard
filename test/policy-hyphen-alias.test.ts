import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'
import { DEFAULT_POLICY } from '../src/rules.js'

test('loadPolicy accepts hyphenated policy-as-code keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'denied-reads:',
      '  - private/**',
      'denied-commands:',
      '  - terraform destroy',
      'approval-required-operations:',
      '  - production-release',
      'mcp:',
      '  denied-servers:',
      '    - browser',
      '  denied-tools:',
      '    - github.delete_repository',
      '  approval-required-tools:',
      '    - github.merge_pull_request',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.ok(policy.denyRead.includes(DEFAULT_POLICY.denyRead[0]))
  assert.ok(policy.denyRead.includes('private/**'))
  assert.ok(policy.denyCommands.includes('terraform destroy'))
  assert.ok(policy.requireApproval.includes('production-release'))
  assert.ok(policy.mcp.denyServers.includes('browser'))
  assert.ok(policy.mcp.denyTools.includes('github.delete_repository'))
  assert.ok(policy.mcp.requireApprovalTools.includes('github.merge_pull_request'))
})

test('loadPolicy rejects normalized duplicate policy keys without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'deny-commands:',
      '  - sk-abcdefghijklmnopqrstuvwxyz',
      'deny_commands:',
      '  - rm -rf /tmp/demo',
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
