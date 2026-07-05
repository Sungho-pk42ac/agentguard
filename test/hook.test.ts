import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import {
  classifyStagedScan,
  HOOK_SENTINEL,
  hookScriptContents,
  installHook,
  resolveHookPath,
  uninstallHook,
  type HookIo,
} from '../src/hook.js'
import type { Finding } from '../src/rules.js'

function runCli(args: string[], input?: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', ...args], {
    cwd: process.cwd(),
    input,
    encoding: 'utf8',
  })
}

function fakeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'F1',
    title: 'test finding',
    severity: 'low',
    category: 'secret',
    evidence: 'redacted',
    recommendation: 'fix it',
    ...overrides,
  }
}

function fakeFs(initial: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(initial))
  const chmodCalls: Array<{ path: string; mode: number }> = []
  const mkdirCalls: string[] = []
  const io: HookIo = {
    gitDir: '/repo/.git',
    existsSync: (path) => files.has(path),
    readFile: (path) => {
      const contents = files.get(path)
      if (contents === undefined) throw new Error(`ENOENT: ${path}`)
      return contents
    },
    writeFile: (path, contents) => {
      files.set(path, contents)
    },
    mkdir: (path) => {
      mkdirCalls.push(path)
    },
    chmod: (path, mode) => {
      chmodCalls.push({ path, mode })
    },
    unlink: (path) => {
      files.delete(path)
    },
  }
  return { io, files, chmodCalls, mkdirCalls }
}

// ── hookScriptContents ───────────────────────────────────────────────────────

test('hookScriptContents includes the sentinel marker', () => {
  assert.ok(hookScriptContents().includes(HOOK_SENTINEL))
})

test('hookScriptContents is a POSIX-sh script that blocks on a critical finding', () => {
  const script = hookScriptContents()
  assert.match(script, /^#!\/bin\/sh/)
  assert.match(script, /scan-files --json/)
  assert.match(script, /critical/)
  assert.match(script, /exit 1/)
  assert.match(script, /core\.hooksPath/)
})

// ── resolveHookPath ───────────────────────────────────────────────────────────

test('resolveHookPath defaults to <gitDir>/hooks/pre-commit', () => {
  assert.equal(resolveHookPath('/repo/.git'), '/repo/.git/hooks/pre-commit')
})

test('resolveHookPath honors an explicit core.hooksPath', () => {
  assert.equal(resolveHookPath('/repo/.git', '/repo/.githooks'), '/repo/.githooks/pre-commit')
})

// ── installHook ───────────────────────────────────────────────────────────────

test('installHook writes the managed script when no hook exists', () => {
  const { io, files } = fakeFs()
  const result = installHook(io)
  assert.deepEqual(result, { installed: true, path: '/repo/.git/hooks/pre-commit' })
  assert.equal(files.get('/repo/.git/hooks/pre-commit'), hookScriptContents())
})

test('installHook sets the hook executable via chmod', () => {
  const { io, chmodCalls } = fakeFs()
  installHook(io)
  assert.deepEqual(chmodCalls, [{ path: '/repo/.git/hooks/pre-commit', mode: 0o755 }])
})

test('installHook is idempotent: re-installing over its own hook does not back up', () => {
  const { io, files } = fakeFs({ '/repo/.git/hooks/pre-commit': hookScriptContents() })
  const result = installHook(io)
  assert.deepEqual(result, { installed: true, path: '/repo/.git/hooks/pre-commit' })
  assert.equal(files.has('/repo/.git/hooks/pre-commit.agentguard.bak'), false)
})

test('installHook backs up a foreign (non-agentguard) hook before overwriting', () => {
  const foreignHook = '#!/bin/sh\necho "custom hook"\n'
  const { io, files } = fakeFs({ '/repo/.git/hooks/pre-commit': foreignHook })
  const result = installHook(io)
  assert.equal(result.backedUp, '/repo/.git/hooks/pre-commit.agentguard.bak')
  assert.equal(files.get('/repo/.git/hooks/pre-commit.agentguard.bak'), foreignHook)
  assert.equal(files.get('/repo/.git/hooks/pre-commit'), hookScriptContents())
})

test('installHook never clobbers a foreign hook without first writing a backup', () => {
  const foreignHook = '#!/bin/sh\necho "custom hook"\n'
  const writes: string[] = []
  const { io } = fakeFs({ '/repo/.git/hooks/pre-commit': foreignHook })
  const wrapped: HookIo = {
    ...io,
    writeFile: (path, contents) => {
      writes.push(path)
      io.writeFile(path, contents)
    },
  }
  installHook(wrapped)
  const backupIndex = writes.indexOf('/repo/.git/hooks/pre-commit.agentguard.bak')
  const mainIndex = writes.indexOf('/repo/.git/hooks/pre-commit')
  assert.ok(backupIndex !== -1 && backupIndex < mainIndex)
})

// ── uninstallHook ─────────────────────────────────────────────────────────────

test('uninstallHook removes a managed hook with no prior backup', () => {
  const { io, files } = fakeFs({ '/repo/.git/hooks/pre-commit': hookScriptContents() })
  const result = uninstallHook(io)
  assert.deepEqual(result, { removed: true })
  assert.equal(files.has('/repo/.git/hooks/pre-commit'), false)
})

test('uninstallHook restores a backed-up foreign hook', () => {
  const foreignHook = '#!/bin/sh\necho "custom hook"\n'
  const { io, files } = fakeFs({
    '/repo/.git/hooks/pre-commit': hookScriptContents(),
    '/repo/.git/hooks/pre-commit.agentguard.bak': foreignHook,
  })
  const result = uninstallHook(io)
  assert.deepEqual(result, { removed: true, restored: true })
  assert.equal(files.get('/repo/.git/hooks/pre-commit'), foreignHook)
  assert.equal(files.has('/repo/.git/hooks/pre-commit.agentguard.bak'), false)
})

test('uninstallHook leaves a foreign (non-agentguard) hook untouched', () => {
  const foreignHook = '#!/bin/sh\necho "custom hook"\n'
  const { io, files } = fakeFs({ '/repo/.git/hooks/pre-commit': foreignHook })
  const result = uninstallHook(io)
  assert.deepEqual(result, { removed: false })
  assert.equal(files.get('/repo/.git/hooks/pre-commit'), foreignHook)
})

test('uninstallHook is a no-op when no hook file exists', () => {
  const { io } = fakeFs()
  assert.deepEqual(uninstallHook(io), { removed: false })
})

// ── classifyStagedScan ──────────────────────────────────────────────────────

test('classifyStagedScan blocks when a non-advisory critical finding is present', () => {
  const findings = [fakeFinding({ severity: 'low' }), fakeFinding({ severity: 'critical' })]
  assert.deepEqual(classifyStagedScan(findings), { block: true, criticalCount: 1 })
})

test('classifyStagedScan ignores advisory-tagged critical findings', () => {
  const findings = [fakeFinding({ severity: 'critical', advisory: true })]
  assert.deepEqual(classifyStagedScan(findings), { block: false, criticalCount: 0 })
})

test('classifyStagedScan does not block on non-critical severities', () => {
  const findings = [fakeFinding({ severity: 'high' }), fakeFinding({ severity: 'medium' })]
  assert.deepEqual(classifyStagedScan(findings), { block: false, criticalCount: 0 })
})

test('classifyStagedScan counts multiple non-advisory critical findings', () => {
  const findings = [
    fakeFinding({ severity: 'critical' }),
    fakeFinding({ severity: 'critical' }),
    fakeFinding({ severity: 'critical', advisory: true }),
  ]
  assert.deepEqual(classifyStagedScan(findings), { block: true, criticalCount: 2 })
})

test('classifyStagedScan returns block:false for an empty findings list', () => {
  assert.deepEqual(classifyStagedScan([]), { block: false, criticalCount: 0 })
})

// ── CLI wiring ────────────────────────────────────────────────────────────────

test('CLI "hook" with no subcommand exits 2 with usage on stderr', () => {
  const result = runCli(['hook'])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

test('CLI "hook" with an unknown subcommand exits 2 with usage on stderr', () => {
  const result = runCli(['hook', 'frobnicate'])
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Usage:/)
})

test('CLI usage text documents the hook verb', () => {
  const result = runCli(['--help'])
  assert.match(result.stdout, /agentguard hook install\|uninstall/)
})
