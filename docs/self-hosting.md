# Self-hosting AgentGuard (plan §M5)

This document covers running the AgentGuard control plane + web console
yourself, instead of (or alongside) the managed one. Everything under
`deploy/` is a template — copy and adapt it for your own infrastructure.

## Architecture

```
                          Internet
                              │
                     :80 / :443 (TLS via Caddy)
                              │
                    ┌─────────────────┐
                    │  proxy (Caddy)  │   deploy/Caddyfile
                    └───┬─────────┬───┘
                        │         │
             /v1/*, /api/*,   everything else
               /healthz            │
                        │         │
                 ┌──────▼───┐ ┌───▼──────┐
                 │   api    │ │   web    │
                 │ (control │ │ (static  │
                 │  plane)  │ │  export) │
                 └────┬─────┘ └──────────┘
                      │
                 ┌────▼─────┐
                 │ postgres │
                 └──────────┘
```

- **`proxy`** (`caddy:2-alpine`, `deploy/Caddyfile`) is the only container
  that publishes host ports (80/443). It reverse-proxies `/v1/*`, `/api/*`,
  and `/healthz` to `api`, and everything else to `web`.
- **`web`** (`deploy/web.Dockerfile`) is the Next.js console built as a
  static export (`web/next.config.mjs`: `output: 'export'`) — no Next.js
  server runtime, no session store, no API pass-through. It is served by a
  bare `caddy:2-alpine` `file_server` inside its own container
  (`deploy/web.Caddyfile`), then re-proxied by the outer `proxy`.
- **`api`** (`deploy/api.Dockerfile`) is `control-plane/` run via
  `deploy/api-entrypoint.mjs` instead of `src/main.ts` — the entrypoint adds
  Postgres wiring (a real `pg.Pool` injected into `PostgresStorage`'s
  `PgQueryable` port) on top of `main.ts`'s sqlite/memory default. It is the
  sole session + CSRF authority (`agentguard_session` / `agentguard_csrf`
  cookies, `x-agentguard-csrf` header — see `control-plane/src/server.ts`).
- **`postgres`** (`postgres:16-alpine`) is the durable store, with a
  least-privilege runtime role for `api` (see [Postgres role
  split](#postgres-role-split) below).

**Why one origin matters:** because `proxy` fronts both `web` and `api` on
the exact same host and port, the browser sees ONE origin. The
control-plane's session and CSRF cookies are therefore first-party — no
cross-site cookie, no CORS dance, no `SameSite=None` requirement. This is
verified by `deploy/smoke-cookie-roundtrip.mjs`.

## Quick start

```sh
cd deploy
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD, POSTGRES_API_PASSWORD, and (for a real
# deployment) DOMAIN to your public hostname.
docker compose --env-file .env up -d --build
```

- Local/dev (`DOMAIN=localhost`, the default): open `http://localhost/`.
  Caddy detects `localhost` is not a public hostname and skips automatic
  HTTPS, serving plain HTTP on `:80`.
- Production (`DOMAIN=agentguard.example.com`, DNS already pointed at this
  host): open `https://agentguard.example.com/`. Caddy provisions a Let's
  Encrypt certificate automatically on first request; ports 80 and 443 must
  be reachable from the internet for the ACME HTTP-01 challenge.

Verify the same-origin cookie contract end to end once the stack is up:

```sh
BASE_URL=http://localhost node deploy/smoke-cookie-roundtrip.mjs
```

Tear down with `docker compose --env-file .env down` (add `-v` to also drop
the `postgres_data` volume — **this deletes all data**).

## Environment variables

See `deploy/.env.example` for the authoritative, commented list. Summary:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DOMAIN` | `proxy` | Public hostname; `localhost` disables automatic HTTPS. |
| `POSTGRES_DB` | `postgres`, `api` | Database name. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `postgres`, `api` | Owner/superuser role — the ONLY role that runs schema migrations. |
| `POSTGRES_API_PASSWORD` | `postgres`, `api` | Password for the least-privilege `agentguard_api` runtime role. |
| `AGENTGUARD_CP_VIEWER_KEYS` | `api` | JSON map of legacy static viewer read-tokens to org id (`{}` disables). |
| `AGENTGUARD_CP_WEBHOOK` | `api` | Slack/Teams incoming-webhook URL for alerts (stderr logging if unset). |
| `AGENTGUARD_CP_STALE_HOURS` | `api` | Hours of silence before an asset is flagged stale. |

`DATABASE_URL` and `MIGRATE_DATABASE_URL` are **not** set in `.env` — they
are composed automatically inside `deploy/docker-compose.yml` from the
`POSTGRES_*` variables above, so the password lives in exactly one place.

## Postgres role split

`control-plane`'s only declared runtime dependency is `zod` — it does
**not** depend on `pg`. `PostgresStorage` (`control-plane/src/storage/postgres.ts`)
takes an injected async `PgQueryable` (`{ query(text, params) }`), so tests
wire `pg-mem` and only `deploy/api.Dockerfile` installs a real `pg` driver
(`npm install --no-save pg`, at image-build time — `package.json` and its
lockfile are never modified).

Self-hosting goes further and splits Postgres *itself* into two roles,
provisioned by `deploy/postgres-init/001-roles.sh` (runs once, automatically,
on first boot against an empty `postgres_data` volume):

- **`$POSTGRES_USER`** (the official Postgres image's bootstrap
  superuser/owner role) — the ONLY role that ever runs schema DDL. Used by
  `deploy/api-entrypoint.mjs` exactly once at boot, over
  `MIGRATE_DATABASE_URL`, to call `PostgresStorage#migrate()`.
- **`agentguard_api`** — the role the `api` container actually connects as
  for every request, over `DATABASE_URL`. `PostgresStorage#migrate()`
  (`control-plane/src/storage/postgres.ts`) creates TWO schemas, not
  `public` — `auth` (orgs/users/invites/sessions/login_failures/
  device_auths/enrollment_codes/oidc_grants) and `findings`
  (assets/findings/alerts/ingest_events/policies/policy_exceptions/
  offboarding_tasks/mcp_catalog/org_settings/cve_cache — `cve_cache` is the
  sole table with no `org_id` column, by design). `agentguard_api` is
  granted only:

  ```sql
  GRANT CONNECT ON DATABASE agentguard TO agentguard_api;
  GRANT USAGE ON SCHEMA auth, findings TO agentguard_api;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO agentguard_api;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA findings TO agentguard_api;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth, findings TO agentguard_api;
  -- plus ALTER DEFAULT PRIVILEGES (both schemas) so tables created later
  -- (by the owner role, during migrate()) are covered automatically.
  ```

  No `CREATE`, no `DROP`, no ownership, no superuser. A compromised or buggy
  API process can read and corrupt rows in these two schemas, but it cannot
  alter the schema, create extensions, or reach any other database on the
  same Postgres instance.


If you rotate `POSTGRES_API_PASSWORD` or add this role split to an existing
volume, `001-roles.sh` will **not** re-run (init scripts only run once) —
apply the equivalent `ALTER ROLE` / `GRANT` statements by hand via
`docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`.

## Backups

- **Data:** the entire durable state lives in the `postgres_data` named
  volume. Back it up with a routine `pg_dump`:

  ```sh
  docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
    | gzip > agentguard-$(date +%F).sql.gz
  ```

  Restore into a fresh volume with `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"`
  piped from the decompressed dump, then let `001-roles.sh` re-provision
  `agentguard_api` on that fresh volume's first boot (or re-run its GRANTs
  by hand if restoring into an already-initialized volume).
- **Secrets:** `deploy/.env` (never committed) and the Caddy
  `caddy_data`/`caddy_config` volumes (ACME account key + issued
  certificates — losing them just costs a re-issue, not data loss).
- Redacted findings/evidence never touch disk unredacted anywhere in this
  topology — redaction happens before egress from the scanned asset (see the
  main CLI's `redaction.ts`/`report.ts`), so the Postgres backup itself never
  needs separate secret-scrubbing.

## npm package name status

As of this work, the **unscoped** `agentguard` name is available on the npm
registry (the CLI currently publishes as `@pk42ac/agentguard`, per
`package.json`). This is noted here, not acted on: renaming a published
package is a breaking, user-facing change (new install command, new `npx`
invocation, redirect/deprecation period for the old scoped name) that
deserves its own deliberate decision and migration plan, not a side effect
of a self-hosting doc. Keep publishing as `@pk42ac/agentguard` until that
rename is explicitly planned and executed.
