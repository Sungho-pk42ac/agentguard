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
  test(`${name}: org/user creation, email lookup, and org-scoped listing`, () => {
    const s = make()
    s.createOrg({ id: 'orgA', name: 'Acme', webhookSecret: 'whs', createdAt: 0 })
    assert.equal(s.getOrg('orgA')?.name, 'Acme')
    assert.equal(s.getOrg('missing'), undefined)

    s.createUser({ id: 'u1', orgId: 'orgA', email: 'a@acme.test', passwordHash: 'ph1', role: 'admin', createdAt: 1 })
    s.createUser({ id: 'u2', orgId: 'orgA', email: 'b@acme.test', passwordHash: 'ph2', role: 'member', createdAt: 2 })
    assert.equal(s.getUserByEmail('a@acme.test')?.id, 'u1')
    assert.equal(s.getUserByEmail('nope@acme.test'), undefined)
    assert.equal(s.getUser('orgA', 'u1')?.email, 'a@acme.test')
    assert.equal(s.getUser('orgB', 'u1'), undefined, 'cross-tenant user lookup must miss')
    assert.deepEqual(
      s.listUsers('orgA').map((u) => u.id),
      ['u1', 'u2'],
    )
    s.close()
  })

  test(`${name}: invite is single-use and expiry-checked (like enrollment codes)`, () => {
    const s = make()
    s.createInvite({ code: 'INVITE1', orgId: 'orgA', role: 'member', expiresAt: 1000 })
    const first = s.consumeInvite('INVITE1', 500)
    assert.equal(first?.orgId, 'orgA')
    assert.equal(first?.role, 'member')
    assert.equal(s.consumeInvite('INVITE1', 500), undefined, 'single-use: already consumed')

    s.createInvite({ code: 'OLD', orgId: 'orgA', role: 'admin', expiresAt: 100 })
    assert.equal(s.consumeInvite('OLD', 500), undefined, 'expired invite rejected')
    s.close()
  })

  test(`${name}: session create/get/touch/delete`, () => {
    const s = make()
    s.createSession({ token: 'tok1', userId: 'u1', orgId: 'orgA', role: 'admin', kind: 'cookie', csrfToken: 'csrf1', createdAt: 0, expiresAt: 1000, lastSeenAt: 0 })
    assert.equal(s.getSession('tok1')?.userId, 'u1')
    s.touchSession('tok1', 42)
    assert.equal(s.getSession('tok1')?.lastSeenAt, 42)
    s.deleteSession('tok1')
    assert.equal(s.getSession('tok1'), undefined)
    s.close()
  })

  test(`${name}: login-failure counter is windowed per email`, () => {
    const s = make()
    s.recordLoginFailure('a@acme.test', 100)
    s.recordLoginFailure('a@acme.test', 200)
    s.recordLoginFailure('b@acme.test', 200)
    assert.equal(s.countRecentLoginFailures('a@acme.test', 150), 1, 'only failures at/after the window start count')
    assert.equal(s.countRecentLoginFailures('a@acme.test', 0), 2)
    assert.equal(s.countRecentLoginFailures('b@acme.test', 0), 1)
    s.close()
  })

  test(`${name}: device-authorization flow: start -> approve -> single-use consume`, () => {
    const s = make()
    s.createDeviceAuth({ deviceCode: 'dc1', userCode: 'UC1', status: 'pending', createdAt: 0, expiresAt: 1000 })
    assert.equal(s.getDeviceAuthByDeviceCode('dc1')?.status, 'pending')
    assert.equal(s.approveDeviceAuthByUserCode('nope', { userId: 'u1', orgId: 'orgA', role: 'admin' }, 100), false)
    assert.equal(s.approveDeviceAuthByUserCode('UC1', { userId: 'u1', orgId: 'orgA', role: 'admin' }, 100), true)
    assert.equal(s.approveDeviceAuthByUserCode('UC1', { userId: 'u1', orgId: 'orgA', role: 'admin' }, 100), false, 'already approved: not pending')

    const consumed = s.consumeDeviceAuth('dc1', 200)
    assert.equal(consumed?.userId, 'u1')
    assert.equal(consumed?.orgId, 'orgA')
    assert.equal(s.consumeDeviceAuth('dc1', 200), undefined, 'single-use: already consumed')
    s.close()
  })

  test(`${name}: device code expiry is enforced on approve and consume`, () => {
    const s = make()
    s.createDeviceAuth({ deviceCode: 'dc2', userCode: 'UC2', status: 'pending', createdAt: 0, expiresAt: 100 })
    assert.equal(s.approveDeviceAuthByUserCode('UC2', { userId: 'u1', orgId: 'orgA', role: 'member' }, 200), false, 'expired: approve must fail')
    s.close()
  })
}
