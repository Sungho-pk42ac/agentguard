import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clampIndex,
  filterItems,
  findingToItem,
  nextSeverityFilter,
  postureToItem,
  residualToItem,
  severityColor,
  sortItemsBySeverity,
  toggleInList,
  type ExplorerItem,
} from '../../src/tui/view-model.js'
import type { PostureFinding } from '../../src/posture.js'

// All items must include `id` (required since S3).
const items: ExplorerItem[] = [
  { id: 'id-a', severity: 'low', surface: 'shell-rc', location: 'a.sh', evidence: 'low thing', recommendation: 'fix' },
  { id: 'id-b', severity: 'critical', surface: 'project-file', location: 'b.env', evidence: 'sk-key', recommendation: 'rotate' },
  { id: 'id-c', severity: 'medium', surface: 'npm-global', location: 'codex', evidence: 'installed', recommendation: 'remove' },
]

test('sortItemsBySeverity orders critical first', () => {
  assert.deepEqual(sortItemsBySeverity(items).map((i) => i.severity), ['critical', 'medium', 'low'])
})

test('filterItems narrows by severity and by query substring', () => {
  assert.equal(filterItems(items, { severity: 'critical' }).length, 1)
  assert.equal(filterItems(items, { query: 'codex' }).length, 1)
  assert.equal(filterItems(items, { query: 'env' })[0].location, 'b.env')
  assert.equal(filterItems(items, {}).length, 3)
})

test('filterItems query matches surface', () => {
  assert.equal(filterItems(items, { query: 'shell-rc' }).length, 1)
})

test('filterItems query matches evidence', () => {
  assert.equal(filterItems(items, { query: 'sk-key' }).length, 1)
})

test('filterItems query is case-insensitive', () => {
  assert.equal(filterItems(items, { query: 'SK-KEY' }).length, 1)
})

test('nextSeverityFilter cycles none -> critical -> ... -> low -> none', () => {
  assert.equal(nextSeverityFilter(undefined), 'critical')
  assert.equal(nextSeverityFilter('critical'), 'high')
  assert.equal(nextSeverityFilter('high'), 'medium')
  assert.equal(nextSeverityFilter('medium'), 'low')
  assert.equal(nextSeverityFilter('low'), undefined)
})

test('clampIndex keeps selection in range', () => {
  assert.equal(clampIndex(-1, 3), 0)
  assert.equal(clampIndex(5, 3), 2)
  assert.equal(clampIndex(1, 3), 1)
  assert.equal(clampIndex(0, 0), 0)
})

test('toggleInList adds then removes a value', () => {
  assert.deepEqual(toggleInList(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(toggleInList(['a', 'b'], 'b'), ['a'])
})

test('severityColor maps each severity to a color', () => {
  assert.equal(severityColor('critical'), 'red')
  assert.equal(severityColor('medium'), 'yellow')
})

test('findingToItem carries severity, location, evidence, and id (S3)', () => {
  const fi = findingToItem({ id: 'x', title: 't', severity: 'high', category: 'secret', file: 'f.ts', line: 4, evidence: 'e', recommendation: 'r' })
  assert.equal(fi.id, 'x')
  assert.equal(fi.severity, 'high')
  assert.equal(fi.location, 'f.ts')
  assert.equal(fi.line, 4)
  assert.equal(fi.surface, 'secret')
})

test('findingToItem uses finding.id when no file (location = finding.id)', () => {
  const fi = findingToItem({ id: 'no-file', title: 't', severity: 'low', category: 'pii', evidence: 'e', recommendation: 'r' })
  assert.equal(fi.id, 'no-file')
  assert.equal(fi.location, 'no-file')
})

test('residualToItem carries residual.id (S3)', () => {
  const ri = residualToItem({ id: 'res-1', kind: 'api-key', severity: 'critical', surface: 'shell-rc', location: '.bashrc', evidence: 'e', recommendation: 'r' })
  assert.equal(ri.id, 'res-1')
  assert.equal(ri.surface, 'shell-rc')
})

test('postureToItem constructs stable composite id (S3)', () => {
  const pf: PostureFinding = {
    id: 'agent-broad-filesystem-root',
    severity: 'critical',
    surface: 'claude mcp config',
    file: 'mcp.json',
    evidence: 'broad root',
    recommendation: 'restrict',
  }
  const item = postureToItem(pf)
  assert.equal(item.id, 'claude mcp config:mcp.json:agent-broad-filesystem-root')
  assert.equal(item.surface, 'claude mcp config')
  assert.equal(item.location, 'mcp.json')
})

test('postureToItem uses surface as location fallback when file absent (S3)', () => {
  const pf: PostureFinding = {
    id: 'policy-missing',
    severity: 'medium',
    surface: 'policy guardrail',
    evidence: 'no policy',
    recommendation: 'add policy',
  }
  const item = postureToItem(pf)
  assert.equal(item.id, 'policy guardrail:policy guardrail:policy-missing')
  assert.equal(item.location, 'policy guardrail')
})
