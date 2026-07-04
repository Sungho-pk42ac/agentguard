import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assetStatuses, riskScore, summarize, trend } from '../src/aggregate.js'
import type { AssetRecord, FindingRecord } from '../src/model.js'

function fr(over: Partial<FindingRecord>): FindingRecord {
  return {
    orgId: 'o',
    assetId: 'a1',
    ruleId: 'openai-key',
    surface: 'secret',
    severity: 'critical',
    location: '~/.zshrc',
    evidenceRedacted: 'sk-p…0000',
    fingerprint: 'a'.repeat(32),
    firstSeen: 0,
    lastSeen: 0,
    status: 'open',
    ...over,
  }
}

function asset(assetId: string, lastSeenAt: number | null): AssetRecord {
  return { orgId: 'o', assetId, label: assetId, kind: 'pc', authKind: 'device-token', lastSeenAt, createdAt: 0 }
}

test('summarize counts by surface, severity, and asset', () => {
  const findings = [
    fr({ assetId: 'a1', surface: 'secret', severity: 'critical', fingerprint: '1'.repeat(32) }),
    fr({ assetId: 'a1', surface: 'mcp-risk', severity: 'high', fingerprint: '2'.repeat(32) }),
    fr({ assetId: 'a2', surface: 'secret', severity: 'medium', fingerprint: '3'.repeat(32) }),
  ]
  const s = summarize(findings, [asset('a1', 1), asset('a2', 1)])
  assert.equal(s.totalFindings, 3)
  assert.equal(s.bySurface.secret, 2)
  assert.equal(s.bySurface['mcp-risk'], 1)
  assert.equal(s.bySeverity.critical, 1)
  assert.equal(s.bySeverity.high, 1)
  assert.equal(s.bySeverity.medium, 1)
  assert.equal(s.riskScore, 4 + 3 + 2)
  const a1 = s.byAsset.find((a) => a.assetId === 'a1')
  assert.equal(a1?.count, 2)
  assert.equal(a1?.riskScore, 4 + 3)
})

test('riskScore weights severities low1 med2 high3 crit4', () => {
  assert.equal(riskScore([{ severity: 'low' }, { severity: 'critical' }]), 5)
})

test('trend is time-ordered and monotonic (cumulative)', () => {
  const now = Date.UTC(2026, 6, 10)
  const day = 86_400_000
  const findings = [
    fr({ firstSeen: now - 5 * day, severity: 'high', fingerprint: '1'.repeat(32) }),
    fr({ firstSeen: now - 2 * day, severity: 'critical', fingerprint: '2'.repeat(32) }),
  ]
  const points = trend(findings, { now, windowDays: 7 })
  assert.equal(points.length, 7)
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].date > points[i - 1].date, 'dates strictly increasing')
    assert.ok(points[i].riskScore >= points[i - 1].riskScore, 'cumulative risk is monotonic')
  }
  assert.equal(points[points.length - 1].riskScore, 3 + 4, 'final point includes both findings')
})

test('assetStatuses flags assets past the stale threshold', () => {
  const now = Date.UTC(2026, 6, 10)
  const hour = 3_600_000
  const statuses = assetStatuses([asset('fresh', now - 2 * hour), asset('stale', now - 100 * hour), asset('never', null)], {
    now,
    staleThresholdHours: 48,
  })
  const byId = new Map(statuses.map((s) => [s.assetId, s.stale]))
  assert.equal(byId.get('fresh'), false)
  assert.equal(byId.get('stale'), true)
  assert.equal(byId.get('never'), true)
})
