import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy } from '../src/policy.js'
import { DEFAULT_POLICY } from '../src/rules.js'

test('loadPolicy preserves default MCP approval tools when overriding denied MCP servers only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    ['overrides:', '  mcp:', '    deny_servers:', '      - internal-db', 'mcp:', '  deny_servers:', '    - browser'].join(
      '\n',
    ),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.mcp.denyServers, ['internal-db', 'browser'])
  assert.deepEqual(policy.mcp.requireApprovalTools, DEFAULT_POLICY.mcp.requireApprovalTools)
})

test('loadPolicy can replace and extend MCP denied tools', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  mcp:',
      '    deny_tools:',
      '      - github.delete_repository',
      'mcp:',
      '  deny_tools:',
      '    - slack.admin_invite',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.mcp.denyTools, ['github.delete_repository', 'slack.admin_invite'])
})

test('loadPolicy merges MCP permissions blocks with direct MCP rules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  mcp:',
      '    permissions:',
      '      deny_servers:',
      '        - internal-db',
      '      require_approval_tools:',
      '        - github.merge_pull_request',
      'mcp:',
      '  deny_tools:',
      '    - slack.admin_invite',
      '  permissions:',
      '    deny_servers:',
      '      - browser',
      '    require_approval_tools:',
      '      - filesystem.write_file',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.mcp.denyServers, ['internal-db', 'browser'])
  assert.deepEqual(policy.mcp.denyTools, ['slack.admin_invite'])
  assert.deepEqual(policy.mcp.requireApprovalTools, ['github.merge_pull_request', 'filesystem.write_file'])
})
