import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { BaselineView } from '../../src/tui/baseline-view.js'
import type { BaselineDiff } from '../../src/baseline.js'

test('BaselineView prompts to save when no baseline exists', () => {
  const { lastFrame, unmount } = render(createElement(BaselineView, { has: false, diff: null, message: null }))
  assert.match(lastFrame() ?? '', /No baseline saved yet/)
  assert.match(lastFrame() ?? '', /\[s\] save/)
  unmount()
})

test('BaselineView renders drift counts and appeared/disappeared entries', () => {
  const diff: BaselineDiff = {
    appeared: [{ id: 'a', kind: 'api-key', severity: 'critical', surface: 'shell-rc', location: '~/.bashrc', evidence: 'e', recommendation: 'r' }],
    disappeared: [{ id: 'b', surface: 'project-file', severity: 'high', location: 'old/.env' }],
    rotated: [],
    unchanged: 3,
  }
  const { lastFrame, unmount } = render(createElement(BaselineView, { has: true, diff, message: null }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /\+1 appeared/)
  assert.match(frame, /-1 disappeared/)
  assert.match(frame, /3 unchanged/)
  assert.match(frame, /\.bashrc/)
  assert.match(frame, /old\/\.env/)
  unmount()
})

test('BaselineView shows no-drift when diff is empty', () => {
  const diff: BaselineDiff = { appeared: [], disappeared: [], rotated: [], unchanged: 5 }
  const { lastFrame, unmount } = render(createElement(BaselineView, { has: true, diff, message: 'Saved baseline: 5 entries' }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /Saved baseline: 5 entries/)
  assert.match(frame, /No drift since the last baseline/)
  unmount()
})
