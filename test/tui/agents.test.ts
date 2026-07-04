import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { render } from 'ink-testing-library'
import { agentInventory } from '../../src/tui/agent-inventory.js'
import { AgentsView } from '../../src/tui/agents-view.js'
import { buildDashboardData } from '../../src/tui/dashboard-data.js'
import type { ResidualCredential } from '../../src/residual.js'

const residuals: ResidualCredential[] = [
  { id: '1', kind: 'config', severity: 'medium', surface: 'npm-global', location: 'npm-global:@openai/codex', evidence: 'Global AI CLI installed: @openai/codex@1.0.0', recommendation: 'uninstall' },
  { id: '2', kind: 'config', severity: 'medium', surface: 'ai-tool-dir', location: 'ai-tool-dir:/home/x/.claude', evidence: 'AI tool configuration present', recommendation: 'remove' },
  { id: '3', kind: 'api-key', severity: 'critical', surface: 'shell-rc', location: '~/.bashrc', evidence: 'key', recommendation: 'rotate' },
]

test('agentInventory is pure composition over DashboardData (no fs/spawn) and derives agent names', () => {
  const data = buildDashboardData(residuals)
  const agents = agentInventory(data)
  // Only npm-global + ai-tool-dir surfaces become agents (shell-rc excluded).
  assert.equal(agents.length, 2)
  const names = agents.map((a) => a.name)
  assert.ok(names.includes('@openai/codex'))
  assert.ok(names.includes('.claude'))
  assert.deepEqual([...agents.map((a) => a.source)].sort(), ['ai-tool-dir', 'npm-global'])
})

test('AgentsView renders the installed AI coding tools (onboarding check)', () => {
  const data = buildDashboardData(residuals)
  const { lastFrame, unmount } = render(createElement(AgentsView, { data }))
  const frame = lastFrame() ?? ''
  assert.match(frame, /onboarding check/)
  assert.match(frame, /@openai\/codex/)
  assert.match(frame, /\.claude/)
  unmount()
})

test('AgentsView empty state when no AI agents present', () => {
  const data = buildDashboardData([residuals[2]]) // shell-rc only
  const { lastFrame, unmount } = render(createElement(AgentsView, { data }))
  assert.match(lastFrame() ?? '', /No installed AI coding agents detected/)
  unmount()
})
