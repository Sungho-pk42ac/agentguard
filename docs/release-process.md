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

## Trusted publishing (OIDC)

`@pk42ac/agentguard` exists on npm as of the `0.2.0` publish. Publishing now authenticates via npm's [trusted publishing](https://docs.npmjs.com/trusted-publishers) OIDC flow instead of a long-lived access token -- `release.yml` no longer stores or reads any npm auth secret.

The npm package has a Trusted Publisher configured with these exact values:

- Provider: GitHub Actions
- Organization or user: `Sungho-pk42ac`
- Repository: `agentguard`
- Workflow filename: `release.yml`
- Environment: (none)

`release.yml` requests the `id-token: write` permission and, right before publishing, runs `npm install -g npm@latest` -- OIDC trusted publishing requires npm >= 11.5, and GitHub's Node 22 runners currently bundle npm 10.x, so the CLI must be updated in-job or the publish step cannot mint an OIDC token.

## workflow_dispatch rehearsal

`release.yml` also accepts manual `workflow_dispatch` runs. A dispatch run executes the full pipeline (install, typecheck, tests, build) and the version guard step prints the version that *would* be published, but the publish step is guarded by `if: startsWith(github.ref, 'refs/tags/v')` and is skipped. Use this to rehearse the release pipeline before pushing a real tag.
