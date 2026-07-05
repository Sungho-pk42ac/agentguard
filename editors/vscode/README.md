# AgentGuard for VS Code

Runs the [AgentGuard](https://github.com/Sungho-pk42ac/agentguard) security scanner
against your workspace and surfaces its findings as native VS Code diagnostics
(red/yellow squiggles and entries in the **Problems** panel).

## Requirements

This extension shells out to the `agentguard` CLI — it does **not** bundle it.
Install the CLI first and make sure it is on your `PATH`:

```sh
npm install -g @pk42ac/agentguard
agentguard --version
```

## Usage

Open a workspace folder, then run the command **"AgentGuard: Scan Workspace"**
from the Command Palette (`agentguard.scan`). The extension runs
`agentguard scan-files --json` in each workspace folder, parses the JSON
findings, and publishes them as diagnostics grouped by file:

- `critical` / `high` severity → Error squiggle
- `medium` severity → Warning squiggle
- `low` severity → Information squiggle

A message is shown if the CLI is not found on `PATH`, and a warning banner
appears when any `critical` finding is detected.

## Building the VSIX

This package has no runtime dependencies — it only needs the `vscode` engine
host API (ambient types via `@types/vscode`) and the AgentGuard CLI installed
separately by the user.

```sh
cd editors/vscode
npm install
npm run build          # compiles src/ -> dist/ via tsc
npx vsce package       # produces agentguard-vscode-<version>.vsix
```

Install the generated `.vsix` via the VS Code "Extensions: Install from VSIX..."
command, or `code --install-extension agentguard-vscode-<version>.vsix`.

## Development

- `src/diagnostics.ts` is pure (no `vscode` import) and unit-tested with
  `node:test` via `tsx`, independent of a running VS Code instance:

  ```sh
  npm test
  ```

- `src/extension.ts` is the only file that imports `vscode`; it wires the
  `agentguard.scan` command to a `DiagnosticCollection` and delegates all
  finding-to-diagnostic mapping logic to `diagnostics.ts`.
