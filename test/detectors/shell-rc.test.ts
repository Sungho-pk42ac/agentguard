import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { scanShellRc, scanShellRcText, shellRcCandidatePaths } from '../../src/detectors/shell-rc.js'

test('scanShellRcText flags an exported OpenAI-style key and redacts the value', () => {
  const key = `sk-${'A'.repeat(44)}`
  const results = scanShellRcText(`export OPENAI_API_KEY=${key}\n`, '/home/x/.bashrc')
  assert.equal(results.length, 1)
  const [finding] = results
  assert.equal(finding.kind, 'api-key')
  assert.equal(finding.severity, 'critical')
  assert.equal(finding.surface, 'shell-rc')
  assert.equal(finding.line, 1)
  assert.match(finding.evidence, /OpenAI-style API key/)
  assert.match(finding.evidence, /…/)
  assert.doesNotMatch(finding.evidence, new RegExp(key))
})

test('scanShellRcText flags a credential-named env var with an opaque value', () => {
  const results = scanShellRcText('export MY_SERVICE_TOKEN=abcdefgh12345678\n', '/home/x/.zshrc')
  assert.equal(results.length, 1)
  assert.equal(results[0].kind, 'api-key')
  assert.equal(results[0].severity, 'high')
  assert.match(results[0].evidence, /MY_SERVICE_TOKEN/)
  assert.doesNotMatch(results[0].evidence, /abcdefgh12345678/)
})

test('scanShellRcText handles PowerShell $env assignments', () => {
  const results = scanShellRcText('$env:ANTHROPIC_API_KEY = "sk-ant-' + 'B'.repeat(30) + '"\n', 'C:/Users/x/profile.ps1')
  assert.equal(results.length, 1)
  assert.match(results[0].evidence, /Anthropic API key/)
})

test('scanShellRcText ignores commented-out sample lines', () => {
  const results = scanShellRcText(`# export OPENAI_API_KEY=sk-${'C'.repeat(44)}\n`, '/home/x/.bashrc')
  assert.equal(results.length, 0)
})

test('scanShellRcText does not double-report a known key as a generic env var', () => {
  const results = scanShellRcText(`export OPENAI_API_KEY=sk-${'D'.repeat(44)}\n`, '/home/x/.bashrc')
  assert.equal(results.length, 1)
})

test('shellRcCandidatePaths returns PowerShell profiles on win32 and posix rc on linux', () => {
  const win = shellRcCandidatePaths({ homeDir: 'C:/Users/x', platform: 'win32' })
  assert.ok(win.some((p) => p.includes('Microsoft.PowerShell_profile.ps1')))
  const linux = shellRcCandidatePaths({ homeDir: '/home/x', platform: 'linux' })
  assert.ok(linux.some((p) => p.endsWith('.bashrc')))
  assert.ok(linux.every((p) => !p.includes('PowerShell')))
})

test('scanShellRc reads existing rc files under an injected home dir', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-rc-'))
  writeFileSync(join(home, '.bashrc'), `export OPENAI_API_KEY=sk-${'E'.repeat(44)}\n`)
  const results = scanShellRc({ homeDir: home, platform: 'linux' })
  assert.equal(results.length, 1)
  assert.equal(results[0].path, join(home, '.bashrc'))
})

test('scanShellRc returns nothing when no rc files exist', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-rc-empty-'))
  assert.deepEqual(scanShellRc({ homeDir: home, platform: 'linux' }), [])
})
