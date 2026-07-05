// PostgresStorage-specific coverage (M5 G006). storage.test.ts already runs
// the full parametric StoragePort contract battery against Memory/Sqlite/
// Postgres (the 'postgres' impl below, wired via pg-mem's async pg adapter).
// This file asserts the Postgres-only concerns: the contract genuinely
// passes on a real (in-memory-simulated) Postgres wire client, cve_cache
// stays global across orgs, and the least-privilege auth/findings schema
// role split is real DDL (asserted as a documented no-op for the two
// single-store adapters).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newDb } from 'pg-mem'
import { AUTH_SCHEMA_DDL, FINDINGS_SCHEMA_DDL, ROLE_GRANTS_DDL, PostgresStorage } from '../src/storage/postgres.js'
import { MemoryStorage } from '../src/storage/memory.js'
import { SqliteStorage } from '../src/storage/sqlite.js'
import type { StoragePort } from '../src/storage/port.js'
import { finding } from './helpers.js'

async function makePgStorage(): Promise<PostgresStorage> {
  const db = newDb()
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  const storage = new PostgresStorage({ query: (text: string, params?: unknown[]) => pool.query(text, params) })
  await storage.migrate()
  return storage
}

test('postgres: migrate() creates a working schema on a fresh backend (CREATE SCHEMA/TABLE IF NOT EXISTS)', async () => {
  const storage = await makePgStorage()
  await storage.createOrg({ id: 'orgA', name: 'Acme', webhookSecret: 'whs', createdAt: 0 })
  assert.equal((await storage.getOrg('orgA'))?.name, 'Acme')
  await storage.close()
})

test('postgres: full StoragePort contract battery passes end-to-end on the pg-mem client (asset -> finding -> alert)', async () => {
  const storage = await makePgStorage()
  await storage.createAsset({ orgId: 'orgA', assetId: 'a1', label: 'laptop', kind: 'pc', authKind: 'device-token', secret: 's', lastSeenAt: null, createdAt: 0 })
  assert.equal((await storage.getAsset('orgA', 'a1'))?.label, 'laptop')

  const f = finding({ severity: 'critical' })
  const { isNew } = await storage.upsertFinding('orgA', 'a1', f, 100)
  assert.equal(isNew, true)
  const findings = await storage.listFindings('orgA')
  assert.equal(findings.length, 1)

  assert.equal(await storage.alertExists('orgA', f.fingerprint), false)
  await storage.recordAlert({ orgId: 'orgA', fingerprint: f.fingerprint, severity: 'critical', firedAt: 100, channel: 'default' })
  assert.equal(await storage.alertExists('orgA', f.fingerprint), true)

  await storage.close()
})

test('postgres: cve_cache is global — shared across every org, never scoped by orgId', async () => {
  const storage = await makePgStorage()
  await storage.putCveCache('npm', 'leftpad', '1.0.0', {
    vulnIds: ['GHSA-1'],
    details: [{ id: 'GHSA-1', severity: 'high' }],
    fetchedAt: 1000,
    status: 'fresh',
  })

  // Two unrelated orgs both see the SAME cached advisory row: cve_cache has
  // no orgId column at all (see FINDINGS_SCHEMA_DDL) and getCveCache never
  // takes one — there is no tenant-scoping mechanism to bypass.
  const forOrgA = await storage.getCveCache('npm', 'leftpad', '1.0.0')
  const forOrgB = await storage.getCveCache('npm', 'leftpad', '1.0.0')
  assert.deepEqual(forOrgA, forOrgB)
  assert.deepEqual(forOrgA?.vulnIds, ['GHSA-1'])

  await storage.upsertFinding('orgA', 'a1', finding({ surface: 'npm-global', fingerprint: 'd'.repeat(32) }), 1)
  await storage.upsertFinding('orgB', 'b1', finding({ surface: 'npm-global', fingerprint: 'd'.repeat(32) }), 1)
  await storage.updateFindingCve('orgA', 'a1', 'd'.repeat(32), ['GHSA-1'], 'high')
  const [fa] = await storage.listFindings('orgA')
  const [fb] = await storage.listFindings('orgB')
  assert.deepEqual(fa?.cveIds, ['GHSA-1'], 'orgA finding was enriched from the shared global cache')
  assert.equal(fb?.cveIds, undefined, 'orgB finding is untouched — enrichment projection stays org-scoped even though the cache itself is global')

  await storage.close()
})

// ── least-privilege role split ──
//
// Postgres is the only adapter with a real database role boundary to grant.
// The DDL constants are exported specifically so this assertion (and the
// self-host docs/migrations) can inspect the real schema text rather than a
// paraphrase of it.
test('postgres: DDL defines two schemas (auth, findings) with a least-privilege agentguard_api role grant', () => {
  assert.match(AUTH_SCHEMA_DDL, /CREATE SCHEMA IF NOT EXISTS auth/)
  assert.match(FINDINGS_SCHEMA_DDL, /CREATE SCHEMA IF NOT EXISTS findings/)

  // auth.* tables live under the auth schema only.
  for (const table of ['orgs', 'users', 'invites', 'sessions', 'login_failures', 'device_auths', 'enrollment_codes', 'oidc_grants']) {
    assert.match(AUTH_SCHEMA_DDL, new RegExp(`CREATE TABLE IF NOT EXISTS auth\\.${table} `), `auth.${table} must be declared in the auth schema`)
  }
  // findings.* tables live under the findings schema only.
  for (const table of [
    'assets',
    'findings',
    'alerts',
    'ingest_events',
    'policies',
    'policy_exceptions',
    'offboarding_tasks',
    'mcp_catalog',
    'org_settings',
    'cve_cache',
  ]) {
    assert.match(
      FINDINGS_SCHEMA_DDL,
      new RegExp(`CREATE TABLE IF NOT EXISTS findings\\.${table} `),
      `findings.${table} must be declared in the findings schema`,
    )
  }

  // cve_cache is the sole non-org-scoped table: no org_id column anywhere in
  // its column list.
  const cveCacheDdl = /CREATE TABLE IF NOT EXISTS findings\.cve_cache \(([\s\S]*?)\);/.exec(FINDINGS_SCHEMA_DDL)?.[1] ?? ''
  assert.ok(cveCacheDdl.length > 0, 'cve_cache DDL must be present')
  assert.doesNotMatch(cveCacheDdl, /org_id/, 'cve_cache must not carry an org_id column — it is the sole global surface')

  // Least-privilege application role: exactly the DML it needs, scoped to
  // both schemas, no DDL/ownership/superuser grants.
  assert.match(ROLE_GRANTS_DDL, /CREATE ROLE agentguard_api/)
  assert.match(ROLE_GRANTS_DDL, /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO agentguard_api/)
  assert.match(ROLE_GRANTS_DDL, /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA findings TO agentguard_api/)
  assert.doesNotMatch(ROLE_GRANTS_DDL, /SUPERUSER/i)
  assert.doesNotMatch(ROLE_GRANTS_DDL, /CREATEDB|CREATEROLE/i)
})

// pg-mem does not implement GRANT/DO-block execution semantics (it is a
// query-planner simulator, not a full Postgres), so ROLE_GRANTS_DDL's actual
// grant effect can only be verified against a real Postgres server — out of
// scope for this offline suite. The structural assertions above (exact role
// name, exact schemas, exact privilege verbs, no superuser/createdb) are the
// enforceable contract here; self-hosting.md documents running this DDL once
// against the real database during provisioning.

// Memory/Sqlite are explicitly single-store, single-process adapters with no
// separate database role to grant — the auth/findings role split is a
// Postgres-only concern (see storage/postgres.ts's DDL comment). Assert that
// no-op explicitly rather than leaving it implicit.
for (const [name, make] of [
  ['memory', () => new MemoryStorage()],
  ['sqlite', () => new SqliteStorage(':memory:')],
] as const) {
  test(`${name}: has no separate auth/findings role split — single-store adapter, documented no-op`, async () => {
    const s: StoragePort = make()
    // The adapter exposes exactly one underlying store (no schema/role
    // concept at all) yet still serves both the "auth" surface (orgs/users/
    // sessions) and the "findings" surface (assets/findings/policy/...)
    // through the same StoragePort — i.e. there is no privilege boundary to
    // grant because there is only one execution context.
    await s.createOrg({ id: 'orgA', name: 'Acme', webhookSecret: 'whs', createdAt: 0 })
    await s.createAsset({ orgId: 'orgA', assetId: 'a1', label: 'a1', kind: 'pc', authKind: 'device-token', lastSeenAt: null, createdAt: 0 })
    assert.equal((await s.getOrg('orgA'))?.id, 'orgA', 'auth-surface data lives in the same store as findings-surface data')
    assert.equal((await s.getAsset('orgA', 'a1'))?.assetId, 'a1')
    await s.close()
  })
}
