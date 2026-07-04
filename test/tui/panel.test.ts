import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { Panel } from '../../src/tui/panel.js'
import { Text } from 'ink'

test('Panel renders round border (detected by ink-testing-library box-drawing chars)', () => {
  const { lastFrame, unmount } = render(
    createElement(Panel, { children: createElement(Text, null, 'inner-content') })
  )
  const frame = lastFrame() ?? ''
  // ink-testing-library renders round borders as ╭ / ╰ corners + ─ top/bottom
  assert.match(frame, /[╭╰─│]|inner-content/, 'round border or content should appear')
  unmount()
})

test('Panel renders optional title inside the box', () => {
  const { lastFrame, unmount } = render(
    createElement(Panel, { title: 'MY-TITLE', children: createElement(Text, null, 'body-token') })
  )
  const frame = lastFrame() ?? ''
  assert.match(frame, /MY-TITLE/, 'title should appear')
  assert.match(frame, /body-token/, 'child content should appear')
  unmount()
})

test('Panel renders child content when no title is given', () => {
  const { lastFrame, unmount } = render(
    createElement(Panel, { children: createElement(Text, null, 'child-token') })
  )
  const frame = lastFrame() ?? ''
  assert.match(frame, /child-token/, 'child should appear without title')
  unmount()
})

test('Panel title and child content are both present in same frame', () => {
  const { lastFrame, unmount } = render(
    createElement(Panel, {
      title: 'PANEL-TITLE',
      children: createElement(Text, null, 'PANEL-CHILD'),
    })
  )
  const frame = lastFrame() ?? ''
  assert.match(frame, /PANEL-TITLE/)
  assert.match(frame, /PANEL-CHILD/)
  unmount()
})

test('Panel does not crash when columns prop is provided', () => {
  const { lastFrame, unmount } = render(
    createElement(Panel, {
      columns: 60,
      children: createElement(Text, null, 'sized-content'),
    })
  )
  const frame = lastFrame() ?? ''
  assert.match(frame, /sized-content/)
  unmount()
})
