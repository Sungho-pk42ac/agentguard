import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'

test('loadPolicy accepts denied_* policy-as-code aliases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['denied_reads:', '  - private/**', 'denied_commands:', '  - terraform destroy'].join('\n'))

  const policy = loadPolicy(path)

  assert.ok(policy.denyRead.includes('private/**'))
  assert.ok(policy.denyCommands.includes('terraform destroy'))
})

test('loadPolicy rejects conflicting denied policy aliases without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['deny_commands:', '  - sk-abcdefghijklmnopqrstuvwxyz', 'denied_commands:', '  - rm -rf'].join('\n'))

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

test('loadPolicy accepts denied_servers as an MCP deny list alias', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['mcp:', '  denied_servers:', '    - Linear'].join('\n'))

  const policy = loadPolicy(path)

  assert.ok(policy.mcp.denyServers.includes('linear'))
})

test('loadPolicy rejects conflicting MCP denied-server aliases without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['mcp:', '  deny_servers:', '    - sk-abcdefghijklmnopqrstuvwxyz', '  denied_servers:', '    - linear'].join('\n'))

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.match(error.message, /malformed policy file/)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      assert.doesNotMatch(error.message, /linear/)
      return true
    },
  )
})
