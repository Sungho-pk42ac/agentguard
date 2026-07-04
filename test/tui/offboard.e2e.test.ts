import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { auditReportSchema } from '../../src/audit-report.js'
import { applyOffboard, runOffboardSweep, scanForOffboard } from '../../src/tui/offboard-flow.js'

const OPENAI_KEY = `sk-${'A'.repeat(44)}`

function buildFixture() {
  const home = mkdtempSync(join(tmpdir(), 'agentguard-offboard-home-'))
  const project = mkdtempSync(join(tmpdir(), 'agentguard-offboard-proj-'))

  // 1. shell-rc key
  writeFileSync(join(home, '.bashrc'), `export PATH=$PATH:/usr/bin\nexport OPENAI_API_KEY=${OPENAI_KEY}\nalias ll='ls -la'\n`)
  // 2. AI tool dir + credential file
  mkdirSync(join(home, '.claude'))
  writeFileSync(join(home, '.claude', 'settings.json'), '{"theme":"dark"}')
  writeFileSync(join(home, '.claude.json'), `{"apiKey":"${OPENAI_KEY}"}`)
  // 3. agent MCP config with a broad root and inline credential
  writeFileSync(
    join(home, 'claude_desktop_config.json'),
    JSON.stringify({
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
          env: { OPENAI_API_KEY: OPENAI_KEY },
        },
      },
    }),
  )
  // 5. project .env
  writeFileSync(join(project, '.env'), `OPENAI_API_KEY=${OPENAI_KEY}\n`)

  return { home, project }
}

// 4. npm global AI CLI (injected)
const npmRun = () => ({ stdout: JSON.stringify({ dependencies: { '@openai/codex': { version: '1.0.0' } } }), status: 0 })

const scanOpts = (home: string, project: string) => ({
  homeDir: home,
  platform: 'linux' as const,
  projectPath: project,
  npmRun,
})

test('offboard scan surfaces all five detection types', () => {
  const { home, project } = buildFixture()
  const { findings } = scanForOffboard(scanOpts(home, project))
  const surfaces = new Set(findings.map((f) => f.surface))
  for (const surface of ['shell-rc', 'ai-tool-dir', 'agent-config', 'npm-global', 'project-file']) {
    assert.ok(surfaces.has(surface), `expected a ${surface} residual, got: ${[...surfaces].join(', ')}`)
  }
})

test('SAFETY INVARIANT: declining approval leaves every scanned target untouched', () => {
  const { home, project } = buildFixture()
  const bashrcBefore = readFileSync(join(home, '.bashrc'), 'utf8')
  const { findings, plan } = scanForOffboard(scanOpts(home, project))

  const { records, report } = applyOffboard(findings, plan, {
    approved: false,
    homeDir: home,
    platform: 'linux',
    reportDir: join(home, 'reports'),
  })

  assert.ok(records.every((r) => r.status === 'skipped'), 'no action may be applied without approval')
  assert.equal(readFileSync(join(home, '.bashrc'), 'utf8'), bashrcBefore)
  assert.equal(existsSync(join(home, '.claude')), true)
  assert.equal(existsSync(join(home, '.claude.json')), true)
  assert.equal(existsSync(join(project, '.env')), true)
  assert.equal(report.summary.appliedActions, 0)
})

test('GOLDEN PATH: scope -> scan -> approve -> delete -> zod-valid audit report', () => {
  const { home, project } = buildFixture()
  const result = runOffboardSweep({
    ...scanOpts(home, project),
    approved: true,
    reason: 'offboarding',
    operator: 'secops',
    reportDir: join(home, 'reports'),
    now: new Date('2026-07-04T00:00:00Z'),
  })

  // Report is a valid public-contract document.
  assert.doesNotThrow(() => auditReportSchema.parse(result.report))
  assert.ok(result.reportPaths, 'a report file must be written')
  assert.doesNotThrow(() => auditReportSchema.parse(JSON.parse(readFileSync(result.reportPaths!.jsonPath, 'utf8'))))

  // Credential-bearing targets were removed (recoverably) after approval.
  assert.equal(existsSync(join(project, '.env')), false, '.env should be moved to trash')
  assert.doesNotMatch(readFileSync(join(home, '.bashrc'), 'utf8'), new RegExp(OPENAI_KEY), 'exported key line removed')
  assert.ok(result.report.summary.appliedActions > 0, 'at least one cleanup action applied')

  // Backups exist and are recoverable (nothing hard-deleted).
  const applied = result.records.filter((r) => r.status === 'applied')
  assert.ok(applied.length > 0)
  for (const record of applied) {
    assert.ok(record.backupPath, 'applied actions record a recoverable backup path')
    assert.equal(existsSync(record.backupPath!), true)
  }
})

test('offboard respects scope selection (shell-rc only)', () => {
  const { home, project } = buildFixture()
  const { findings } = scanForOffboard({ ...scanOpts(home, project), scope: ['shell-rc'] })
  assert.ok(findings.length > 0)
  assert.ok(findings.every((f) => f.surface === 'shell-rc'))
})
