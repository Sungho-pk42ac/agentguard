import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { FindingsView } from '../../src/tui/findings-view.js'
import type { ExplorerItem } from '../../src/tui/view-model.js'

// All items include `id` (required by ExplorerItem since S3).
const items: ExplorerItem[] = [
  { id: 'rc-1', severity: 'critical', surface: 'shell-rc', location: '~/.bashrc', evidence: 'OpenAI key: sk-A…AAAA', recommendation: 'rotate', line: 3 },
  { id: 'pf-1', severity: 'medium', surface: 'project-file', location: 'note.txt', evidence: 'low thing', recommendation: 'ignore' },
]

test('FindingsView renders a severity-colored list with header count', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Credentials', items, cursor: 0, detailOpen: false }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /Credentials — 2\/2/)
  assert.match(frame, /\.bashrc/)
  assert.match(frame, /critical/)
  unmount()
})

test('FindingsView severity filter narrows the list', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Credentials', items, cursor: 0, filter: 'critical', detailOpen: false }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /Credentials — 1\/2/)
  assert.match(frame, /severity: critical/)
  unmount()
})

test('FindingsView detail panel shows evidence + recommendation when open', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Credentials', items, cursor: 0, detailOpen: true }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /세부정보/)
  assert.match(frame, /evidence:/)
  assert.match(frame, /fix:/)
  unmount()
})

test('FindingsView detail panel shows severity rationale (S5)', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Credentials', items, cursor: 0, detailOpen: true }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /심각도/)
  assert.match(frame, /즉각/)
  unmount()
})

test('FindingsView empty state (no items) shows 깨끗함 ✓ (S2)', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Posture', items: [], cursor: 0, detailOpen: false }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /깨끗함/)
  unmount()
})

test('FindingsView hidden items are filtered from display (S6)', () => {
  const hidden = new Set(['rc-1'])
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Credentials', items, cursor: 0, detailOpen: false, hidden }))
  const frame = lastFrame() ?? ''
  // rc-1 (.bashrc) should be hidden; pf-1 (note.txt) should be visible
  assert.doesNotMatch(frame, /\.bashrc/)
  assert.match(frame, /note\.txt/)
  // Count shows 1 visible / 2 total
  assert.match(frame, /1\/2/)
  unmount()
})

test('FindingsView query filters by search (S7)', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Credentials', items, cursor: 0, detailOpen: false, query: 'bashrc' }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /\.bashrc/)
  assert.match(frame, /1\/2/)
  unmount()
})

test('FindingsView sort indicator when sortActive (S8)', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Credentials', items, cursor: 0, detailOpen: false, sortActive: true }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /severity/)
  unmount()
})
