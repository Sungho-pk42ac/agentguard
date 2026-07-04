import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildDashboardData, loadDashboardData, surfaceBars, verdictForResiduals } from '../../src/tui/dashboard-data.js'
import type { ResidualCredential } from '../../src/residual.js'

function residual(surface: string, severity: ResidualCredential['severity'], id: string): ResidualCredential {
  return { id, kind: 'api-key', severity, surface, location: `${surface}:${id}`, evidence: 'redacted', recommendation: 'fix' }
}

const fixture: ResidualCredential[] = [
  residual('shell-rc', 'critical', 'a'),
  residual('project-file', 'critical', 'b'),
  residual('agent-config', 'high', 'c'),
  residual('npm-global', 'medium', 'd'),
  residual('ai-tool-dir', 'medium', 'e'),
]

test('surfaceBars keys on the actual residual.surface label (project-file singular)', () => {
  const bars = surfaceBars(fixture)
  const surfaces = bars.map((b) => b.surface)
  assert.ok(surfaces.includes('project-file'), 'uses singular project-file, not SCOPE_ITEMS project-files')
  assert.ok(!surfaces.includes('project-files'))
  assert.equal(bars.find((b) => b.surface === 'shell-rc')?.severity, 'critical')
})

test('verdictForResiduals adapts residuals through the {severity} projection', () => {
  assert.equal(verdictForResiduals([]), 'PASS')
  // 2 critical (severityScore 4 each) => score 8 => BLOCK
  assert.equal(verdictForResiduals([residual('shell-rc', 'critical', 'x'), residual('project-file', 'critical', 'y')]), 'BLOCK')
  assert.equal(verdictForResiduals([residual('npm-global', 'medium', 'z')]), 'REVIEW')
})

test('buildDashboardData splits residuals into tab families and computes aggregate/verdict', () => {
  const data = buildDashboardData(fixture, 1_000)
  assert.equal(data.aggregate.findings, 5)
  assert.equal(data.aggregate.critical, 2)
  assert.equal(data.verdict, 'BLOCK')
  assert.equal(data.scannedAt, 1_000)
  // Credentials family = shell-rc + ai-tool-dir + project-file
  assert.equal(data.credentialItems.length, 3)
  assert.equal(data.postureItems.length, 1) // agent-config
  assert.deepEqual([...data.agentItems.map((i) => i.surface)].sort(), ['ai-tool-dir', 'npm-global'])
  assert.equal(data.allItems.length, 5)
})

test('buildDashboardData empty scan is a PASS with no findings', () => {
  const data = buildDashboardData([], 1)
  assert.equal(data.verdict, 'PASS')
  assert.equal(data.aggregate.findings, 0)
  assert.deepEqual(data.surfaces, [])
})

test('loadDashboardData runs the real scan via existing exports (injected npm + fixture home/project)', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-dash-home-'))
  const project = mkdtempSync(join(tmpdir(), 'agentguard-dash-proj-'))
  mkdirSync(join(home, '.claude'))
  writeFileSync(join(project, '.env'), `OPENAI_API_KEY=sk-${'A'.repeat(44)}\n`)
  const data = loadDashboardData({
    homeDir: home,
    platform: 'linux',
    projectPath: project,
    npmRun: () => ({ stdout: JSON.stringify({ dependencies: { '@openai/codex': { version: '1.0.0' } } }), status: 0 }),
    now: 42,
  })
  const surfaces = new Set(data.surfaces.map((b) => b.surface))
  assert.ok(surfaces.has('ai-tool-dir'))
  assert.ok(surfaces.has('npm-global'))
  assert.ok(surfaces.has('project-file'))
  assert.ok(data.aggregate.findings > 0)
  assert.equal(data.scannedAt, 42)
})
