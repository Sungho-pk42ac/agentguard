import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  baselineSchema,
  buildBaseline,
  diffAgainstBaseline,
  loadBaseline,
  saveBaseline,
} from '../src/baseline.js'
import type { ResidualCredential } from '../src/residual.js'

function residual(id: string, evidence = 'redacted', location = id): ResidualCredential {
  return {
    id,
    kind: 'api-key',
    severity: 'critical',
    surface: 'shell-rc',
    location,
    evidence,
    recommendation: 'rotate',
  }
}

test('default baseline stores identity only and no secret material', () => {
  const baseline = buildBaseline([residual('a', 'OpenAI key: sk-A…AAAA')], { createdAt: '2026-01-01T00:00:00Z' })
  assert.equal(baseline.trackRotation, false)
  const [entry] = baseline.entries
  assert.deepEqual(Object.keys(entry).sort(), ['id', 'location', 'severity', 'surface'])
  assert.equal('valueHash' in entry, false)
  // No redacted evidence leaks into the snapshot.
  assert.doesNotMatch(JSON.stringify(baseline), /sk-/)
})

test('track-rotation baseline adds a value fingerprint hash but not the value', () => {
  const baseline = buildBaseline([residual('a', 'OpenAI key: sk-A…AAAA')], { trackRotation: true })
  assert.equal(baseline.trackRotation, true)
  assert.equal(typeof baseline.entries[0].valueHash, 'string')
  assert.doesNotMatch(JSON.stringify(baseline), /sk-/)
})

test('diff reports appeared and disappeared residuals by identity', () => {
  const baseline = buildBaseline([residual('a'), residual('b')])
  const current = [residual('b'), residual('c')]
  const diff = diffAgainstBaseline(baseline, current)
  assert.deepEqual(diff.appeared.map((r) => r.id), ['c'])
  assert.deepEqual(diff.disappeared.map((e) => e.id), ['a'])
  assert.equal(diff.unchanged, 1)
})

test('track-rotation diff flags a changed value at the same location', () => {
  const baseline = buildBaseline([residual('a', 'OpenAI key: sk-OLD…1234')], { trackRotation: true })
  const current = [residual('a', 'OpenAI key: sk-NEW…5678')]
  const rotatedDiff = diffAgainstBaseline(baseline, current, true)
  assert.deepEqual(rotatedDiff.rotated.map((r) => r.id), ['a'])
  assert.equal(rotatedDiff.unchanged, 0)
})

test('without track-rotation a changed value is treated as unchanged identity', () => {
  const baseline = buildBaseline([residual('a', 'OpenAI key: sk-OLD…1234')], { trackRotation: true })
  const current = [residual('a', 'OpenAI key: sk-NEW…5678')]
  const diff = diffAgainstBaseline(baseline, current, false)
  assert.equal(diff.rotated.length, 0)
  assert.equal(diff.unchanged, 1)
})

test('save then load round-trips a baseline under an injected home dir', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-baseline-'))
  const { path, baseline } = saveBaseline([residual('a')], { homeDir: home, scanId: 'target-pc' })
  assert.match(path, /baselines[\\/]target-pc\.json$/)
  const loaded = loadBaseline('target-pc', home)
  assert.deepEqual(loaded, baseline)
})

test('scan -> save -> mutate -> re-scan -> diff smoke (appeared + disappeared)', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-baseline-smoke-'))
  saveBaseline([residual('a'), residual('b')], { homeDir: home, scanId: 'smoke' })
  const loaded = loadBaseline('smoke', home)
  assert.ok(loaded)
  const rescan = [residual('a'), residual('c')]
  const diff = diffAgainstBaseline(loaded, rescan)
  assert.deepEqual(diff.appeared.map((r) => r.id), ['c'])
  assert.deepEqual(diff.disappeared.map((e) => e.id), ['b'])
})

test('loadBaseline returns undefined when no snapshot exists', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-baseline-missing-'))
  assert.equal(loadBaseline('nope', home), undefined)
})

test('baselineSchema rejects a tampered schema version', () => {
  const baseline = buildBaseline([residual('a')])
  assert.throws(() => baselineSchema.parse({ ...baseline, schemaVersion: 42 }))
})
