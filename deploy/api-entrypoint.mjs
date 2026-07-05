// AgentGuard control-plane self-host boot script (plan §M5).
//
// This file is NOT part of control-plane/src — it is copied into the api
// image (deploy/api.Dockerfile) alongside an untouched copy of
// control-plane/src and run instead of `src/main.ts`. It exists solely to
// wire a REAL `pg` driver into the injected-async StoragePort boundary
// (control-plane/src/storage/postgres.ts's `PostgresStorage({ query })`)
// without adding `pg` as a control-plane runtime dependency (see
// storage/port.ts: PostgresStorage takes an injected `PgQueryable` so tests
// can wire pg-mem instead). Everything else (notifier, oidc verifier, viewer
// auth, listen options) mirrors control-plane/src/main.ts's buildDeps().
//
// Two separate connection strings, two separate privilege levels:
//   MIGRATE_DATABASE_URL — elevated (POSTGRES_USER/POSTGRES_PASSWORD, the
//     Postgres owner role). Used ONCE at boot, only to run
//     PostgresStorage#migrate() (schema DDL), then discarded.
//   DATABASE_URL — least-privilege (agentguard_api role, DML only — see
//     deploy/postgres-init/001-roles.sh for the exact GRANTs). Used for
//     every request the running server ever serves. A compromised API
//     process can read/write rows but cannot alter the schema.
//
// Falls back to node:sqlite (control-plane/src/storage/sqlite.ts, matching
// src/main.ts's own default) when neither DATABASE_URL nor
// MIGRATE_DATABASE_URL is set, so this image also works for a no-Postgres
// single-node smoke run.

import { createControlPlane } from './src/server.js'
import { StaticOidcVerifier } from './src/verify/oidc.js'
import { StaticViewerAuth } from './src/verify/viewer.js'
import { WebhookNotifier } from './src/notify/webhook.js'
import { RecordingNotifier } from './src/notify/recording.js'

class ConsoleNotifier {
  #recorder = new RecordingNotifier()
  async notify(n) {
    await this.#recorder.notify(n)
    console.error(`[alert] ${n.severity} ${n.ruleId} on ${n.assetId} (org ${n.orgId}) @ ${n.location}`)
  }
}

function parseViewerKeys() {
  const raw = process.env.AGENTGUARD_CP_VIEWER_KEYS
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    console.error('AGENTGUARD_CP_VIEWER_KEYS is not valid JSON; no viewer keys loaded')
  }
  return {}
}

/** Wrap a `pg` Pool as the async PgQueryable PostgresStorage expects. */
function pgQueryable(pool) {
  return {
    query: (text, params) => pool.query(text, params),
  }
}

async function buildStorage() {
  const { DATABASE_URL, MIGRATE_DATABASE_URL } = process.env
  if (!DATABASE_URL && !MIGRATE_DATABASE_URL) {
    const { SqliteStorage } = await import('./src/storage/sqlite.js')
    return new SqliteStorage(process.env.AGENTGUARD_CP_DB ?? ':memory:')
  }
  if (!DATABASE_URL || !MIGRATE_DATABASE_URL) {
    throw new Error('Postgres self-host requires BOTH DATABASE_URL and MIGRATE_DATABASE_URL to be set (see deploy/.env.example)')
  }

  const { Pool } = await import('pg')
  const { PostgresStorage } = await import('./src/storage/postgres.js')

  // 1. Migrate (schema DDL) using the elevated owner role, then drop that pool.
  const migratePool = new Pool({ connectionString: MIGRATE_DATABASE_URL })
  const migrateStorage = new PostgresStorage(pgQueryable(migratePool))
  await migrateStorage.migrate()
  await migratePool.end()

  // 2. Serve every real request using the least-privilege runtime role.
  const runtimePool = new Pool({ connectionString: DATABASE_URL })
  return new PostgresStorage(pgQueryable(runtimePool))
}

async function main() {
  const storage = await buildStorage()
  const notifier = process.env.AGENTGUARD_CP_WEBHOOK
    ? new WebhookNotifier(process.env.AGENTGUARD_CP_WEBHOOK)
    : new ConsoleNotifier()

  const server = createControlPlane({
    storage,
    notifier,
    oidcVerifier: new StaticOidcVerifier(),
    viewerAuth: new StaticViewerAuth(parseViewerKeys()),
    now: () => Date.now(),
    freshnessWindowSec: 300,
    staleThresholdHours: Number(process.env.AGENTGUARD_CP_STALE_HOURS) || 48,
  })

  const port = Number(process.env.PORT) || 8787
  const host = process.env.HOST ?? '0.0.0.0'
  server.listen(port, host, () => {
    console.error(`AgentGuard Control Plane (self-host) listening on http://${host}:${port}`)
  })
}

main().catch((err) => {
  console.error('AgentGuard Control Plane failed to start:', err)
  process.exitCode = 1
})
