import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clampIndex,
  filterItems,
  findingToItem,
  nextSeverityFilter,
  residualToItem,
  severityColor,
  sortItemsBySeverity,
  toggleInList,
  type ExplorerItem,
} from '../../src/tui/view-model.js'

const items: ExplorerItem[] = [
  { severity: 'low', surface: 'shell-rc', location: 'a.sh', evidence: 'low thing' },
  { severity: 'critical', surface: 'project-file', location: 'b.env', evidence: 'sk-key' },
  { severity: 'medium', surface: 'npm-global', location: 'codex', evidence: 'installed' },
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

test('findingToItem and residualToItem carry severity, location, evidence', () => {
  const fi = findingToItem({ id: 'x', title: 't', severity: 'high', category: 'secret', file: 'f.ts', line: 4, evidence: 'e', recommendation: 'r' })
  assert.equal(fi.severity, 'high')
  assert.equal(fi.location, 'f.ts')
  assert.equal(fi.line, 4)
  const ri = residualToItem({ id: 'y', kind: 'api-key', severity: 'critical', surface: 'shell-rc', location: '.bashrc', evidence: 'e', recommendation: 'r' })
  assert.equal(ri.surface, 'shell-rc')
})
