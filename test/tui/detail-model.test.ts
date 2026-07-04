import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoryRemediationKO, lookupCategoryRemediation, severityRationaleKO } from '../../src/tui/detail-model.js'

// ─── severityRationaleKO ────────────────────────────────────────────────────

test('severityRationaleKO has all four severity levels', () => {
  for (const level of ['critical', 'high', 'medium', 'low'] as const) {
    assert.ok(severityRationaleKO[level], `missing rationale for ${level}`)
    assert.ok(typeof severityRationaleKO[level] === 'string')
    assert.ok(severityRationaleKO[level].length > 0)
  }
})

test('severityRationaleKO critical mentions immediate threat', () => {
  assert.ok(severityRationaleKO.critical.includes('즉각'))
})

test('severityRationaleKO low mentions improvement', () => {
  assert.ok(severityRationaleKO.low.length > 0)
})

// ─── categoryRemediationKO ──────────────────────────────────────────────────

test('categoryRemediationKO covers all documented surfaces', () => {
  const documented = ['secret', 'ai-tool-dir', 'sensitive-file', 'project-file', 'mcp-risk', 'agent-config', 'npm-global', 'pii']
  for (const surface of documented) {
    assert.ok(categoryRemediationKO[surface], `missing remediation for ${surface}`)
  }
})

test('categoryRemediationKO secret → key rotation text', () => {
  assert.match(categoryRemediationKO['secret'], /키 회전/)
})

test('categoryRemediationKO sensitive-file → delete/gitignore text', () => {
  assert.match(categoryRemediationKO['sensitive-file'], /gitignore/)
})

test('categoryRemediationKO mcp-risk → permission reduction text', () => {
  assert.match(categoryRemediationKO['mcp-risk'], /권한/)
})

test('categoryRemediationKO npm-global → logout/remove text', () => {
  assert.match(categoryRemediationKO['npm-global'], /로그아웃/)
})

test('categoryRemediationKO pii → pseudonymisation text', () => {
  assert.match(categoryRemediationKO['pii'], /가명/)
})

// ─── lookupCategoryRemediation ──────────────────────────────────────────────

test('lookupCategoryRemediation returns KO text for known surface', () => {
  const result = lookupCategoryRemediation('secret')
  assert.ok(result.length > 0)
  assert.equal(result, categoryRemediationKO['secret'])
})

test('lookupCategoryRemediation returns empty string for unknown surface', () => {
  assert.equal(lookupCategoryRemediation('unknown-xyz'), '')
})

test('lookupCategoryRemediation ai-tool-dir → key rotation (same as secret)', () => {
  assert.match(lookupCategoryRemediation('ai-tool-dir'), /키 회전/)
})

test('lookupCategoryRemediation agent-config → same as mcp-risk', () => {
  assert.equal(lookupCategoryRemediation('agent-config'), lookupCategoryRemediation('mcp-risk'))
})
