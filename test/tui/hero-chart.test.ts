import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { HeroChart, VerdictBadge } from '../../src/tui/hero-chart.js'
import type { SurfaceBar } from '../../src/tui/dashboard-data.js'

const surfaces: SurfaceBar[] = [
  { surface: 'shell-rc', count: 3, severity: 'critical' },
  { surface: 'project-file', count: 1, severity: 'critical' },
  { surface: 'npm-global', count: 1, severity: 'medium' },
]

test('HeroChart renders a bar per surface (keyed on residual.surface labels) with counts', () => {
  const { lastFrame, unmount } = render(createElement(HeroChart, { surfaces, columns: 100 }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /Findings by surface/)
  assert.match(frame, /shell-rc/)
  assert.match(frame, /project-file/) // singular, not project-files
  assert.doesNotMatch(frame, /project-files/)
  assert.match(frame, /█/) // bar glyph
  unmount()
})

test('HeroChart empty state is a green PASS placeholder (no divide-by-zero)', () => {
  const { lastFrame, unmount } = render(createElement(HeroChart, { surfaces: [], columns: 100 }))
  assert.match(lastFrame() ?? '', /PASS — no residual credentials found/)
  unmount()
})

test('VerdictBadge shows verdict and critical count', () => {
  const { lastFrame, unmount } = render(createElement(VerdictBadge, { verdict: 'BLOCK', critical: 2 }))
  assert.match(lastFrame() ?? '', /BLOCK · 2 critical/)
  unmount()
})
