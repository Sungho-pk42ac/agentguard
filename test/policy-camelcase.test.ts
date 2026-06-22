import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'

test('loadPolicy accepts camelCase policy keys for JSON users', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.json')
  writeFileSync(
    path,
    JSON.stringify({
      overrides: {
        denyCommands: ['agentguard-json-baseline-command'],
        mcp: { denyServers: ['InternalDb'] },
      },
      denyRead: ['private/**'],
      requireApproval: ['production-release'],
      mcp: {
        denyTools: ['github.delete_repository'],
        requireApprovalTools: ['filesystem.write_file'],
      },
    }),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.denyCommands, ['agentguard-json-baseline-command'])
  assert.ok(policy.denyRead.includes('private/**'))
  assert.ok(policy.requireApproval.includes('production-release'))
  assert.deepEqual(policy.mcp.denyServers, ['internaldb'])
  assert.ok(policy.mcp.denyTools.includes('github.delete_repository'))
  assert.ok(policy.mcp.requireApprovalTools.includes('filesystem.write_file'))
})

test('loadPolicy rejects conflicting snake_case and camelCase aliases without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['deny_commands:', '  - sk-abcdefghijklmnopqrstuvwxyz', 'denyCommands:', '  - rm -rf'].join('\n'))

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
