import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { Banner } from '../../src/tui/banner.js'

test('Banner renders the ASCII block-letter wordmark and default Korean tagline', () => {
  const { lastFrame, unmount } = render(createElement(Banner))
  const frame = lastFrame() ?? ''
  assert.match(frame, /█/, 'block-letter art should be present')
  assert.match(frame, /보안 스캐너/, 'default Korean tagline should be present')
  // The wordmark is 5+5 rows plus the tagline line.
  assert.ok(frame.split('\n').length >= 10, 'banner should span the stacked wordmark rows')
  unmount()
})

test('Banner accepts a custom tagline', () => {
  const { lastFrame, unmount } = render(createElement(Banner, { tagline: 'CUSTOM-TAG' }))
  assert.match(lastFrame() ?? '', /CUSTOM-TAG/)
  unmount()
})
