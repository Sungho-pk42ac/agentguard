import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { FleetView, type FleetFetchResponse, type FleetSummary } from '../../src/tui/fleet-view.js'
import type { SessionFile } from '../../src/session.js'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function waitFor(lastFrame: () => string | undefined, re: RegExp, timeout = 2000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (re.test(lastFrame() ?? '')) return true
    await delay(15)
  }
  return false
}

const session: SessionFile = {
  endpoint: 'https://cp.example.com',
  sessionToken: 'tok-123',
  orgId: 'org-1',
  role: 'viewer',
  email: 'ops@example.com',
}

const summary: FleetSummary = {
  totalFindings: 7,
  riskScore: 15,
  bySeverity: { critical: 2, high: 1, medium: 3, low: 1 },
  byAsset: [
    { assetId: 'a1', label: 'laptop-1', count: 4, riskScore: 9 },
    { assetId: 'a2', label: 'ci-runner', count: 3, riskScore: 6 },
  ],
}

test('FleetView: no session shows the login hint + local-mode note', () => {
  const { lastFrame, unmount } = render(
    createElement(FleetView, { readSessionFn: () => undefined }),
  )
  const frame = lastFrame() ?? ''
  assert.match(frame, /로그인 필요/)
  assert.match(frame, /agentguard login --endpoint/)
  assert.match(frame, /로컬 전용 모드로 계속 사용 가능/)
  unmount()
})

test('FleetView: session + fake fetch renders the org summary (bySeverity + byAsset)', async () => {
  const fetchImpl = async (url: string, init: { headers: Record<string, string> }): Promise<FleetFetchResponse> => {
    assert.equal(url, 'https://cp.example.com/v1/dashboard/summary')
    assert.equal(init.headers['authorization'], 'Bearer tok-123')
    return { status: 200, json: async () => summary }
  }
  const { lastFrame, unmount } = render(
    createElement(FleetView, { readSessionFn: () => session, fetchImpl }),
  )
  assert.ok(await waitFor(lastFrame, /Fleet —/), 'fleet summary header should render')
  const frame = lastFrame() ?? ''
  assert.match(frame, /7 findings/)
  assert.match(frame, /risk 15/)
  assert.match(frame, /critical/)
  assert.match(frame, /laptop-1/)
  assert.match(frame, /ci-runner/)
  unmount()
})

test('FleetView: fetch failure renders a non-fatal red connection-error line', async () => {
  const fetchImpl = async (): Promise<FleetFetchResponse> => {
    throw new Error('ECONNREFUSED')
  }
  const { lastFrame, unmount } = render(
    createElement(FleetView, { readSessionFn: () => session, fetchImpl }),
  )
  assert.ok(await waitFor(lastFrame, /컨트롤 플레인 연결 실패/), 'connection-failure line should render')
  assert.match(lastFrame() ?? '', /ECONNREFUSED/)
  unmount()
})

test('FleetView: non-200 HTTP status renders a connection-error line', async () => {
  const fetchImpl = async (): Promise<FleetFetchResponse> => ({ status: 401, json: async () => ({}) })
  const { lastFrame, unmount } = render(
    createElement(FleetView, { readSessionFn: () => session, fetchImpl }),
  )
  assert.ok(await waitFor(lastFrame, /컨트롤 플레인 연결 실패/), 'HTTP error should surface as a connection failure')
  assert.match(lastFrame() ?? '', /HTTP 401/)
  unmount()
})

test('FleetView: empty byAsset renders the "no assets" placeholder, not a crash', async () => {
  const emptySummary: FleetSummary = { totalFindings: 0, riskScore: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, byAsset: [] }
  const fetchImpl = async (): Promise<FleetFetchResponse> => ({ status: 200, json: async () => emptySummary })
  const { lastFrame, unmount } = render(
    createElement(FleetView, { readSessionFn: () => session, fetchImpl }),
  )
  assert.ok(await waitFor(lastFrame, /Fleet —/))
  assert.match(lastFrame() ?? '', /등록된 자산이 없습니다/)
  unmount()
})

test('FleetView: unmount before the setTimeout(0) fetch fires does not throw (alive-guard)', async () => {
  let resolveFetch: (() => void) | undefined
  const fetchImpl = () =>
    new Promise<FleetFetchResponse>((resolve) => {
      resolveFetch = () => resolve({ status: 200, json: async () => summary })
    })
  const { unmount } = render(createElement(FleetView, { readSessionFn: () => session, fetchImpl }))
  await delay(10)
  assert.doesNotThrow(() => unmount())
  // Resolve after unmount — the alive-guard must swallow the late setState.
  resolveFetch?.()
  await delay(10)
})
