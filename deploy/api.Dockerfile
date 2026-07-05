# AgentGuard control-plane API image — self-host (plan §M5).
#
# Build from the REPO ROOT: docker build -f deploy/api.Dockerfile ..
# (docker-compose.yml's `api.build.context: ..` already does this.)
#
# control-plane's declared runtime dependency stays exactly {zod} (see
# control-plane/package.json / storage/port.ts's PgQueryable injection
# boundary) — no source file is touched by this image. `pg` (the real
# Postgres driver) and `tsx` (the TS runtime control-plane already uses via
# `npm start`) are installed here with `--no-save`, so package.json and
# package-lock.json are read but never modified. This is intentionally the
# ONLY place in the whole repo that installs `pg`: deploy/api-entrypoint.mjs
# is the one place a real `pg.Pool` gets constructed and injected into
# PostgresStorage's `PgQueryable` port.
FROM node:22-alpine

WORKDIR /app/control-plane

COPY control-plane/package.json control-plane/package-lock.json* ./
RUN npm ci --omit=dev \
 && npm install --no-save pg@^8.13.0 tsx@^4.23.0

COPY control-plane/tsconfig.json ./tsconfig.json
COPY control-plane/src ./src
COPY deploy/api-entrypoint.mjs ./entrypoint.mjs

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787

EXPOSE 8787

# node:22-alpine ships an unprivileged `node` user (uid 1000) out of the box.
USER node

# Runs deploy/api-entrypoint.mjs, NOT control-plane/src/main.ts: the
# entrypoint adds Postgres wiring (DATABASE_URL / MIGRATE_DATABASE_URL) on
# top of main.ts's sqlite-or-memory default. See that file for the full
# rationale. `npx tsx` matches control-plane's own `"start": "tsx src/main.ts"`
# convention — no build step, same runtime story as local dev.
CMD ["npx", "tsx", "entrypoint.mjs"]
