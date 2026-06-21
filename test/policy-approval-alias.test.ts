import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'

test('loadPolicy accepts approval_required as an approval list alias', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  approval_required:',
      '    - baseline-review',
      'approval_required:',
      '  - production-release',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.requireApproval, ['baseline-review', 'production-release'])
})

test('loadPolicy accepts approval_required_operations as an approval list alias', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  approval_required_operations:',
      '    - baseline-review',
      'approval_required_operations:',
      '  - production-release',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.requireApproval, ['baseline-review', 'production-release'])
})

test('loadPolicy accepts require_approval_operations as an approval list alias', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  require_approval_operations:',
      '    - baseline-review',
      'require_approval_operations:',
      '  - production-release',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.requireApproval, ['baseline-review', 'production-release'])
})

test('loadPolicy rejects conflicting approval list aliases without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'require_approval:',
      '  - sk-abcdefghijklmnopqrstuvwxyz',
      'approval_required_operations:',
      '  - production-release',
    ].join('\n'),
  )

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.match(error.message, /malformed policy file/)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      assert.doesNotMatch(error.message, /production-release/)
      return true
    },
  )
})

test('loadPolicy accepts MCP approval_required as a tool approval alias', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  mcp:',
      '    approval_required:',
      '      - github.merge_pull_request',
      'mcp:',
      '  require_approval:',
      '    - filesystem.write_file',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.mcp.requireApprovalTools, ['github.merge_pull_request', 'filesystem.write_file'])
})

test('loadPolicy accepts MCP approval_required_tools as a tool approval alias', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  mcp:',
      '    approval_required_tools:',
      '      - github.merge_pull_request',
      'mcp:',
      '  approval_required_tools:',
      '    - filesystem.write_file',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.mcp.requireApprovalTools, ['github.merge_pull_request', 'filesystem.write_file'])
})

test('loadPolicy rejects conflicting MCP approval aliases without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'mcp:',
      '  require_approval_tools:',
      '    - sk-abcdefghijklmnopqrstuvwxyz',
      '  approval_required:',
      '    - filesystem.write_file',
    ].join('\n'),
  )

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.match(error.message, /malformed policy file/)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      assert.doesNotMatch(error.message, /filesystem\.write_file/)
      return true
    },
  )
})
