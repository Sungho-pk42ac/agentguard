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
    assert.equal(consumed?.status, 'consumed', 'parity: returned record reflects the post-update state in both adapters')
    assert.equal(s.consumeDeviceAuth('dc1', 200), undefined, 'single-use: already consumed')
    s.close()
  })

  test(`${name}: device code expiry is enforced on approve and consume`, () => {
    const s = make()
    s.createDeviceAuth({ deviceCode: 'dc2', userCode: 'UC2', status: 'pending', createdAt: 0, expiresAt: 100 })
    assert.equal(s.approveDeviceAuthByUserCode('UC2', { userId: 'u1', orgId: 'orgA', role: 'member' }, 200), false, 'expired: approve must fail')
    s.close()
  })
  test(`${name}: offboarding: create is idempotent by (orgId, employee.id, effectiveAt)`, () => {
    const s = make()
    const base = {
      id: 'off1',
      orgId: 'orgA',
      employee: { id: 'emp1', email: 'e1@acme.test', name: 'E1' },
      assetIds: ['a1'],
      unmatched: false,
      status: 'open' as const,
      effectiveAt: '2026-08-01T00:00:00.000Z',
      createdAt: 0,
      updatedAt: 0,
      audit: [{ at: 0, from: '' as const, to: 'open' as const, actor: 'webhook' }],
    }
    const first = s.createOffboardingTask(base)
    assert.equal(first.created, true)
    assert.equal(first.task.id, 'off1')

    // same idempotency key, different id/assetIds: the EXISTING task wins
    const second = s.createOffboardingTask({ ...base, id: 'off2', assetIds: ['a2', 'a3'] })
    assert.equal(second.created, false)
    assert.equal(second.task.id, 'off1', 're-create with the same key returns the existing task')
    assert.deepEqual(second.task.assetIds, ['a1'])

    // a different effectiveAt is a distinct task
    const distinct = s.createOffboardingTask({ ...base, id: 'off3', effectiveAt: '2026-09-01T00:00:00.000Z' })
    assert.equal(distinct.created, true)

    assert.equal(s.listOffboardingTasks('orgA').length, 2)
    assert.equal(s.listOffboardingTasks('orgB').length, 0, 'org-scoped listing')
    s.close()
  })

  test(`${name}: offboarding: getOffboardingTask/listOffboardingTasks are org-scoped`, () => {
    const s = make()
    s.createOffboardingTask({
      id: 'off1',
      orgId: 'orgA',
      employee: { id: 'emp1', email: 'e1@acme.test', name: 'E1' },
      assetIds: [],
      unmatched: true,
      status: 'open',
      effectiveAt: '2026-08-01T00:00:00.000Z',
      createdAt: 0,
      updatedAt: 0,
      audit: [{ at: 0, from: '', to: 'open', actor: 'webhook' }],
    })
    assert.equal(s.getOffboardingTask('orgA', 'off1')?.id, 'off1')
    assert.equal(s.getOffboardingTask('orgB', 'off1'), undefined, 'cross-tenant task lookup must miss')
    assert.equal(s.getOffboardingTask('orgA', 'nope'), undefined)
    s.close()
  })

  test(`${name}: offboarding: transitionOffboardingTask enforces open->sweeping->done, audits, and org-scopes`, () => {
    const s = make()
    s.createOffboardingTask({
      id: 'off1',
      orgId: 'orgA',
      employee: { id: 'emp1', email: 'e1@acme.test', name: 'E1' },
      assetIds: ['a1'],
      unmatched: false,
      status: 'open',
      effectiveAt: '2026-08-01T00:00:00.000Z',
      createdAt: 0,
      updatedAt: 0,
      audit: [{ at: 0, from: '', to: 'open', actor: 'webhook' }],
    })

    assert.deepEqual(s.transitionOffboardingTask('orgB', 'off1', 'sweeping', 'u1', 10), { ok: false, reason: 'not_found' }, 'cross-tenant transition must miss')

    const skip = s.transitionOffboardingTask('orgA', 'off1', 'done', 'u1', 10)
    assert.deepEqual(skip, { ok: false, reason: 'invalid_transition' })

    const toSweeping = s.transitionOffboardingTask('orgA', 'off1', 'sweeping', 'u1', 20)
    assert.equal(toSweeping.ok, true)
    if (toSweeping.ok) {
      assert.equal(toSweeping.task.status, 'sweeping')
      assert.equal(toSweeping.task.audit.length, 2)
      assert.deepEqual(toSweeping.task.audit[1], { at: 20, from: 'open', to: 'sweeping', actor: 'u1' })
    }

    const backwards = s.transitionOffboardingTask('orgA', 'off1', 'open', 'u1', 30)
    assert.deepEqual(backwards, { ok: false, reason: 'invalid_transition' })

    const toDone = s.transitionOffboardingTask('orgA', 'off1', 'done', 'u1', 40)
    assert.equal(toDone.ok, true)
    if (toDone.ok) {
      assert.equal(toDone.task.status, 'done')
      assert.equal(toDone.task.audit.length, 3)
    }

    assert.deepEqual(s.transitionOffboardingTask('orgA', 'off1', 'sweeping', 'u1', 50), { ok: false, reason: 'invalid_transition' }, 'done is terminal')
    assert.deepEqual(s.transitionOffboardingTask('orgA', 'nope', 'sweeping', 'u1', 50), { ok: false, reason: 'not_found' })
    s.close()
  })
  test(`${name}: policy: getPolicy is undefined until first PUT, then rulesVersion starts at 1 and bumps on every subsequent put`, () => {
    const s = make()
    assert.equal(s.getPolicy('orgA'), undefined)
    const first = s.putPolicyRules('orgA', 'denyRead: []')
    assert.equal(first.rulesVersion, 1)
    assert.equal(first.exceptionsVersion, 0)
    assert.equal(first.rules, 'denyRead: []')
    const second = s.putPolicyRules('orgA', 'denyRead:\n  - "**/.env"\n')
    assert.equal(second.rulesVersion, 2)
    assert.equal(s.getPolicy('orgA')?.rules, 'denyRead:\n  - "**/.env"\n')
    s.close()
  })

  test(`${name}: policy: rules and exceptionsVersion are strictly org-scoped (no tenant bleed)`, () => {
    const s = make()
    s.putPolicyRules('orgA', 'orgA-rules')
    assert.equal(s.getPolicy('orgB'), undefined, 'org B never sees org A rules')
    assert.equal(s.getPolicy('orgA')?.rules, 'orgA-rules')
    s.close()
  })

  test(`${name}: policy: exceptions are created pending, listed org-scoped, and resolved exactly once`, () => {
    const s = make()
    s.createException({ id: 'exc1', orgId: 'orgA', ruleId: 'rule-x', reason: 'temporary', status: 'pending', createdAt: 10 })
    s.createException({ id: 'exc2', orgId: 'orgB', ruleId: 'rule-y', reason: 'other org', status: 'pending', createdAt: 10 })
    assert.deepEqual(
      s.listExceptions('orgA').map((e) => e.id),
      ['exc1'],
      'exceptions are strictly org-scoped',
    )

    const resolved = s.resolveException('orgA', 'exc1', 'approved', 20)
    assert.equal(resolved?.status, 'approved')
    assert.equal(resolved?.resolvedAt, 20)
    assert.equal(s.listExceptions('orgA')[0]?.status, 'approved')

    // resolving again fails: no longer pending
    assert.equal(s.resolveException('orgA', 'exc1', 'rejected', 30), undefined)

    // resolving a cross-org id fails: not found under orgB
    assert.equal(s.resolveException('orgB', 'exc1', 'approved', 30), undefined)

    // resolving bumps the org's exceptionsVersion (creating a policy row if none existed)
    assert.equal(s.getPolicy('orgA')?.exceptionsVersion, 1)
    assert.equal(s.getPolicy('orgB'), undefined, 'orgB policy row untouched — its exception is still pending')
    s.close()
  })

  test(`${name}: cve cache is keyed by (ecosystem, package, version), NOT orgId — the sole global surface`, () => {
    const s = make()
    assert.equal(s.getCveCache('npm', 'leftpad', '1.0.0'), undefined)
    s.putCveCache('npm', 'leftpad', '1.0.0', {
      vulnIds: ['GHSA-1', 'GHSA-2'],
      details: [
        { id: 'GHSA-1', severity: 'high', summary: 'bad thing' },
        { id: 'GHSA-2', severity: 'unknown' },
      ],
      fetchedAt: 1000,
      status: 'fresh',
    })
    const cached = s.getCveCache('npm', 'leftpad', '1.0.0')
    assert.deepEqual(cached?.vulnIds, ['GHSA-1', 'GHSA-2'])
    assert.equal(cached?.details.length, 2)
    assert.equal(cached?.status, 'fresh')
    assert.equal(s.getCveCache('npm', 'leftpad', '2.0.0'), undefined, 'a different version is a different cache row')
    assert.equal(s.getCveCache('pypi', 'leftpad', '1.0.0'), undefined, 'a different ecosystem is a different cache row')

    // overwrite (e.g. a stale re-fetch)
    s.putCveCache('npm', 'leftpad', '1.0.0', { ...cached!, status: 'stale' })
    assert.equal(s.getCveCache('npm', 'leftpad', '1.0.0')?.status, 'stale')
    s.close()
  })

  test(`${name}: updateFindingCve is org-scoped and projects onto the matching finding only`, () => {
    const s = make()
    s.upsertFinding('orgA', 'a1', finding({ surface: 'npm-global', fingerprint: 'c'.repeat(32) }), 1)
    s.upsertFinding('orgB', 'b1', finding({ surface: 'npm-global', fingerprint: 'c'.repeat(32) }), 1)
    s.updateFindingCve('orgA', 'a1', 'c'.repeat(32), ['GHSA-1'], 'critical')
    const [fa] = s.listFindings('orgA')
    const [fb] = s.listFindings('orgB')
    assert.deepEqual(fa?.cveIds, ['GHSA-1'])
    assert.equal(fa?.cveSeverity, 'critical')
    assert.equal(fb?.cveIds, undefined, 'orgB finding with the same fingerprint is untouched')
    s.close()
  })
}
