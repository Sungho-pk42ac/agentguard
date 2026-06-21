import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadPolicy } from '../src/policy.js'

test('loadPolicy uses local agent-policy.yaml when policy path is omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  writeFileSync(join(dir, 'agent-policy.yaml'), 'deny_commands:\n  - local-policy-command\n')
  const previousCwd = process.cwd()

  try {
    process.chdir(dir)

    const policy = loadPolicy()

    assert.ok(policy.denyCommands.includes('local-policy-command'))
  } finally {
    process.chdir(previousCwd)
  }
})

test('loadPolicy uses nearest parent agent-policy.yaml when policy path is omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  const nestedDir = join(dir, 'packages', 'agent')
  mkdirSync(nestedDir, { recursive: true })
  writeFileSync(join(dir, 'agent-policy.yaml'), 'deny_commands:\n  - parent-policy-command\n')
  const previousCwd = process.cwd()

  try {
    process.chdir(nestedDir)

    const policy = loadPolicy()

    assert.ok(policy.denyCommands.includes('parent-policy-command'))
  } finally {
    process.chdir(previousCwd)
  }
})

test('loadPolicy uses local agent-policy.yml when YAML policy uses the short extension', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  writeFileSync(join(dir, 'agent-policy.yml'), 'deny_commands:\n  - local-yml-policy-command\n')
  const previousCwd = process.cwd()

  try {
    process.chdir(dir)

    const policy = loadPolicy()

    assert.ok(policy.denyCommands.includes('local-yml-policy-command'))
  } finally {
    process.chdir(previousCwd)
  }
})

test('loadPolicy uses local agent-policy.json when YAML policy is absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-policy-'))
  writeFileSync(join(dir, 'agent-policy.json'), JSON.stringify({ deny_commands: ['local-json-policy-command'] }))
  const previousCwd = process.cwd()

  try {
    process.chdir(dir)

    const policy = loadPolicy()

    assert.ok(policy.denyCommands.includes('local-json-policy-command'))
  } finally {
    process.chdir(previousCwd)
  }
})
