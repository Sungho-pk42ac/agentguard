import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { ScopeSelect } from '../../src/tui/scope-select.js'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(predicate: () => boolean, timeout = 2000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (predicate()) return true
    await delay(15)
  }
  return predicate()
}

async function mount(element: React.ReactElement) {
  const instance = render(element)
  await delay(100)
  return instance
}

test('ScopeSelect starts fully selected and confirms with Enter', async () => {
  let confirmed: string[] | undefined
  const { lastFrame, stdin, unmount } = await mount(
    createElement(ScopeSelect, { onConfirm: (scopes: string[]) => (confirmed = scopes) }),
  )
  const frame = lastFrame() ?? ''
  assert.match(frame, /Select scan scope/)
  assert.match(frame, /\[x\]/)
  stdin.write('\r')
  assert.ok(await waitFor(() => Array.isArray(confirmed)), 'confirmation callback should receive selected scopes')
  const selected = confirmed
  assert.ok(Array.isArray(selected))
  assert.ok(selected.length > 0)
  unmount()
})

test('ScopeSelect space toggles the cursor item off', async () => {
  let confirmed: string[] | undefined
  const { lastFrame, stdin, unmount } = await mount(createElement(ScopeSelect, { onConfirm: (scopes: string[]) => (confirmed = scopes) }))
  stdin.write(' ') // toggle first item off
  assert.ok(
    await waitFor(() => /› \[ \]/.test(lastFrame() ?? '') && /4 scope\(s\) selected/.test(lastFrame() ?? '')),
    'space should toggle the cursor item off',
  )
  await delay(50)
  stdin.write('\r')
  assert.ok(await waitFor(() => Array.isArray(confirmed)), 'confirmation callback should receive selected scopes')
  const selected = confirmed
  assert.ok(Array.isArray(selected))
  assert.equal(selected.includes('ai-tool-dir'), false)
  unmount()
})
