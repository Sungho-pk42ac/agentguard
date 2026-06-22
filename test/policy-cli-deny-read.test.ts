import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { z } from 'zod'

const cliFindingsSchema = z.array(
  z.object({ id: z.string().optional(), file: z.string().optional(), title: z.string().optional() }),
)
const cliPath = join(process.cwd(), 'src/index.ts')
const tsxImport = import.meta.resolve('tsx')

test('CLI applies denied read paths from --policy to scan-files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const workspace = join(dir, 'workspace')
  const secretDir = join(workspace, 'private')
  const policyPath = join(dir, 'agent-policy.yaml')
  mkdirSync(secretDir, { recursive: true })
  writeFileSync(policyPath, ['deny_read:', '  - private/**'].join('\n'))
  writeFileSync(join(secretDir, 'session.txt'), 'session transcript without secrets')

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-files', workspace, '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 1)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.ok(findings.some((finding) => finding.id === 'denied-read-path' && finding.file === 'private/session.txt'))
})

test('CLI uses local agent-policy.yaml when --policy is omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  writeFileSync(join(dir, 'agent-policy.yaml'), ['deny_commands:', '  - agentguard-local-policy-command'].join('\n'))

  const result = spawnSync(process.execPath, ['--import', tsxImport, cliPath, 'scan-log', '--json'], {
    cwd: dir,
    encoding: 'utf8',
    input: 'agentguard-local-policy-command',
  })

  assert.equal(result.status, 0)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.equal(findings[0]?.id, 'denied-command')
})

test('CLI accepts --policy=<path> for scan-log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.json')
  writeFileSync(policyPath, JSON.stringify({ deny_commands: ['agentguard-json-policy-command'] }))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', `--policy=${policyPath}`, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: 'agentguard-json-policy-command',
    },
  )

  assert.equal(result.status, 0)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.equal(findings[0]?.id, 'denied-command')
})

test('CLI applies JSON policy overrides and extensions from --policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.json')
  writeFileSync(
    policyPath,
    JSON.stringify({
      overrides: { deny_commands: ['agentguard-json-override-command'] },
      deny_commands: ['agentguard-json-extension-command'],
    }),
  )

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: ['rm -rf', 'agentguard-json-override-command', 'agentguard-json-extension-command'].join('\n'),
    },
  )

  assert.equal(result.status, 0)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  const titles = findings.map((finding) => finding.title ?? '')
  assert.deepEqual(titles, [
    'Denied command pattern: agentguard-json-override-command',
    'Denied command pattern: agentguard-json-extension-command',
  ])
})

test('CLI accepts --policy before the command', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.yaml')
  writeFileSync(policyPath, ['deny_commands:', '  - agentguard-global-policy-command'].join('\n'))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', '--policy', policyPath, 'scan-log', '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: 'agentguard-global-policy-command',
    },
  )

  assert.equal(result.status, 0)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.equal(findings[0]?.id, 'denied-command')
})

test('CLI rejects duplicate --policy flags without leaking policy paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const firstPolicyPath = join(dir, 'agent-policy-sk-abcdefghijklmnopqrstuvwxyz.yaml')
  const secondPolicyPath = join(dir, 'agent-policy.json')
  writeFileSync(firstPolicyPath, ['deny_commands:', '  - first-policy-command'].join('\n'))
  writeFileSync(secondPolicyPath, JSON.stringify({ deny_commands: ['second-policy-command'] }))

  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'src/index.ts',
      'scan-log',
      '--policy',
      firstPolicyPath,
      '--policy',
      secondPolicyPath,
      '--json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: 'second-policy-command',
    },
  )

  assert.equal(result.status, 2)
  assert.match(result.stderr, /--policy <path>/)
  assert.doesNotMatch(result.stderr, /sk-abcdefghijklmnopqrstuvwxyz/)
  assert.equal(result.stdout, '')
})

test('CLI applies approval-required operations from --policy to scan-log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.yaml')
  writeFileSync(policyPath, ['require_approval:', '  - production-release'].join('\n'))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: 'production-release',
    },
  )

  assert.equal(result.status, 0)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.equal(findings[0]?.id, 'approval-required')
})

test('CLI redacts secret-shaped policy values in findings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.yaml')
  writeFileSync(policyPath, ['deny_commands:', '  - sk-abcdefghijklmnopqrstuvwxyz'].join('\n'))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: 'sk-abcdefghijklmnopqrstuvwxyz',
    },
  )

  assert.equal(result.status, 1)
  assert.doesNotMatch(result.stdout, /sk-abcdefghijklmnopqrstuvwxyz/)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.ok(findings.some((finding) => finding.id === 'denied-command'))
})

test('CLI applies MCP deny server rules from --policy case-insensitively', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.yaml')
  writeFileSync(policyPath, ['mcp:', '  deny_servers:', '    - Linear'].join('\n'))

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-mcp', '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: '[mcp_servers.linear]\ncommand = "linear-mcp"',
    },
  )

  assert.equal(result.status, 0)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.ok(findings.some((finding) => finding.id === 'mcp-linear'))
})

test('CLI applies MCP deny tool rules from --policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.yaml')
  writeFileSync(policyPath, ['mcp:', '  deny_tools:', '    - github.delete_repository'].join('\n'))

  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-mcp', '--policy', policyPath, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: '[mcp_servers.github]\ntools = ["github.delete_repository"]',
  })

  assert.equal(result.status, 1)
  const findings = cliFindingsSchema.parse(JSON.parse(result.stdout))
  assert.ok(findings.some((finding) => finding.id === 'mcp-tool-denied'))
})
