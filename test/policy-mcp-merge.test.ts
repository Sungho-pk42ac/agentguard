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
