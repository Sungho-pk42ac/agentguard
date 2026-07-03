# Release process

AgentGuard ships to npm via a tag-triggered GitHub Actions workflow (`.github/workflows/release.yml`) that publishes with [npm provenance](https://docs.npmjs.com/generating-provenance-statements).

## Tag flow

1. Bump `version` in `package.json` and merge that change to `main`.
2. Tag the merged commit and push the tag:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. The push triggers `release.yml`, which runs `npm ci` -> `typecheck` -> `test:behavior` -> `build`, checks that the tag matches `package.json` version (version guard), then publishes with `npm publish --provenance --access public`.

The version guard strips the leading `v` from `GITHUB_REF_NAME` before comparing to `package.json`'s `version` field (`vX.Y.Z` vs `X.Y.Z`). A mismatched tag fails the workflow before anything is published.

## Token setup

Publishing needs an npm access token stored as the repository secret **`NPM_TOKEN`** (Settings -> Secrets and variables -> Actions).

Create the token as either:

- a classic **"Automation"** token, or
- a granular access token scoped to **"All packages" (read and write)**.

`agentguard` does not exist on npm yet, so a granular token cannot be scoped to this package specifically -- it won't appear in the package picker until after the first publish. After the first successful publish, the token can be narrowed to just this package, or replaced entirely by OIDC trusted publishing (see below).

## workflow_dispatch rehearsal

`release.yml` also accepts manual `workflow_dispatch` runs. A dispatch run executes the full pipeline (install, typecheck, tests, build) and the version guard step prints the version that *would* be published, but the publish step is guarded by `if: startsWith(github.ref, 'refs/tags/v')` and is skipped. Use this to rehearse the release pipeline before pushing a real tag.

## OIDC / trusted publishing migration

npm supports [trusted publishing](https://docs.npmjs.com/trusted-publishers) via OIDC, which removes the need for a long-lived `NPM_TOKEN` secret. This requires the package to already exist on npm, so it isn't available for the first release. After `agentguard`'s first publish, configure trusted publishing for this repository and workflow, then remove the `NPM_TOKEN` secret and the `NODE_AUTH_TOKEN` env from `release.yml`.
