import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  AUDIT_REPORT_SCHEMA_VERSION,
  auditReportSchema,
  auditReportToJson,
  auditReportToMarkdown,
  buildAuditReport,
  parseAuditReport,
  writeAuditReport,
  type AuditReportInput,
} from '../src/audit-report.js'
import type { ResidualCredential } from '../src/residual.js'

const findings: ResidualCredential[] = [
  {
    id: 'shell-rc:/home/x/.bashrc:L3:openai-key',
    kind: 'api-key',
    severity: 'critical',
    surface: 'shell-rc',
    location: '/home/x/.bashrc',
    path: '/home/x/.bashrc',
    line: 3,
    evidence: 'OpenAI-style API key: sk-A…AAAA',
    recommendation: 'Rotate and remove.',
  },
  {
    id: 'npm-global:@openai/codex',
    kind: 'config',
    severity: 'medium',
    surface: 'npm-global',
    location: 'npm-global:@openai/codex',
    evidence: 'Global AI CLI installed: @openai/codex@1.2.3',
    recommendation: 'Uninstall if offboarding.',
  },
]

const input: AuditReportInput = {
  reason: 'offboarding',
  findings,
  actions: [
    {
      residualId: 'shell-rc:/home/x/.bashrc:L3:openai-key',
      action: 'remove-line',
      target: '/home/x/.bashrc',
      status: 'applied',
      backupPath: '/home/x/.agentguard/trash/2026/.bashrc',
      appliedAt: '2026-07-04T00:00:00.000Z',
    },
  ],
  scope: ['shell-rc', 'npm-global'],
  target: { os: 'linux', hostname: 'target-pc', homeDir: '/home/x' },
  operator: 'secops',
  generatedAt: '2026-07-04T00:00:00.000Z',
}

test('buildAuditReport produces a schema-valid report with computed summary', () => {
  const report = buildAuditReport(input)
  assert.equal(report.schemaVersion, AUDIT_REPORT_SCHEMA_VERSION)
  assert.equal(report.tool, 'agentguard')
  assert.equal(report.summary.findingCount, 2)
  assert.equal(report.summary.bySeverity.critical, 1)
  assert.equal(report.summary.bySeverity.medium, 1)
  assert.equal(report.summary.appliedActions, 1)
  assert.doesNotThrow(() => auditReportSchema.parse(report))
})

test('audit report round-trips through JSON (public contract)', () => {
  const report = buildAuditReport(input)
  const restored = parseAuditReport(auditReportToJson(report))
  assert.deepEqual(restored, report)
})

test('parseAuditReport rejects an unknown schema version', () => {
  const report = buildAuditReport(input)
  const tampered = JSON.stringify({ ...report, schemaVersion: 999 })
  assert.throws(() => parseAuditReport(tampered))
})

test('parseAuditReport rejects a report missing required fields', () => {
  assert.throws(() => parseAuditReport('{"schemaVersion":1,"tool":"agentguard"}'))
})

test('auditReportToMarkdown is Korean-first and includes findings and actions', () => {
  const md = auditReportToMarkdown(buildAuditReport(input))
  assert.match(md, /# AgentGuard 감사 리포트/)
  assert.match(md, /오프보딩 스윕/)
  assert.match(md, /shell-rc/)
  assert.match(md, /npm-global/)
  assert.match(md, /remove line/)
  assert.match(md, /critical=1/)
})

test('writeAuditReport writes JSON + MD and the JSON validates against the schema', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentguard-audit-'))
  const report = buildAuditReport(input)
  const { jsonPath, markdownPath } = writeAuditReport(dir, report)
  assert.doesNotThrow(() => auditReportSchema.parse(JSON.parse(readFileSync(jsonPath, 'utf8'))))
  assert.match(readFileSync(markdownPath, 'utf8'), /# AgentGuard 감사 리포트/)
})
