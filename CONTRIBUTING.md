# Contributing to AgentGuard

Thanks for considering a contribution. AgentGuard is intentionally small: prefer narrow, reviewable changes with executable evidence.

## Development setup

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Contribution style

- Keep changes focused: one issue, one branch, one PR.
- Do not add real secrets, tokens, private logs, or customer data to tests or examples.
- Prefer deterministic scanners and fixtures over network calls.
- Keep README concise; put detailed guides in `docs/`.
- Add or update tests for scanner behavior, CLI behavior, policy parsing, or docs contracts.

## Before opening a PR

Run and paste real output for:

```bash
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

## Good first contribution areas

- Add safe examples for new agent config formats.
- Improve docs for GitHub Actions and policies.
- Add detectors for additional MCP/Codex/agent configuration shapes.
- Improve SARIF metadata and rule descriptions.
