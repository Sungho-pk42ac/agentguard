import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { Banner } from '../../src/tui/banner.js'

test('Banner renders the big ASCII block-letter wordmark and default Korean tagline', () => {
  const { lastFrame, unmount } = render(createElement(Banner))
  const frame = lastFrame() ?? ''
  assert.match(frame, /█/, 'block-letter art should be present')
  assert.match(frame, /보안 스캐너/, 'default Korean tagline should be present')
  const blockRows = frame.split('\n').filter((l) => l.includes('█')).length
  assert.ok(blockRows >= 5, 'the wordmark should span at least 5 block-letter rows')
  unmount()
})

test('Banner compact renders a single-line AGENTGUARD wordmark without block art', () => {
  const { lastFrame, unmount } = render(createElement(Banner, { compact: true }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /AGENTGUARD/)
  assert.doesNotMatch(frame, /█/, 'compact variant should not use block art')
  unmount()
})

test('Banner accepts a custom tagline', () => {
  const { lastFrame, unmount } = render(createElement(Banner, { tagline: 'CUSTOM-TAG' }))
  assert.match(lastFrame() ?? '', /CUSTOM-TAG/)
  unmount()
})
