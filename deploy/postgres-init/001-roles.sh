#!/bin/sh
# AgentGuard self-host — least-privilege Postgres role split (plan §M5).
#
# Runs ONCE, automatically, the first time the `postgres` container starts
# against an empty data volume (docker-entrypoint-initdb.d convention — it is
# skipped on every subsequent restart, including after `docker compose down`
# without removing the `postgres_data` volume). It runs as $POSTGRES_USER
# (the owner/superuser role from deploy/.env), which is also the ONLY role
# schema DDL ever runs as (see deploy/api-entrypoint.mjs's one-time
# PostgresStorage#migrate() step over MIGRATE_DATABASE_URL).
#
# PostgresStorage#migrate() (control-plane/src/storage/postgres.ts) creates
# TWO schemas, not `public`:
#   - `auth`     — orgs/users/invites/sessions/login_failures/device_auths/
#                  enrollment_codes/oidc_grants.
#   - `findings` — assets/findings/alerts/ingest_events/policies/
#                  policy_exceptions/offboarding_tasks/mcp_catalog/
#                  org_settings/cve_cache.
#
# `agentguard_api` is the role the API actually connects as for every request
# (DATABASE_URL, composed in docker-compose.yml). It gets DML rights only —
# no CREATE, no DROP, no ownership — on those two schemas of this one
# database, including on tables the migration step creates AFTER this script
# runs (ALTER DEFAULT PRIVILEGES). A compromised/buggy API process can read
# and corrupt rows but cannot alter the schema, create extensions, or touch
# any other database.
#
# If you add Postgres volumes/roles to an EXISTING deployment (schema already
# migrated, or POSTGRES_API_PASSWORD rotated), this script will NOT re-run —
# apply the equivalent SQL manually via `docker compose exec postgres psql`.
set -eu

: "${POSTGRES_API_PASSWORD:?POSTGRES_API_PASSWORD must be set (see deploy/.env.example)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'agentguard_api') THEN
	    CREATE ROLE agentguard_api LOGIN PASSWORD '${POSTGRES_API_PASSWORD}';
	  ELSE
	    ALTER ROLE agentguard_api LOGIN PASSWORD '${POSTGRES_API_PASSWORD}';
	  END IF;
	END
	\$\$;

	GRANT CONNECT ON DATABASE "${POSTGRES_DB}" TO agentguard_api;

	-- PostgresStorage#migrate() creates these schemas if they don't exist yet
	-- (idempotent CREATE SCHEMA IF NOT EXISTS), so it is safe to reference
	-- them here even on a completely empty volume: migrate() always runs
	-- (as the owner role) before the api process ever connects as
	-- agentguard_api.
	CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION "${POSTGRES_USER}";
	CREATE SCHEMA IF NOT EXISTS findings AUTHORIZATION "${POSTGRES_USER}";

	GRANT USAGE ON SCHEMA auth, findings TO agentguard_api;

	-- Covers tables/sequences PostgresStorage#migrate() creates AFTER this
	-- script runs (it always runs as the owner role, $POSTGRES_USER).
	ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA auth
	  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agentguard_api;
	ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA auth
	  GRANT USAGE, SELECT ON SEQUENCES TO agentguard_api;
	ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA findings
	  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agentguard_api;
	ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA findings
	  GRANT USAGE, SELECT ON SEQUENCES TO agentguard_api;

	-- Belt-and-suspenders for tables that already existed at init time
	-- (e.g. a volume carried over from a manual migration).
	GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO agentguard_api;
	GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO agentguard_api;
	GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA findings TO agentguard_api;
	GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA findings TO agentguard_api;
SQL
