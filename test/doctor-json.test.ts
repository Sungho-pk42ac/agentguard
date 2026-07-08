import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('CLI doctor --json prints machine-readable readiness with the text doctor exit status', () => {
  const textResult = runDoctor()
  const jsonResult = runDoctor('--json')

  assert.equal(jsonResult.status, textResult.status, jsonResult.stderr)
  assert.equal(jsonResult.stderr, '')
  const parsed: unknown = JSON.parse(jsonResult.stdout)
  assertDoctorJson(parsed)
  assert.equal(parsed['tool'], 'agentguard')
  assert.ok(parsed['status'] === 'PASS' || parsed['status'] === 'FAIL')
  assert.equal(parsed['status'], jsonResult.status === 0 ? 'PASS' : 'FAIL')
  assert.equal(parsed['updateCommand'], 'npm i -g @pk42ac/agentguard@latest')
  assert.ok(parsed['checks'].length >= 3)
})

function runDoctor(...args: readonly string[]): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'doctor', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

function assertDoctorJson(value: unknown): asserts value is {
  readonly tool: string
  readonly status: string
  readonly checks: readonly {
    readonly label: string
    readonly detail: string
    readonly passed: boolean
  }[]
  readonly updateCommand: string
} {
  assert.ok(isRecord(value), 'doctor JSON should be an object')
  assert.equal(typeof value['tool'], 'string')
  assert.equal(typeof value['status'], 'string')
  assert.ok(Array.isArray(value['checks']), 'doctor JSON checks should be an array')
  for (const check of value['checks']) {
    assert.ok(isRecord(check), 'doctor JSON check should be an object')
    assert.equal(typeof check['label'], 'string')
    assert.equal(typeof check['detail'], 'string')
    assert.equal(typeof check['passed'], 'boolean')
  }
  assert.equal(typeof value['updateCommand'], 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
