import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveScanInput, ScanInputError } from '../src/scan-input.js'

// ────────────────────────────────────────────────────────────
// Matrix: isTTY × arg presence × stdin behaviour
// ────────────────────────────────────────────────────────────

test('resolveScanInput: non-TTY without arg reads stdin (byte-identical piped path)', () => {
  const result = resolveScanInput({
    isTTY: false,
    arg: undefined,
    readStdin: () => 'piped content',
    readFile: () => {
      throw new Error('readFile must not be called in non-TTY mode')
    },
  })
  assert.equal(result, 'piped content')
})

test('resolveScanInput: non-TTY with arg still reads stdin — arg is ignored (stdin-first)', () => {
  let fileReaderCalled = false
  const result = resolveScanInput({
    isTTY: false,
    arg: 'some-file.toml',
    readStdin: () => 'piped content ignores arg',
    readFile: () => {
      fileReaderCalled = true
      return 'file content'
    },
  })
  assert.equal(result, 'piped content ignores arg')
  assert.equal(fileReaderCalled, false, 'readFile must not be called when not a TTY')
})

test('resolveScanInput: TTY with arg reads the named file', () => {
  const result = resolveScanInput({
    isTTY: true,
    arg: 'config.toml',
    readStdin: () => {
      throw new Error('readStdin must not be called when TTY and arg is provided')
    },
    readFile: (p) => `content of ${p}`,
  })
  assert.equal(result, 'content of config.toml')
})

test('resolveScanInput: TTY without arg reads stdin (unchanged legacy interactive behavior)', () => {
  const result = resolveScanInput({
    isTTY: true,
    arg: undefined,
    readStdin: () => 'typed input',
    readFile: () => {
      throw new Error('readFile must not be called when TTY but no arg')
    },
  })
  assert.equal(result, 'typed input')
})

test('resolveScanInput: TTY with missing file throws ScanInputError wrapping ENOENT', () => {
  assert.throws(
    () =>
      resolveScanInput({
        isTTY: true,
        arg: '/does/not/exist.toml',
        readStdin: () => '',
        readFile: (p) => {
          throw Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), {
            code: 'ENOENT',
          })
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ScanInputError, `expected ScanInputError, got ${String(err)}`)
      assert.match(err.reason, /ENOENT/)
      // The caller prints only err.reason to stderr — no raw stack. The error object
      // itself has a stack (expected), but callers must not forward it to the user.
      assert.equal(err.reason, err.message, 'reason should match the wrapped error message')
      return true
    },
  )
})

test('resolveScanInput: TTY with unreadable file throws ScanInputError wrapping generic read error', () => {
  assert.throws(
    () =>
      resolveScanInput({
        isTTY: true,
        arg: 'locked.toml',
        readStdin: () => '',
        readFile: () => {
          throw Object.assign(new Error("EACCES: permission denied, open 'locked.toml'"), {
            code: 'EACCES',
          })
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ScanInputError)
      assert.match(err.reason, /EACCES|permission/)
      return true
    },
  )
})

test('resolveScanInput: ScanInputError has correct name and reason fields', () => {
  let thrown: unknown
  try {
    resolveScanInput({
      isTTY: true,
      arg: 'bad.toml',
      readStdin: () => '',
      readFile: () => {
        throw new Error('read failure')
      },
    })
  } catch (err) {
    thrown = err
  }
  assert.ok(thrown instanceof ScanInputError)
  assert.equal(thrown.name, 'ScanInputError')
  assert.equal(thrown.reason, 'read failure')
})
