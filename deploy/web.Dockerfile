# AgentGuard web console image — self-host (plan §M5).
#
# Build from the REPO ROOT: docker build -f deploy/web.Dockerfile ..
# (docker-compose.yml's `web.build.context: ..` already does this.)
#
# web/ is a pure static export (web/next.config.mjs: `output: 'export'`) with
# NO Next.js server runtime, session store, or API pass-through in
# production — every /v1/* call goes same-origin to the control-plane API
# behind the shared reverse proxy (deploy/Caddyfile). This image therefore
# only ever needs to serve prebuilt static files: a Node build stage produces
# web/out/, and the runtime stage is a bare caddy:2-alpine `file_server` —
# no Node process, no extra attack surface, in the serving container.
FROM node:22-alpine AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/web/out /srv
COPY deploy/web.Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
