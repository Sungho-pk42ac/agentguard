import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DEFAULT_POLICY } from '../src/rules.js'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'

test('loadPolicy returns defaults when policy path is missing', () => {
  const policy = loadPolicy()

  assert.deepEqual(policy, DEFAULT_POLICY)
})

test('loadPolicy reports a missing policy file without leaking file contents', () => {
  const path = join(tmpdir(), `agentguard-policy-missing-sk-abcdefghijklmnopqrstuvwxyz-${process.pid}.yaml`)

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /secret|token|password/i)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('loadPolicy parses YAML and extends the default policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'deny_read:',
      '  - secrets/**',
      'deny_commands:',
      '  - terraform destroy',
      'require_approval:',
      '  - fly deploy',
      'mcp:',
      '  deny_servers:',
      '    - browser',
      '  require_approval_tools:',
      '    - github.create_pull_request',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.ok(policy.denyRead.includes(DEFAULT_POLICY.denyRead[0]))
  assert.ok(policy.denyRead.includes('secrets/**'))
  assert.ok(policy.denyCommands.includes('terraform destroy'))
  assert.ok(policy.requireApproval.includes('fly deploy'))
  assert.ok(policy.mcp.denyServers.includes('browser'))
  assert.ok(policy.mcp.requireApprovalTools.includes('github.create_pull_request'))
})

test('loadPolicy treats an empty YAML policy file as defaults only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, '')

  const policy = loadPolicy(path)

  assert.deepEqual(policy, DEFAULT_POLICY)
})

test('loadPolicy parses JSON policy files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.json')
  writeFileSync(path, JSON.stringify({ deny_commands: ['pnpm publish --no-git-checks'] }))

  const policy = loadPolicy(path)

  assert.ok(policy.denyCommands.includes('pnpm publish --no-git-checks'))
})

test('loadPolicy parses the example policy as the full policy surface', () => {
  const policy = loadPolicy(join(process.cwd(), 'examples', 'agent-policy.yaml'))

  assert.ok(policy.denyRead.includes('node_modules/**'))
  assert.ok(policy.denyCommands.includes('gh secret view'))
  assert.ok(policy.requireApproval.includes('vercel --prod'))
  assert.ok(policy.mcp.denyServers.includes('filesystem'))
  assert.ok(policy.mcp.requireApprovalTools.includes('github.merge_pull_request'))
})

test('loadPolicy reports malformed files without leaking file contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, 'deny_commands: [sk-abcdefghijklmnopqrstuvwxyz')

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('loadPolicy reports malformed JSON files without leaking file contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.json')
  writeFileSync(path, '{"deny_commands": ["sk-abcdefghijklmnopqrstuvwxyz"')

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('loadPolicy rejects YAML syntax in JSON policy files without leaking file contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.json')
  writeFileSync(path, ['deny_commands:', '  - sk-abcdefghijklmnopqrstuvwxyz'].join('\n'))

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('loadPolicy reports schema-invalid files without leaking file contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, 'deny_commands: sk-abcdefghijklmnopqrstuvwxyz')

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('loadPolicy rejects blank policy list entries without leaking file contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['deny_commands:', '  - "   "', '  - sk-abcdefghijklmnopqrstuvwxyz'].join('\n'))

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('loadPolicy reports non-object policy files without leaking file contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, 'sk-abcdefghijklmnopqrstuvwxyz')

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('loadPolicy can replace a default list and extend it in the same file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    ['overrides:', '  deny_commands:', '    - custom-only', 'deny_commands:', '  - also-denied'].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.denyCommands, ['custom-only', 'also-denied'])
})

test('loadPolicy can replace default MCP rules and extend them in the same file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  mcp:',
      '    deny_servers:',
      '      - internal-db',
      '    require_approval_tools:',
      '      - github.merge_pull_request',
      'mcp:',
      '  deny_servers:',
      '    - browser',
      '  require_approval_tools:',
      '    - filesystem.write_file',
    ].join('\n'),
  )

  const policy = loadPolicy(path)

  assert.deepEqual(policy.mcp.denyServers, ['internal-db', 'browser'])
  assert.deepEqual(policy.mcp.requireApprovalTools, ['github.merge_pull_request', 'filesystem.write_file'])
})

test('CLI accepts --policy for scan-log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['deny_commands:', '  - terraform destroy'].join('\n'))

  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', path, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: 'terraform destroy',
  })

  assert.equal(result.status, 0)
  const findings = JSON.parse(result.stdout)
  assert.equal(findings[0]?.id, 'denied-command')
  assert.match(findings[0]?.title ?? '', /terraform destroy/)
})

test('CLI reports malformed --policy without leaking policy contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, 'deny_commands: [sk-abcdefghijklmnopqrstuvwxyz')

  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', path], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: 'terraform destroy',
  })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /Unable to load policy file: malformed policy file/)
  assert.doesNotMatch(result.stderr, /sk-abcdefghijklmnopqrstuvwxyz/)
  assert.equal(result.stdout, '')
})

test('CLI rejects --policy without a path before another option', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: 'terraform destroy',
  })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /--policy <path>/)
  assert.equal(result.stdout, '')
})

test('CLI preserves scan-files path when --policy is present', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const workspace = join(dir, 'workspace')
  const policyPath = join(dir, 'agent-policy.yaml')
  writeFileSync(policyPath, ['deny_commands:', '  - agentguard-custom-denied-command'].join('\n'))
  mkdirSync(workspace)
  writeFileSync(join(workspace, 'transcript.log'), 'agentguard-custom-denied-command')

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts', 'scan-files', workspace, '--policy', policyPath, '--json'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )

  assert.equal(result.status, 0)
  const findings = JSON.parse(result.stdout)
  assert.equal(findings.length, 1)
  assert.equal(findings[0]?.file, 'transcript.log')
  assert.equal(findings[0]?.id, 'denied-command')
})

test('CLI applies MCP approval rules from --policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const policyPath = join(dir, 'agent-policy.yaml')
  writeFileSync(policyPath, ['mcp:', '  require_approval_tools:', '    - github.merge_pull_request'].join('\n'))

  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-mcp', '--policy', policyPath, '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: '[mcp_servers.github]\ntools = ["github.merge_pull_request"]',
  })

  assert.equal(result.status, 0)
  const findings = JSON.parse(result.stdout)
  assert.ok(findings.some((finding: { readonly id?: string }) => finding.id === 'mcp-tool-approval-required'))
})
