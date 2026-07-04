import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { ScopeSelect } from '../../src/tui/scope-select.js'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function mount(element: React.ReactElement) {
  const instance = render(element)
  await delay(20)
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
  await delay(20)
  assert.ok(Array.isArray(confirmed))
  assert.ok(confirmed!.length > 0)
  unmount()
})

test('ScopeSelect space toggles the cursor item off', async () => {
  let confirmed: string[] | undefined
  const { stdin, unmount } = await mount(createElement(ScopeSelect, { onConfirm: (scopes: string[]) => (confirmed = scopes) }))
  stdin.write(' ') // toggle first item off
  await delay(20)
  stdin.write('\r')
  await delay(20)
  assert.ok(Array.isArray(confirmed))
  assert.equal(confirmed!.includes('ai-tool-dir'), false)
  unmount()
})
