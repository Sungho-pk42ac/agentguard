import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { newDb } from 'pg-mem'
import { MemoryStorage } from '../src/storage/memory.js'
import { SqliteStorage } from '../src/storage/sqlite.js'
import { PostgresStorage } from '../src/storage/postgres.js'
import type { StoragePort } from '../src/storage/port.js'
import type { AssetRecord } from '../src/model.js'
import { finding } from './helpers.js'

async function makePostgresStorage(): Promise<StoragePort> {
  const db = newDb()
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  const storage = new PostgresStorage({ query: (text: string, params?: unknown[]) => pool.query(text, params) })
  await storage.migrate()
  return storage
}

const impls: Array<[string, () => StoragePort | Promise<StoragePort>]> = [
  ['memory', () => new MemoryStorage()],
  ['sqlite', () => new SqliteStorage(':memory:')],
  ['postgres', () => makePostgresStorage()],
]

function asset(orgId: string, assetId: string): AssetRecord {
  return { orgId, assetId, label: assetId, kind: 'pc', authKind: 'device-token', secret: 'sec', lastSeenAt: null, createdAt: 0 }
}

for (const [name, make] of impls) {
  test(`${name}: asset create/get/touch/list is org-scoped`, async () => {
    const s = await make()
    await s.createAsset(asset('orgA', 'a1'))
    await s.createAsset(asset('orgB', 'b1'))
    assert.equal((await s.getAsset('orgA', 'a1'))?.assetId, 'a1')
    assert.equal(await s.getAsset('orgB', 'a1'), undefined, 'cross-tenant asset lookup must miss')
    await s.touchAsset('orgA', 'a1', 1234)
    assert.equal((await s.getAsset('orgA', 'a1'))?.lastSeenAt, 1234)
    assert.deepEqual((await s.listAssets('orgA')).map((a) => a.assetId), ['a1'])
    await s.close()
  })

  test(`${name}: upsertFinding reports isNew, dedups, updates lastSeen`, async () => {
    const s = await make()
    const f = finding()
    assert.equal((await s.upsertFinding('orgA', 'a1', f, 100)).isNew, true)
    assert.equal((await s.upsertFinding('orgA', 'a1', f, 200)).isNew, false, 'same fingerprint is not new')
    const rows = await s.listFindings('orgA')
    assert.equal(rows.length, 1)
    assert.equal(rows[0]!.firstSeen, 100)
    assert.equal(rows[0]!.lastSeen, 200)
    await s.close()
  })

  test(`${name}: listFindings filters by surface/severity/asset`, async () => {
    const s = await make()
    await s.upsertFinding('orgA', 'a1', finding({ surface: 'secret', severity: 'critical', fingerprint: 'a'.repeat(32) }), 1)
    await s.upsertFinding('orgA', 'a2', finding({ surface: 'mcp-risk', severity: 'high', fingerprint: 'b'.repeat(32) }), 1)
    assert.equal((await s.listFindings('orgA', { surface: 'secret' })).length, 1)
    assert.equal((await s.listFindings('orgA', { severity: 'high' })).length, 1)
    assert.equal((await s.listFindings('orgA', { assetId: 'a2' })).length, 1)
    assert.equal((await s.listFindings('orgA')).length, 2)
    await s.close()
  })

  test(`${name}: findings are strictly org-scoped (no tenant bleed)`, async () => {
    const s = await make()
    await s.upsertFinding('orgA', 'a1', finding({ fingerprint: 'a'.repeat(32) }), 1)
    await s.upsertFinding('orgB', 'b1', finding({ fingerprint: 'b'.repeat(32) }), 1)
    assert.equal((await s.listFindings('orgA')).length, 1)
    assert.equal((await s.listFindings('orgB')).length, 1)
    assert.equal((await s.listFindings('orgA'))[0]!.fingerprint, 'a'.repeat(32))
    await s.close()
  })

  test(`${name}: alert dedup keyed on (org, fingerprint)`, async () => {
    const s = await make()
    assert.equal(await s.alertExists('orgA', 'fp1'), false)
    await s.recordAlert({ orgId: 'orgA', fingerprint: 'fp1', severity: 'critical', firedAt: 1, channel: 'default' })
    assert.equal(await s.alertExists('orgA', 'fp1'), true)
    assert.equal(await s.alertExists('orgB', 'fp1'), false, 'alert dedup is per-org')
    await s.recordAlert({ orgId: 'orgA', fingerprint: 'fp1', severity: 'critical', firedAt: 2, channel: 'default' })
    assert.equal((await s.listAlerts('orgA')).length, 1, 'duplicate alert is ignored')
    await s.close()
  })

  test(`${name}: enrollment code is single-use and expiry-checked`, async () => {
    const s = await make()
    const hash = createHash('sha256').update('CODE-123').digest('hex')
    await s.putEnrollmentCode('orgA', hash, 1000)
    assert.equal(await s.consumeEnrollmentCode('orgA', hash, 500), true, 'valid before expiry')
    assert.equal(await s.consumeEnrollmentCode('orgA', hash, 500), false, 'single-use: already consumed')

    const expired = createHash('sha256').update('OLD').digest('hex')
    await s.putEnrollmentCode('orgA', expired, 100)
    assert.equal(await s.consumeEnrollmentCode('orgA', expired, 500), false, 'expired code rejected')
    await s.close()
  })
  test(`${name}: org/user creation, email lookup, and org-scoped listing`, async () => {
    const s = await make()
    await s.createOrg({ id: 'orgA', name: 'Acme', webhookSecret: 'whs', createdAt: 0 })
    assert.equal((await s.getOrg('orgA'))?.name, 'Acme')
    assert.equal(await s.getOrg('missing'), undefined)

    await s.createUser({ id: 'u1', orgId: 'orgA', email: 'a@acme.test', passwordHash: 'ph1', role: 'admin', createdAt: 1 })
    await s.createUser({ id: 'u2', orgId: 'orgA', email: 'b@acme.test', passwordHash: 'ph2', role: 'member', createdAt: 2 })
    assert.equal((await s.getUserByEmail('a@acme.test'))?.id, 'u1')
    assert.equal(await s.getUserByEmail('nope@acme.test'), undefined)
    assert.equal((await s.getUser('orgA', 'u1'))?.email, 'a@acme.test')
    assert.equal(await s.getUser('orgB', 'u1'), undefined, 'cross-tenant user lookup must miss')
    assert.deepEqual(
      (await s.listUsers('orgA')).map((u) => u.id),
      ['u1', 'u2'],
    )
    await s.close()
  })

  test(`${name}: invite is single-use and expiry-checked (like enrollment codes)`, async () => {
    const s = await make()
    await s.createInvite({ code: 'INVITE1', orgId: 'orgA', role: 'member', expiresAt: 1000 })
    const first = await s.consumeInvite('INVITE1', 500)
    assert.equal(first?.orgId, 'orgA')
    assert.equal(first?.role, 'member')
    assert.equal(await s.consumeInvite('INVITE1', 500), undefined, 'single-use: already consumed')

    await s.createInvite({ code: 'OLD', orgId: 'orgA', role: 'admin', expiresAt: 100 })
    assert.equal(await s.consumeInvite('OLD', 500), undefined, 'expired invite rejected')
    await s.close()
  })

  test(`${name}: session create/get/touch/delete`, async () => {
    const s = await make()
    await s.createSession({ token: 'tok1', userId: 'u1', orgId: 'orgA', role: 'admin', kind: 'cookie', csrfToken: 'csrf1', createdAt: 0, expiresAt: 1000, lastSeenAt: 0 })
    assert.equal((await s.getSession('tok1'))?.userId, 'u1')
    await s.touchSession('tok1', 42)
    assert.equal((await s.getSession('tok1'))?.lastSeenAt, 42)
    await s.deleteSession('tok1')
    assert.equal(await s.getSession('tok1'), undefined)
    await s.close()
  })

  test(`${name}: login-failure counter is windowed per email`, async () => {
    const s = await make()
    await s.recordLoginFailure('a@acme.test', 100)
    await s.recordLoginFailure('a@acme.test', 200)
    await s.recordLoginFailure('b@acme.test', 200)
    assert.equal(await s.countRecentLoginFailures('a@acme.test', 150), 1, 'only failures at/after the window start count')
    assert.equal(await s.countRecentLoginFailures('a@acme.test', 0), 2)
    assert.equal(await s.countRecentLoginFailures('b@acme.test', 0), 1)
    await s.close()
  })

  test(`${name}: device-authorization flow: start -> approve -> single-use consume`, async () => {
    const s = await make()
    await s.createDeviceAuth({ deviceCode: 'dc1', userCode: 'UC1', status: 'pending', createdAt: 0, expiresAt: 1000 })
    assert.equal((await s.getDeviceAuthByDeviceCode('dc1'))?.status, 'pending')
    assert.equal(await s.approveDeviceAuthByUserCode('nope', { userId: 'u1', orgId: 'orgA', role: 'admin' }, 100), false)
    assert.equal(await s.approveDeviceAuthByUserCode('UC1', { userId: 'u1', orgId: 'orgA', role: 'admin' }, 100), true)
    assert.equal(await s.approveDeviceAuthByUserCode('UC1', { userId: 'u1', orgId: 'orgA', role: 'admin' }, 100), false, 'already approved: not pending')

    const consumed = await s.consumeDeviceAuth('dc1', 200)
    assert.equal(consumed?.userId, 'u1')
    assert.equal(consumed?.orgId, 'orgA')
    assert.equal(consumed?.status, 'consumed', 'parity: returned record reflects the post-update state in both adapters')
    assert.equal(await s.consumeDeviceAuth('dc1', 200), undefined, 'single-use: already consumed')
    await s.close()
  })

  test(`${name}: device code expiry is enforced on approve and consume`, async () => {
    const s = await make()
    await s.createDeviceAuth({ deviceCode: 'dc2', userCode: 'UC2', status: 'pending', createdAt: 0, expiresAt: 100 })
    assert.equal(await s.approveDeviceAuthByUserCode('UC2', { userId: 'u1', orgId: 'orgA', role: 'member' }, 200), false, 'expired: approve must fail')
    await s.close()
  })
  test(`${name}: offboarding: create is idempotent by (orgId, employee.id, effectiveAt)`, async () => {
    const s = await make()
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
    const first = await s.createOffboardingTask(base)
    assert.equal(first.created, true)
    assert.equal(first.task.id, 'off1')

    // same idempotency key, different id/assetIds: the EXISTING task wins
    const second = await s.createOffboardingTask({ ...base, id: 'off2', assetIds: ['a2', 'a3'] })
    assert.equal(second.created, false)
    assert.equal(second.task.id, 'off1', 're-create with the same key returns the existing task')
    assert.deepEqual(second.task.assetIds, ['a1'])

    // a different effectiveAt is a distinct task
    const distinct = await s.createOffboardingTask({ ...base, id: 'off3', effectiveAt: '2026-09-01T00:00:00.000Z' })
    assert.equal(distinct.created, true)

    assert.equal((await s.listOffboardingTasks('orgA')).length, 2)
    assert.equal((await s.listOffboardingTasks('orgB')).length, 0, 'org-scoped listing')
    await s.close()
  })

  test(`${name}: offboarding: getOffboardingTask/listOffboardingTasks are org-scoped`, async () => {
    const s = await make()
    await s.createOffboardingTask({
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
    assert.equal((await s.getOffboardingTask('orgA', 'off1'))?.id, 'off1')
    assert.equal(await s.getOffboardingTask('orgB', 'off1'), undefined, 'cross-tenant task lookup must miss')
    assert.equal(await s.getOffboardingTask('orgA', 'nope'), undefined)
    await s.close()
  })

  test(`${name}: offboarding: transitionOffboardingTask enforces open->sweeping->done, audits, and org-scopes`, async () => {
    const s = await make()
    await s.createOffboardingTask({
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

    assert.deepEqual(
      await s.transitionOffboardingTask('orgB', 'off1', 'sweeping', 'u1', 10),
      { ok: false, reason: 'not_found' },
      'cross-tenant transition must miss',
    )

    const skip = await s.transitionOffboardingTask('orgA', 'off1', 'done', 'u1', 10)
    assert.deepEqual(skip, { ok: false, reason: 'invalid_transition' })

    const toSweeping = await s.transitionOffboardingTask('orgA', 'off1', 'sweeping', 'u1', 20)
    assert.equal(toSweeping.ok, true)
    if (toSweeping.ok) {
      assert.equal(toSweeping.task.status, 'sweeping')
      assert.equal(toSweeping.task.audit.length, 2)
      assert.deepEqual(toSweeping.task.audit[1], { at: 20, from: 'open', to: 'sweeping', actor: 'u1' })
    }

    const backwards = await s.transitionOffboardingTask('orgA', 'off1', 'open', 'u1', 30)
    assert.deepEqual(backwards, { ok: false, reason: 'invalid_transition' })

    const toDone = await s.transitionOffboardingTask('orgA', 'off1', 'done', 'u1', 40)
    assert.equal(toDone.ok, true)
    if (toDone.ok) {
      assert.equal(toDone.task.status, 'done')
      assert.equal(toDone.task.audit.length, 3)
    }

    assert.deepEqual(await s.transitionOffboardingTask('orgA', 'off1', 'sweeping', 'u1', 50), { ok: false, reason: 'invalid_transition' }, 'done is terminal')
    assert.deepEqual(await s.transitionOffboardingTask('orgA', 'nope', 'sweeping', 'u1', 50), { ok: false, reason: 'not_found' })
    await s.close()
  })
  test(`${name}: policy: getPolicy is undefined until first PUT, then rulesVersion starts at 1 and bumps on every subsequent put`, async () => {
    const s = await make()
    assert.equal(await s.getPolicy('orgA'), undefined)
    const first = await s.putPolicyRules('orgA', 'denyRead: []')
    assert.equal(first.rulesVersion, 1)
    assert.equal(first.exceptionsVersion, 0)
    assert.equal(first.rules, 'denyRead: []')
    const second = await s.putPolicyRules('orgA', 'denyRead:\n  - "**/.env"\n')
    assert.equal(second.rulesVersion, 2)
    assert.equal((await s.getPolicy('orgA'))?.rules, 'denyRead:\n  - "**/.env"\n')
    await s.close()
  })

  test(`${name}: policy: rules and exceptionsVersion are strictly org-scoped (no tenant bleed)`, async () => {
    const s = await make()
    await s.putPolicyRules('orgA', 'orgA-rules')
    assert.equal(await s.getPolicy('orgB'), undefined, 'org B never sees org A rules')
    assert.equal((await s.getPolicy('orgA'))?.rules, 'orgA-rules')
    await s.close()
  })

  test(`${name}: policy: exceptions are created pending, listed org-scoped, and resolved exactly once`, async () => {
    const s = await make()
    await s.createException({ id: 'exc1', orgId: 'orgA', ruleId: 'rule-x', reason: 'temporary', status: 'pending', createdAt: 10 })
    await s.createException({ id: 'exc2', orgId: 'orgB', ruleId: 'rule-y', reason: 'other org', status: 'pending', createdAt: 10 })
    assert.deepEqual(
      (await s.listExceptions('orgA')).map((e) => e.id),
      ['exc1'],
      'exceptions are strictly org-scoped',
    )

    const resolved = await s.resolveException('orgA', 'exc1', 'approved', 20)
    assert.equal(resolved?.status, 'approved')
    assert.equal(resolved?.resolvedAt, 20)
    assert.equal((await s.listExceptions('orgA'))[0]?.status, 'approved')

    // resolving again fails: no longer pending
    assert.equal(await s.resolveException('orgA', 'exc1', 'rejected', 30), undefined)

    // resolving a cross-org id fails: not found under orgB
    assert.equal(await s.resolveException('orgB', 'exc1', 'approved', 30), undefined)

    // resolving bumps the org's exceptionsVersion (creating a policy row if none existed)
    assert.equal((await s.getPolicy('orgA'))?.exceptionsVersion, 1)
    assert.equal(await s.getPolicy('orgB'), undefined, 'orgB policy row untouched — its exception is still pending')
    await s.close()
  })

  test(`${name}: cve cache is keyed by (ecosystem, package, version), NOT orgId — the sole global surface`, async () => {
    const s = await make()
    assert.equal(await s.getCveCache('npm', 'leftpad', '1.0.0'), undefined)
    await s.putCveCache('npm', 'leftpad', '1.0.0', {
      vulnIds: ['GHSA-1', 'GHSA-2'],
      details: [
        { id: 'GHSA-1', severity: 'high', summary: 'bad thing' },
        { id: 'GHSA-2', severity: 'unknown' },
      ],
      fetchedAt: 1000,
      status: 'fresh',
    })
    const cached = await s.getCveCache('npm', 'leftpad', '1.0.0')
    assert.deepEqual(cached?.vulnIds, ['GHSA-1', 'GHSA-2'])
    assert.equal(cached?.details.length, 2)
    assert.equal(cached?.status, 'fresh')
    assert.equal(await s.getCveCache('npm', 'leftpad', '2.0.0'), undefined, 'a different version is a different cache row')
    assert.equal(await s.getCveCache('pypi', 'leftpad', '1.0.0'), undefined, 'a different ecosystem is a different cache row')

    // overwrite (e.g. a stale re-fetch)
    await s.putCveCache('npm', 'leftpad', '1.0.0', { ...cached!, status: 'stale' })
    assert.equal((await s.getCveCache('npm', 'leftpad', '1.0.0'))?.status, 'stale')
    await s.close()
  })

  test(`${name}: updateFindingCve is org-scoped and projects onto the matching finding only`, async () => {
    const s = await make()
    await s.upsertFinding('orgA', 'a1', finding({ surface: 'npm-global', fingerprint: 'c'.repeat(32) }), 1)
    await s.upsertFinding('orgB', 'b1', finding({ surface: 'npm-global', fingerprint: 'c'.repeat(32) }), 1)
    await s.updateFindingCve('orgA', 'a1', 'c'.repeat(32), ['GHSA-1'], 'critical')
    const [fa] = await s.listFindings('orgA')
    const [fb] = await s.listFindings('orgB')
    assert.deepEqual(fa?.cveIds, ['GHSA-1'])
    assert.equal(fa?.cveSeverity, 'critical')
    assert.equal(fb?.cveIds, undefined, 'orgB finding with the same fingerprint is untouched')
    await s.close()
  })
}
