import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { MemoryStorage } from '../src/storage/memory.js'
import { SqliteStorage } from '../src/storage/sqlite.js'
import type { StoragePort } from '../src/storage/port.js'
import type { AssetRecord } from '../src/model.js'
import { finding } from './helpers.js'

const impls: Array<[string, () => StoragePort]> = [
  ['memory', () => new MemoryStorage()],
  ['sqlite', () => new SqliteStorage(':memory:')],
]

function asset(orgId: string, assetId: string): AssetRecord {
  return { orgId, assetId, label: assetId, kind: 'pc', authKind: 'device-token', secret: 'sec', lastSeenAt: null, createdAt: 0 }
}

for (const [name, make] of impls) {
  test(`${name}: asset create/get/touch/list is org-scoped`, () => {
    const s = make()
    s.createAsset(asset('orgA', 'a1'))
    s.createAsset(asset('orgB', 'b1'))
    assert.equal(s.getAsset('orgA', 'a1')?.assetId, 'a1')
    assert.equal(s.getAsset('orgB', 'a1'), undefined, 'cross-tenant asset lookup must miss')
    s.touchAsset('orgA', 'a1', 1234)
    assert.equal(s.getAsset('orgA', 'a1')?.lastSeenAt, 1234)
    assert.deepEqual(s.listAssets('orgA').map((a) => a.assetId), ['a1'])
    s.close()
  })

  test(`${name}: upsertFinding reports isNew, dedups, updates lastSeen`, () => {
    const s = make()
    const f = finding()
    assert.equal(s.upsertFinding('orgA', 'a1', f, 100).isNew, true)
    assert.equal(s.upsertFinding('orgA', 'a1', f, 200).isNew, false, 'same fingerprint is not new')
    const rows = s.listFindings('orgA')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].firstSeen, 100)
    assert.equal(rows[0].lastSeen, 200)
    s.close()
  })

  test(`${name}: listFindings filters by surface/severity/asset`, () => {
    const s = make()
    s.upsertFinding('orgA', 'a1', finding({ surface: 'secret', severity: 'critical', fingerprint: 'a'.repeat(32) }), 1)
    s.upsertFinding('orgA', 'a2', finding({ surface: 'mcp-risk', severity: 'high', fingerprint: 'b'.repeat(32) }), 1)
    assert.equal(s.listFindings('orgA', { surface: 'secret' }).length, 1)
    assert.equal(s.listFindings('orgA', { severity: 'high' }).length, 1)
    assert.equal(s.listFindings('orgA', { assetId: 'a2' }).length, 1)
    assert.equal(s.listFindings('orgA').length, 2)
    s.close()
  })

  test(`${name}: findings are strictly org-scoped (no tenant bleed)`, () => {
    const s = make()
    s.upsertFinding('orgA', 'a1', finding({ fingerprint: 'a'.repeat(32) }), 1)
    s.upsertFinding('orgB', 'b1', finding({ fingerprint: 'b'.repeat(32) }), 1)
    assert.equal(s.listFindings('orgA').length, 1)
    assert.equal(s.listFindings('orgB').length, 1)
    assert.equal(s.listFindings('orgA')[0].fingerprint, 'a'.repeat(32))
    s.close()
  })

  test(`${name}: alert dedup keyed on (org, fingerprint)`, () => {
    const s = make()
    assert.equal(s.alertExists('orgA', 'fp1'), false)
    s.recordAlert({ orgId: 'orgA', fingerprint: 'fp1', severity: 'critical', firedAt: 1, channel: 'default' })
    assert.equal(s.alertExists('orgA', 'fp1'), true)
    assert.equal(s.alertExists('orgB', 'fp1'), false, 'alert dedup is per-org')
    s.recordAlert({ orgId: 'orgA', fingerprint: 'fp1', severity: 'critical', firedAt: 2, channel: 'default' })
    assert.equal(s.listAlerts('orgA').length, 1, 'duplicate alert is ignored')
    s.close()
  })

  test(`${name}: enrollment code is single-use and expiry-checked`, () => {
    const s = make()
    const hash = createHash('sha256').update('CODE-123').digest('hex')
    s.putEnrollmentCode('orgA', hash, 1000)
    assert.equal(s.consumeEnrollmentCode('orgA', hash, 500), true, 'valid before expiry')
    assert.equal(s.consumeEnrollmentCode('orgA', hash, 500), false, 'single-use: already consumed')

    const expired = createHash('sha256').update('OLD').digest('hex')
    s.putEnrollmentCode('orgA', expired, 100)
    assert.equal(s.consumeEnrollmentCode('orgA', expired, 500), false, 'expired code rejected')
    s.close()
  })
}
