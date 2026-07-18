import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('CLI doctor --json prints machine-readable readiness with the text doctor exit status', () => {
  const textResult = runDoctor()
  const jsonResult = runDoctor('--json')

  assert.equal(jsonResult.status, textResult.status, jsonResult.stderr)
  assert.equal(jsonResult.stderr, '')
  const parsed: unknown = JSON.parse(jsonResult.stdout)
  assertDoctorJson(parsed)
  assert.equal(parsed['schemaVersion'], 1)
  assert.equal(parsed['tool'], 'agentguard')
  assert.ok(parsed['status'] === 'PASS' || parsed['status'] === 'FAIL')
  assert.equal(parsed['status'], jsonResult.status === 0 ? 'PASS' : 'FAIL')
  assert.match(
    parsed['generatedAt'],
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    'doctor JSON should expose a top-level ISO-8601 UTC generatedAt freshness timestamp',
  )
  assert.ok(!Number.isNaN(Date.parse(parsed['generatedAt'])), 'generatedAt should be parseable by Date.parse')
  assert.equal(parsed['updateCommand'], 'npm i -g @pk42ac/agentguard@latest')
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  assert.equal(parsed['packageVersion'], packageJson.version)
  assert.ok(parsed['checks'].length >= 3)
  assert.equal(parsed['summary'].total, parsed['checks'].length)
  assert.equal(parsed['summary'].passed, parsed['checks'].filter((check) => check.passed).length)
  assert.equal(parsed['summary'].failed, parsed['checks'].filter((check) => !check.passed).length)
  const checkIds = new Set(parsed['checks'].map((check) => check.id))
  assert.equal(checkIds.size, parsed['checks'].length, 'doctor check ids should be unique')
  assert.ok(checkIds.has('package_version'))
  assert.ok(checkIds.has('examples_directory'))
  assert.ok(checkIds.has('scanner_smoke'))
  assert.ok(checkIds.has('github_action_contract'))
  assert.ok(checkIds.has('documentation_readiness'))

  const docsCheck = parsed['checks'].find((check) => check.id === 'documentation_readiness')
  assert.ok(docsCheck, 'doctor JSON should include team documentation readiness')
  assert.equal(docsCheck.passed, true)
  assert.match(docsCheck.detail, /README\.md/)
  assert.match(docsCheck.detail, /docs\/github-action\.md/)
  assert.match(docsCheck.detail, /docs\/team-rollout-baseline-guide\.md/)
  assert.match(docsCheck.detail, /docs\/policy\.md/)

  const actionCheck = parsed['checks'].find((check) => check.id === 'github_action_contract')
  assert.ok(actionCheck, 'doctor JSON should include reusable GitHub Action contract readiness')
  assert.equal(actionCheck.passed, true)
  assert.match(actionCheck.detail, /action\.yml/)
  assert.match(actionCheck.detail, /base-sha/)
  assert.match(actionCheck.detail, /head-sha/)
  assert.match(actionCheck.detail, /fail-on/)
  assert.match(actionCheck.detail, /package-version/)
  assert.match(actionCheck.detail, /report-path/)
  assert.match(actionCheck.detail, /json-path/)
  assert.match(actionCheck.detail, /sarif-path/)
  assert.match(actionCheck.detail, /artifact/i)
  assert.match(
    actionCheck.detail,
    /\.github\/actions\/agentguard\/action\.yml/,
    'doctor JSON should prove the repo-local fallback action contract was checked',
  )
})

test('CLI doctor text output includes reusable GitHub Action contract readiness', () => {
  const koResult = runDoctor('--lang', 'ko')
  const enResult = runDoctor('--lang', 'en')

  assert.equal(koResult.status, 0, koResult.stderr)
  assert.match(koResult.stdout, /GitHub Action/)
  assert.match(koResult.stdout, /action\.yml/)
  assert.match(koResult.stdout, /\.github\/actions\/agentguard\/action\.yml/)
  assert.match(enResult.stdout, /GitHub Action/)
  assert.match(enResult.stdout, /action\.yml/)
  assert.match(enResult.stdout, /\.github\/actions\/agentguard\/action\.yml/)
})

test('CLI doctor help lists every current readiness check for team rollout discovery', () => {
  const result = runDoctor('--help')

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /agentguard doctor \[--lang ko\|en\] \[--json\]/)
  assert.match(result.stdout, /package version readability/)
  assert.match(result.stdout, /examples directory presence/)
  assert.match(result.stdout, /scanner smoke test/)
  assert.match(result.stdout, /reusable GitHub Action contract/i)
  assert.match(result.stdout, /PR gate readiness/i)
  assert.match(result.stdout, /team documentation readiness/i)
})

function runDoctor(...args: readonly string[]): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'doctor', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
}

function assertDoctorJson(value: unknown): asserts value is {
  readonly schemaVersion: number
  readonly tool: string
  readonly status: string
  readonly generatedAt: string
  readonly checks: readonly {
    readonly id: string
    readonly label: string
    readonly detail: string
    readonly passed: boolean
  }[]
  readonly summary: {
    readonly total: number
    readonly passed: number
    readonly failed: number
  }
  readonly packageVersion: string
  readonly updateCommand: string
} {
  assert.ok(isRecord(value), 'doctor JSON should be an object')
  assert.equal(typeof value['schemaVersion'], 'number')
  assert.equal(typeof value['tool'], 'string')
  assert.equal(typeof value['status'], 'string')
  assert.equal(typeof value['generatedAt'], 'string')
  assert.ok(Array.isArray(value['checks']), 'doctor JSON checks should be an array')
  assert.ok(isRecord(value['summary']), 'doctor JSON summary should be an object')
  assert.equal(typeof value['summary']['total'], 'number')
  assert.equal(typeof value['summary']['passed'], 'number')
  assert.equal(typeof value['summary']['failed'], 'number')
  for (const check of value['checks']) {
    assert.ok(isRecord(check), 'doctor JSON check should be an object')
    const id = check['id']
    assert.ok(typeof id === 'string', 'doctor JSON check id should be a string')
    assert.match(id, /^[a-z][a-z0-9_]*$/)
    assert.equal(typeof check['label'], 'string')
    assert.equal(typeof check['detail'], 'string')
    assert.equal(typeof check['passed'], 'boolean')
  }
  assert.equal(typeof value['packageVersion'], 'string')
  assert.equal(typeof value['updateCommand'], 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
