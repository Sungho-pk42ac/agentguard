import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { Dashboard } from '../../src/tui/dashboard.js'
import { buildDashboardData } from '../../src/tui/dashboard-data.js'
import type { ResidualCredential } from '../../src/residual.js'

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Poll the frame until a pattern appears — robust against ink-testing-library
// render/effect timing under concurrent full-suite load (avoids fixed-delay flakes).
async function waitFor(lastFrame: () => string | undefined, re: RegExp, timeout = 2000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (re.test(lastFrame() ?? '')) return true
    await delay(15)
  }
  return false
}

const residuals: ResidualCredential[] = [
  { id: 'a', kind: 'api-key', severity: 'critical', surface: 'shell-rc', location: '~/.bashrc', evidence: 'OpenAI key: sk-A…AAAA', recommendation: 'rotate', line: 3 },
  { id: 'b', kind: 'api-key', severity: 'critical', surface: 'project-file', location: 'repo/.env', evidence: 'key', recommendation: 'rotate' },
  { id: 'c', kind: 'mcp-perm', severity: 'high', surface: 'agent-config', location: 'claude_desktop_config.json', evidence: 'broad filesystem root', recommendation: 'restrict' },
  { id: 'd', kind: 'config', severity: 'medium', surface: 'npm-global', location: 'npm-global:@openai/codex', evidence: 'Global AI CLI installed: @openai/codex@1.0.0', recommendation: 'uninstall' },
  { id: 'e', kind: 'config', severity: 'medium', surface: 'ai-tool-dir', location: 'ai-tool-dir:/home/x/.claude', evidence: 'AI tool config present', recommendation: 'remove' },
]
const loader = () => buildDashboardData(residuals, 1000)

function mountDashboard() {
  let exited = false
  const instance = render(createElement(Dashboard, { loader, onExit: () => (exited = true) }))
  return { ...instance, wasExited: () => exited }
}

test('dashboard paints a loading frame BEFORE the (synchronous) scan runs', () => {
  const { lastFrame, unmount } = render(createElement(Dashboard, { loader, onExit: () => {} }))
  assert.match(lastFrame() ?? '', /Scanning/) // before the setTimeout(0) scan boundary fires
  unmount()
})

test('dashboard renders 5 tabs + verdict badge + footer status after load', async () => {
  const { lastFrame, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview hero should load')
  const frame = lastFrame() ?? ''
  for (const label of ['Overview', 'Agents', 'Credentials', 'Posture', 'Offboard']) {
    assert.match(frame, new RegExp(label), `tab ${label} missing`)
  }
  assert.match(frame, /\[tab\]/)
  assert.match(frame, /findings/)
  assert.match(frame, /BLOCK/)
  unmount()
})

test('dashboard tab key switches the active tab body', async () => {
  const { lastFrame, stdin, unmount } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/), 'overview should load first')
  stdin.write('\t')
  assert.ok(await waitFor(lastFrame, /onboarding check/), 'tab should switch to Agents body')
  unmount()
})

test('dashboard q quits (calls onExit)', async () => {
  const { lastFrame, stdin, unmount, wasExited } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('q')
  const start = Date.now()
  while (Date.now() - start < 1000 && !wasExited()) await delay(15)
  assert.equal(wasExited(), true)
  unmount()
})

test('SINGLE INPUT OWNER: q during offboard does NOT kill the process (parent input inactive)', async () => {
  const { lastFrame, stdin, unmount, wasExited } = mountDashboard()
  assert.ok(await waitFor(lastFrame, /Findings by surface/))
  stdin.write('o')
  assert.ok(await waitFor(lastFrame, /Select scan scope/), 'offboard scope-select should activate')
  await delay(40) // let the freshly-mounted ScopeSelect's useInput subscribe
  stdin.write('q') // during offboard: must not exit the whole process
  assert.ok(await waitFor(lastFrame, /Findings by surface|Press \[o\]/), 'q backs out to the dashboard')
  await delay(50)
  assert.equal(wasExited(), false, 'q during offboard must not call the dashboard exit')
  unmount()
})
