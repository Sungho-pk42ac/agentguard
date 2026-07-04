import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutForWidth } from '../../src/tui/layout.js'

// ── Full-width (≥100 columns) ─────────────────────────────────────────────────

test('layoutForWidth(120) → full chart, no stack, no warn', () => {
  const l = layoutForWidth(120)
  assert.equal(l.chart, 'full')
  assert.equal(l.stack, false)
  assert.equal(l.warn, false)
})

test('layoutForWidth(100) → full chart, no stack, no warn (boundary)', () => {
  const l = layoutForWidth(100)
  assert.equal(l.chart, 'full')
  assert.equal(l.stack, false)
  assert.equal(l.warn, false)
})

// ── Narrow (60 ≤ columns < 100) ───────────────────────────────────────────────

test('layoutForWidth(80) → compact chart, no stack, no warn', () => {
  const l = layoutForWidth(80)
  assert.equal(l.chart, 'compact')
  assert.equal(l.stack, false)
  assert.equal(l.warn, false)
})

test('layoutForWidth(60) → compact chart, no stack, no warn (boundary)', () => {
  const l = layoutForWidth(60)
  assert.equal(l.chart, 'compact')
  assert.equal(l.stack, false)
  assert.equal(l.warn, false)
})

// ── Very narrow (40 ≤ columns < 60) ──────────────────────────────────────────

test('layoutForWidth(50) → compact chart, stack=true, warn=true', () => {
  const l = layoutForWidth(50)
  assert.equal(l.chart, 'compact')
  assert.equal(l.stack, true)
  assert.equal(l.warn, true)
})

test('layoutForWidth(40) → compact chart, stack=true, warn=true (boundary)', () => {
  const l = layoutForWidth(40)
  assert.equal(l.chart, 'compact')
  assert.equal(l.stack, true)
  assert.equal(l.warn, true)
})

// ── Below 40 (chart hidden) ───────────────────────────────────────────────────

test('layoutForWidth(38) → chart hidden, stack=true, warn=true', () => {
  const l = layoutForWidth(38)
  assert.equal(l.chart, 'hidden')
  assert.equal(l.stack, true)
  assert.equal(l.warn, true)
})

test('layoutForWidth(1) → chart hidden, stack=true, warn=true', () => {
  const l = layoutForWidth(1)
  assert.equal(l.chart, 'hidden')
  assert.equal(l.stack, true)
  assert.equal(l.warn, true)
})

// ── Return type completeness ──────────────────────────────────────────────────

test('layoutForWidth returns all three fields on every width', () => {
  for (const w of [1, 38, 40, 50, 60, 80, 100, 120, 200]) {
    const l = layoutForWidth(w)
    assert.ok('chart' in l, `chart field missing at width ${w}`)
    assert.ok('stack' in l, `stack field missing at width ${w}`)
    assert.ok('warn' in l, `warn field missing at width ${w}`)
    assert.ok(['full', 'compact', 'hidden'].includes(l.chart), `unexpected chart value at width ${w}`)
    assert.equal(typeof l.stack, 'boolean', `stack must be boolean at width ${w}`)
    assert.equal(typeof l.warn, 'boolean', `warn must be boolean at width ${w}`)
  }
})
