import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { z } from 'zod'

const cliFindingSchema = z.object({ id: z.string().optional() })
const cliFindingsSchema = z.array(cliFindingSchema)

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

test('CLI applies the full JSON policy surface from --policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.json')
  writeFileSync(
    policyPath,
    JSON.stringify({
      deny_commands: ['agentguard-json-denied-command'],
      require_approval: ['agentguard-json-approval-operation'],
      mcp: {
        deny_servers: ['linear'],
        deny_tools: ['github.delete_repository'],
        require_approval_tools: ['github.merge_pull_request'],
      },
    }),
  )

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-mcp', '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: [
        'agentguard-json-denied-command',
        'agentguard-json-approval-operation',
        '[mcp_servers.linear]',
        'tools = ["github.delete_repository", "github.merge_pull_request"]',
      ].join('\n'),
    },
  )

  assert.equal(result.status, 1)
  assert.equal(result.stderr, '')
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  const ids = findings.map((finding) => finding.id)
  assert.ok(ids.includes('denied-command'))
  assert.ok(ids.includes('approval-required'))
  assert.ok(ids.includes('mcp-linear'))
  assert.ok(ids.includes('mcp-tool-denied'))
  assert.ok(ids.includes('mcp-tool-approval-required'))
})
