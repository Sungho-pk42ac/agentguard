import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { FindingsView } from '../../src/tui/findings-view.js'
import type { ExplorerItem } from '../../src/tui/view-model.js'

const items: ExplorerItem[] = [
  { severity: 'critical', surface: 'shell-rc', location: '~/.bashrc', evidence: 'OpenAI key: sk-A…AAAA', recommendation: 'rotate', line: 3 },
  { severity: 'medium', surface: 'project-file', location: 'note.txt', evidence: 'low thing', recommendation: 'ignore' },
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
  assert.match(frame, /Detail/)
  assert.match(frame, /evidence:/)
  assert.match(frame, /fix:/)
  unmount()
})

test('FindingsView empty state', () => {
  const { lastFrame, unmount } = render(createElement(FindingsView, { title: 'Posture', items: [], cursor: 0, detailOpen: false }))
  assert.match(lastFrame() ?? '', /No findings\./)
  unmount()
})
