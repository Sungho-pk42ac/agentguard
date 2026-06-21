import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy, PolicyLoadError } from '../src/policy.js'

test('loadPolicy reports missing policy files without leaking the requested path', () => {
  const path = join(tmpdir(), `agentguard-policy-missing-sk-abcdefghijklmnopqrstuvwxyz-${process.pid}.yaml`)

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.equal(error.path, path)
      assert.match(error.message, /missing policy file/)
      assert.doesNotMatch(error.message, /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('PolicyLoadError does not serialize a secret-bearing requested path', () => {
  const path = join(tmpdir(), `agentguard-policy-missing-sk-abcdefghijklmnopqrstuvwxyz-${process.pid}.yaml`)

  assert.throws(
    () => loadPolicy(path),
    (error: unknown) => {
      assert.ok(error instanceof PolicyLoadError)
      assert.equal(error.path, path)
      assert.equal(Object.keys(error).includes('path'), false)
      assert.doesNotMatch(JSON.stringify(error), /sk-abcdefghijklmnopqrstuvwxyz/)
      return true
    },
  )
})

test('CLI reports missing --policy files without leaking the requested path', () => {
  const path = join(tmpdir(), `agentguard-policy-missing-sk-abcdefghijklmnopqrstuvwxyz-${process.pid}.yaml`)

  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'scan-log', '--policy', path], {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: 'terraform destroy',
  })

  assert.equal(result.status, 2)
  assert.match(result.stderr, /Unable to load policy file: missing policy file/)
  assert.doesNotMatch(result.stderr, /sk-abcdefghijklmnopqrstuvwxyz/)
  assert.equal(result.stdout, '')
})
