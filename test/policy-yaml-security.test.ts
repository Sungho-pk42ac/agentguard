import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setImmediate as waitImmediate } from 'node:timers/promises'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'

test('loadPolicy rejects duplicate YAML keys without leaking overwritten contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    ['deny_commands:', '  - sk-abcdefghijklmnopqrstuvwxyz', 'deny_commands:', '  - rm -rf /tmp/demo'].join('\n'),
  )

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      assert.doesNotMatch(error.message, /rm -rf/)
      return true
    },
  )
})

test('loadPolicy rejects YAML aliases without leaking expanded contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    [
      'overrides:',
      '  deny_commands: &secret_commands',
      '    - sk-abcdefghijklmnopqrstuvwxyz',
      'deny_commands: *secret_commands',
    ].join('\n'),
  )

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      assert.doesNotMatch(error.message, /secret_commands/)
      return true
    },
  )
})

test('loadPolicy rejects YAML custom tags without leaking tagged contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['deny_commands:', '  - !secret sk-abcdefghijklmnopqrstuvwxyz'].join('\n'))

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.match(error.message, /malformed policy file/)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      assert.doesNotMatch(error.message, /!secret/)
      return true
    },
  )
})

test('loadPolicy rejects YAML prototype pollution keys without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    ['__proto__:', '  secret: sk-abcdefghijklmnopqrstuvwxyz', 'deny_commands:', '  - rm -rf /tmp/demo'].join('\n'),
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

test('loadPolicy rejects YAML non-scalar keys without leaking parser warnings', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['? [sk-abcdefghijklmnopqrstuvwxyz]', ': deny_commands'].join('\n'))
  const warnings: string[] = []
  const onWarning = (warning: Error) => warnings.push(warning.message)

  process.prependListener('warning', onWarning)
  try {
    assert.throws(
      () => loadPolicy(path),
      (error: unknown) => {
        assert.ok(error instanceof PolicyLoadError)
        assert.match(error.message, /malformed policy file/)
        assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
        return true
      },
    )
    await waitImmediate()
  } finally {
    process.removeListener('warning', onWarning)
  }

  assert.equal(warnings.some((warning) => /sk-abcdefghijklmnopqrstuvwxyz/.test(warning)), false)
})

test('CLI rejects YAML non-scalar keys without leaking parser warnings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, ['? [sk-abcdefghijklmnopqrstuvwxyz]', ': deny_commands'].join('\n'))

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

test('loadPolicy rejects multi-document YAML policies without leaking contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(
    path,
    ['deny_commands:', '  - sk-abcdefghijklmnopqrstuvwxyz', '---', 'deny_commands:', '  - rm -rf /tmp/demo'].join(
      '\n',
    ),
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

test('loadPolicy ignores inherited prototype policy keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const path = join(dir, 'agent-policy.yaml')
  writeFileSync(path, '{}')
  Reflect.defineProperty(Object.prototype, 'deny_commands', {
    value: ['agentguard-prototype-command'],
    configurable: true,
  })

  try {
    const policy = loadPolicy(path)

    assert.equal(policy.denyCommands.includes('agentguard-prototype-command'), false)
  } finally {
    Reflect.deleteProperty(Object.prototype, 'deny_commands')
  }
})
