import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { parseSGR } from '../../src/tui/mouse.js'
import { Dashboard } from '../../src/tui/dashboard.js'
import { buildDashboardData } from '../../src/tui/dashboard-data.js'
import type { ResidualCredential } from '../../src/residual.js'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const residuals: ResidualCredential[] = [
  { id: 'a', kind: 'api-key', severity: 'critical', surface: 'shell-rc', location: '~/.bashrc', evidence: 'sk-key', recommendation: 'rotate' },
]
const loader = () => buildDashboardData(residuals, 1000)

// ─── parseSGR unit tests ─────────────────────────────────────────────────────

test('parseSGR: wheel up', () => {
  const ev = parseSGR('\x1b[<64;5;3M')
  assert.ok(ev)
  assert.equal(ev.kind, 'wheelUp')
  assert.equal(ev.x, 5)
  assert.equal(ev.y, 3)
  assert.equal(ev.release, false)
})

test('parseSGR: wheel down', () => {
  const ev = parseSGR('\x1b[<65;10;2M')
  assert.ok(ev)
  assert.equal(ev.kind, 'wheelDown')
  assert.equal(ev.x, 10)
  assert.equal(ev.y, 2)
})

test('parseSGR: left mouse button click press', () => {
  const ev = parseSGR('\x1b[<0;12;1M')
  assert.ok(ev)
  assert.equal(ev.kind, 'click')
  assert.equal(ev.x, 12)
  assert.equal(ev.y, 1)
  assert.equal(ev.release, false)
})

test('parseSGR: left mouse button release', () => {
  const ev = parseSGR('\x1b[<0;12;1m')
  assert.ok(ev)
  assert.equal(ev.kind, 'click')
  assert.equal(ev.release, true)
})

test('parseSGR: returns null for empty string', () => {
  assert.equal(parseSGR(''), null)
})

test('parseSGR: returns null for plain text', () => {
  assert.equal(parseSGR('hello world'), null)
})

test('parseSGR: returns null for malformed escape — non-numeric button', () => {
  // Non-numeric button field
  assert.equal(parseSGR('\x1b[<abc;1;1M'), null)
})

test('parseSGR: returns null for unknown high button number', () => {
  // Button 100 is not wheel or click
  assert.equal(parseSGR('\x1b[<100;1;1M'), null)
})

test('parseSGR: does not throw on arbitrary garbage input', () => {
  assert.doesNotThrow(() => parseSGR('\x1b[<'))
  assert.doesNotThrow(() => parseSGR('\x00\x01\x02'))
  assert.doesNotThrow(() => parseSGR(';;;'))
})

// ─── Dashboard integration (isRawModeSupported=false in test env → no-op) ───

test('dashboard mounts without throw (mouse effect is no-op when raw mode unsupported)', async () => {
  const { lastFrame, unmount } = render(createElement(Dashboard, { loader, onExit: () => {} }))
  await delay(50)
  // Just verify it renders (mouse no-op when isRawModeSupported is false)
  assert.ok((lastFrame() ?? '').length > 0)
  unmount()
})

test('dashboard unmounts without throw after load', async () => {
  const { unmount } = render(createElement(Dashboard, { loader, onExit: () => {} }))
  await delay(50)
  assert.doesNotThrow(() => unmount())
})

test('isRawModeSupported false → no SGR escape written to stdout on mount', async () => {
  const writes: string[] = []
  const origWrite = process.stdout.write.bind(process.stdout)
  // @ts-expect-error — intercept for test
  process.stdout.write = (chunk: string | Buffer, ...rest: unknown[]) => {
    writes.push(typeof chunk === 'string' ? chunk : chunk.toString())
    return origWrite(chunk, ...(rest as []))
  }
  const { unmount } = render(createElement(Dashboard, { loader, onExit: () => {} }))
  await delay(50)
  unmount()
  process.stdout.write = origWrite
  // SGR enable sequence should NOT be present (isRawModeSupported is false in test)
  const sgrEnable = writes.some((w) => w.includes('\x1b[?1000;1006h'))
  assert.equal(sgrEnable, false, 'SGR should not be enabled when isRawModeSupported is false')
})
