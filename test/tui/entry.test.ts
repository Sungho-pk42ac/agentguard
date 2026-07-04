import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { shouldLaunchRepl } from '../../src/tui/entry.js'

test('shouldLaunchRepl launches on bare args only when both stdin and stdout are TTYs', () => {
  assert.equal(shouldLaunchRepl([], true, true), true)
  assert.equal(shouldLaunchRepl([], false, true), false)
  assert.equal(shouldLaunchRepl([], true, false), false)
  assert.equal(shouldLaunchRepl([], false, false), false)
})

test('shouldLaunchRepl launches on explicit repl / --interactive regardless of TTY', () => {
  assert.equal(shouldLaunchRepl(['repl'], false, false), true)
  assert.equal(shouldLaunchRepl(['--interactive'], false, false), true)
})

test('shouldLaunchRepl never launches for subcommands', () => {
  assert.equal(shouldLaunchRepl(['scan-files'], true, true), false)
  assert.equal(shouldLaunchRepl(['posture'], true, true), false)
})

test('non-TTY bare agentguard falls through to usage on stderr with exit 2 (script compat)', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: process.cwd(),
    input: '',
    encoding: 'utf8',
  })
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /Usage:/)
  assert.match(result.stderr, /agentguard scan-files/)
})

test('usage lists the interactive repl entry', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /agentguard repl/)
})
