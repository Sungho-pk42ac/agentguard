import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import {
  HOOK_SENTINEL,
  hookScriptContents,
  installHook,
  inspectHookStatus,
  resolveHookPath,
  uninstallHook,
  type HookIo,
} from '../src/hook.js'

function runCli(args: string[], input?: string, cwd = process.cwd()) {
  const tsxLoader = pathToFileURL(resolve('node_modules/tsx/dist/loader.mjs')).href
  return spawnSync(process.execPath, ['--import', tsxLoader, resolve('src/index.ts'), ...args], {
    cwd,
    input,
    encoding: 'utf8',
  })
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

test('hookScriptContents pipes the staged diff into scan-diff and blocks on its exit code', () => {
  const script = hookScriptContents()
  assert.match(script, /^#!\/bin\/sh/)
  // Uses the staged diff + scan-diff (the CLI owns the advisory-aware gate) —
  // NOT the broken scan-files-on-filenames / grep-JSON approach.
  assert.match(script, /git diff --cached/)
  assert.match(script, /agentguard scan-diff/)
  assert.doesNotMatch(script, /scan-files --json/, 'must not use the directory-root scan-files with file names')
  assert.doesNotMatch(script, /grep -o/, 'must not re-derive criticality via brittle JSON grep')
  assert.doesNotMatch(script, /\|\| echo '\[\]'/, 'must not fallback-mask findings to []')
  // Blocks on exit 1 (a non-advisory critical), allows otherwise.
  assert.match(script, /status=\$\?/)
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

// ── inspectHookStatus ─────────────────────────────────────────────────────────

test('inspectHookStatus reports installed for an agentguard-managed hook', () => {
  const { io } = fakeFs({ '/repo/.git/hooks/pre-commit': hookScriptContents() })
  assert.deepEqual(inspectHookStatus(io), {
    installed: true,
    path: '/repo/.git/hooks/pre-commit',
    reason: 'managed',
  })
})

test('inspectHookStatus reports not installed when the hook is missing', () => {
  const { io } = fakeFs()
  assert.deepEqual(inspectHookStatus(io), {
    installed: false,
    path: '/repo/.git/hooks/pre-commit',
    reason: 'missing',
  })
})

test('inspectHookStatus reports not installed for a foreign hook and stays read-only', () => {
  const writes: string[] = []
  const chmodCalls: Array<{ path: string; mode: number }> = []
  const unlinkCalls: string[] = []
  const { io } = fakeFs({ '/repo/.githooks/pre-commit': '#!/bin/sh\necho custom\n' })
  const wrapped: HookIo = {
    ...io,
    hooksPath: '/repo/.githooks',
    writeFile: (path, contents) => {
      writes.push(path)
      io.writeFile(path, contents)
    },
    chmod: (path, mode) => chmodCalls.push({ path, mode }),
    unlink: (path) => unlinkCalls.push(path),
  }

  assert.deepEqual(inspectHookStatus(wrapped), {
    installed: false,
    path: '/repo/.githooks/pre-commit',
    reason: 'foreign',
  })
  assert.deepEqual(writes, [])
  assert.deepEqual(chmodCalls, [])
  assert.deepEqual(unlinkCalls, [])
})

// ── E2E: the exit-code contract the hook relies on ────────────────────────────
// The hook defers entirely to `agentguard scan-diff`'s exit code. These tests
// execute the REAL CLI against unified diffs so the block/allow behavior of the
// installed hook is actually exercised (the earlier suite never ran the script,
// which is how a non-functional hook shipped green).

function diff(addedLine: string): string {
  return [
    'diff --git a/secret.env b/secret.env',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/secret.env',
    '@@ -0,0 +1 @@',
    `+${addedLine}`,
    '',
  ].join('\n')
}

test('E2E: scan-diff exits 1 on a staged critical secret (the hook blocks the commit)', () => {
  const result = runCli(['scan-diff'], diff('OPENAI_KEY=sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX0123456789abcd'))
  assert.equal(result.status, 1, `expected block (exit 1); stdout=${result.stdout}`)
})

test('E2E: scan-diff exits 0 on a clean staged change (the hook allows the commit)', () => {
  const result = runCli(['scan-diff'], diff('const answer = 42'))
  assert.equal(result.status, 0, `expected allow (exit 0); stdout=${result.stdout}`)
})

test('E2E: a non-critical (high) staged finding does NOT block — only critical blocks', () => {
  // `rm -rf /` is a high-severity dangerous-command finding, not critical.
  const result = runCli(['scan-diff'], diff('run: rm -rf /'))
  assert.equal(result.status, 0, `high-severity findings must not block a commit; stdout=${result.stdout}`)
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
  assert.match(result.stdout, /agentguard hook install\|uninstall\|status/)
})

test('CLI "hook status" exits 0 for an installed agentguard hook and writes no stdout', () => {
  const install = runCli(['hook', 'install'])
  assert.equal(install.status, 0, install.stderr)
  const result = runCli(['hook', 'status'])
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /installed/)
  assert.match(result.stderr, /pre-commit/)
})

test('CLI "hook status" exits 1 when no agentguard hook is installed', () => {
  const uninstall = runCli(['hook', 'uninstall'])
  assert.equal(uninstall.status, 0, uninstall.stderr)
  const result = runCli(['hook', 'status'])
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /not installed/)
  assert.match(result.stderr, /pre-commit/)
})

test('CLI "hook status --json" exits 1 and prints missing-hook JSON when no hook is installed', () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'agentguard-hook-json-'))
  try {
    const init = spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf8' })
    assert.equal(init.status, 0, init.stderr)

    const result = runCli(['hook', 'status', '--json'], undefined, repoDir)
    assert.equal(result.status, 1)
    assert.equal(result.stderr, '')
    assert.deepEqual(JSON.parse(result.stdout), {
      installed: false,
      path: '.git/hooks/pre-commit',
      reason: 'missing',
    })
  } finally {
    rmSync(repoDir, { recursive: true, force: true })
  }
})

test('CLI "hook status --json" exits 0 and prints installed-hook JSON when managed hook exists', () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'agentguard-hook-json-installed-'))
  try {
    const init = spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf8' })
    assert.equal(init.status, 0, init.stderr)
    const install = runCli(['hook', 'install'], undefined, repoDir)
    assert.equal(install.status, 0, install.stderr)

    const result = runCli(['hook', 'status', '--json'], undefined, repoDir)
    assert.equal(result.status, 0)
    assert.equal(result.stderr, '')
    assert.deepEqual(JSON.parse(result.stdout), {
      installed: true,
      path: '.git/hooks/pre-commit',
      reason: 'managed',
    })
  } finally {
    rmSync(repoDir, { recursive: true, force: true })
  }
})
