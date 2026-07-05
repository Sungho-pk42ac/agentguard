import assert from 'node:assert/strict'
import { test } from 'node:test'
import { editorArgs, openInEditor, resolveEditor, type SpawnFn, type SpawnedChild } from '../src/open-in-editor.js'

function fakeSpawn(): { spawnFn: SpawnFn; calls: Array<{ command: string; args: readonly string[] }> } {
  const calls: Array<{ command: string; args: readonly string[] }> = []
  const child: SpawnedChild = { unref: () => {} }
  const spawnFn: SpawnFn = (command, args) => {
    calls.push({ command, args })
    return child
  }
  return { spawnFn, calls }
}

// ── resolveEditor ladder ─────────────────────────────────────────────────────

test('resolveEditor prefers AGENTGUARD_EDITOR over everything else', () => {
  const editor = resolveEditor(
    { AGENTGUARD_EDITOR: 'my-editor', VISUAL: 'vim', EDITOR: 'nano' },
    () => true,
  )
  assert.equal(editor, 'my-editor')
})

test('resolveEditor falls back to VISUAL when AGENTGUARD_EDITOR is unset', () => {
  const editor = resolveEditor({ VISUAL: 'vim', EDITOR: 'nano' }, () => true)
  assert.equal(editor, 'vim')
})

test('resolveEditor falls back to EDITOR when AGENTGUARD_EDITOR/VISUAL are unset', () => {
  const editor = resolveEditor({ EDITOR: 'nano' }, () => true)
  assert.equal(editor, 'nano')
})

test('resolveEditor falls back to PATH detection in the documented order', () => {
  // Only 'subl' and 'idea' are "installed"; 'code'/'cursor'/'windsurf' come first
  // in the detection order but are absent, so 'subl' should win.
  const installed = new Set(['subl', 'idea'])
  const editor = resolveEditor({}, (candidate) => installed.has(candidate))
  assert.equal(editor, 'subl')
})

test('resolveEditor detects "code" first when several PATH candidates are installed', () => {
  const installed = new Set(['vim', 'nvim', 'code'])
  const editor = resolveEditor({}, (candidate) => installed.has(candidate))
  assert.equal(editor, 'code')
})

test('resolveEditor returns undefined when nothing is configured or detected', () => {
  assert.equal(resolveEditor({}, () => false), undefined)
  assert.equal(resolveEditor({}), undefined)
})

// ── editorArgs per-editor line-jump table ───────────────────────────────────

test('editorArgs: code/cursor/windsurf use --goto file:line', () => {
  assert.deepEqual(editorArgs('code', 'a.ts', 10), ['--goto', 'a.ts:10'])
  assert.deepEqual(editorArgs('cursor', 'a.ts', 10), ['--goto', 'a.ts:10'])
  assert.deepEqual(editorArgs('windsurf', 'a.ts', 10), ['--goto', 'a.ts:10'])
})

test('editorArgs: code/cursor/windsurf without a line still use --goto file', () => {
  assert.deepEqual(editorArgs('code', 'a.ts'), ['--goto', 'a.ts'])
})

test('editorArgs: subl uses file:line, or bare file with no line', () => {
  assert.deepEqual(editorArgs('subl', 'a.ts', 10), ['a.ts:10'])
  assert.deepEqual(editorArgs('subl', 'a.ts'), ['a.ts'])
})

test('editorArgs: idea uses --line <n> <file>, or bare file with no line', () => {
  assert.deepEqual(editorArgs('idea', 'a.ts', 10), ['--line', '10', 'a.ts'])
  assert.deepEqual(editorArgs('idea', 'a.ts'), ['a.ts'])
})

test('editorArgs: notepad++ uses -nN <file>, or bare file with no line', () => {
  assert.deepEqual(editorArgs('notepad++', 'a.ts', 10), ['-n10', 'a.ts'])
  assert.deepEqual(editorArgs('notepad++', 'a.ts'), ['a.ts'])
})

test('editorArgs: vim/nvim use +N <file>, or bare file with no line', () => {
  assert.deepEqual(editorArgs('vim', 'a.ts', 10), ['+10', 'a.ts'])
  assert.deepEqual(editorArgs('nvim', 'a.ts', 10), ['+10', 'a.ts'])
  assert.deepEqual(editorArgs('vim', 'a.ts'), ['a.ts'])
})

test('editorArgs: unknown editor just receives the bare file path', () => {
  assert.deepEqual(editorArgs('some-unknown-editor', 'a.ts', 10), ['a.ts'])
  assert.deepEqual(editorArgs('some-unknown-editor', 'a.ts'), ['a.ts'])
})

test('editorArgs matches on the executable base name (path + extension tolerant)', () => {
  assert.deepEqual(editorArgs('/usr/bin/code', 'a.ts', 5), ['--goto', 'a.ts:5'])
  assert.deepEqual(editorArgs('C:\\Program Files\\Vim\\vim.exe', 'a.ts', 5), ['+5', 'a.ts'])
})

// ── openInEditor: resolved editor path ──────────────────────────────────────

test('openInEditor spawns the resolved editor with an args array (no shell string)', () => {
  const { spawnFn, calls } = fakeSpawn()
  const result = openInEditor('a.ts', 42, { env: { AGENTGUARD_EDITOR: 'code' }, spawnFn })
  assert.equal(result.editor, 'code')
  assert.equal(result.command, 'code')
  assert.deepEqual(result.args, ['--goto', 'a.ts:42'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.command, 'code')
  assert.deepEqual(calls[0]?.args, ['--goto', 'a.ts:42'])
})

// ── openInEditor: OS default-app fallback per platform ──────────────────────

test('openInEditor falls back to "cmd /c start" on win32 when no editor resolves', () => {
  const { spawnFn, calls } = fakeSpawn()
  const result = openInEditor('a.ts', 7, { env: {}, platform: 'win32', spawnFn })
  assert.equal(result.editor, undefined)
  assert.equal(result.command, 'cmd')
  assert.deepEqual(result.args, ['/c', 'start', '', 'a.ts'])
  assert.match(result.message ?? '', /line 7/)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { command: 'cmd', args: ['/c', 'start', '', 'a.ts'] })
})

test('openInEditor falls back to "open" on darwin when no editor resolves', () => {
  const { spawnFn, calls } = fakeSpawn()
  const result = openInEditor('a.ts', undefined, { env: {}, platform: 'darwin', spawnFn })
  assert.equal(result.command, 'open')
  assert.deepEqual(result.args, ['a.ts'])
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { command: 'open', args: ['a.ts'] })
})

test('openInEditor falls back to "xdg-open" on linux when no editor resolves', () => {
  const { spawnFn, calls } = fakeSpawn()
  const result = openInEditor('a.ts', 3, { env: {}, platform: 'linux', spawnFn })
  assert.equal(result.command, 'xdg-open')
  assert.deepEqual(result.args, ['a.ts'])
  assert.match(result.message ?? '', /line 3/)
  assert.equal(calls.length, 1)
})

test('openInEditor fallback message omits a line reference when no line is given', () => {
  const { spawnFn } = fakeSpawn()
  const result = openInEditor('a.ts', undefined, { env: {}, platform: 'win32', spawnFn })
  assert.equal(result.message, '열림: 기본 앱')
})

test('openInEditor uses PATH detection when no env variable is set', () => {
  const { spawnFn, calls } = fakeSpawn()
  const result = openInEditor('a.ts', 1, {
    env: {},
    detect: (candidate) => candidate === 'vim',
    spawnFn,
  })
  assert.equal(result.editor, 'vim')
  assert.deepEqual(calls[0], { command: 'vim', args: ['+1', 'a.ts'] })
})
