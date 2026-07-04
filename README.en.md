# AgentGuard

[한국어](README.md)

[![npm](https://img.shields.io/npm/v/%40pk42ac%2Fagentguard)](https://www.npmjs.com/package/@pk42ac/agentguard)
![CI](https://github.com/Sungho-pk42ac/agentguard/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)
![Tests](https://img.shields.io/badge/tests-465%20passing-brightgreen)
![SARIF](https://img.shields.io/badge/SARIF-supported-purple)
![License](https://img.shields.io/github/license/Sungho-pk42ac/agentguard)

Licensed under the [Apache License 2.0](LICENSE).

**Security scanner for AI coding agents, MCP configs, transcripts, and PR diffs.**

AgentGuard helps teams catch leaked secrets, dangerous MCP permissions, unsafe agent shell behavior, and risky PR diffs before they reach production.

As of v0.3.0, AgentGuard delivers **AI coding agent lifecycle security** as a local workflow — an **onboarding inspection** of the AI tools and permissions installed on a new hire's machine, an **offboarding sweep** that finds residual credentials on a departing employee's machine and deletes them only after explicit approval (with an audit report), and an **admin-only local terminal dashboard** (`agentguard`) to run it all. It works offline on the target machine, with no web or central server.

<p align="center">
  <img src="docs/agentguard-terminal-demo.svg" alt="AgentGuard dashboard terminal screenshot showing the 5-tab keyboard navigation and findings exploration" width="920" />
</p>

## Install

```bash
npm install -g @pk42ac/agentguard
```

## Quick start

```bash
# Scan a repo/workspace (default Markdown report is Korean)
agentguard scan-files .

# Check local package/examples/scanner readiness
agentguard doctor

# Check local Claude/Codex/Gemini/MCP agent permission posture
agentguard posture .

# Emit English Markdown reports when needed
agentguard scan-files . --lang en

# Scan a PR diff
git diff origin/main...HEAD | agentguard scan-diff

# Emit SARIF for GitHub code scanning
git diff origin/main...HEAD | agentguard scan-diff --sarif --out agentguard.sarif

# Scan Codex/MCP config
agentguard scan-mcp < ~/.codex/config.toml

# Interactive dashboard (TTY): 5-tab keyboard navigation + /offboard sweep
agentguard        # or: agentguard repl
```

Run bare `agentguard` (or `agentguard repl`) in a TTY to open a tokscale-style full-screen admin dashboard. Switch the 5 top tabs (Overview/Agents/Credentials/Posture/Offboard) with `tab`/`←→`, and browse the severity-colored findings list with `↑↓`, `f` to filter by severity, and `enter` for the detail panel. Overview shows a findings-by-surface bar chart and a `PASS/REVIEW/BLOCK` verdict badge; the bottom keybind/status bar exposes `[o]` offboarding sweep, `[r]` rescan, and `[q]` quit. In non-TTY contexts (pipes/CI) the usual help text is printed, preserving script backward compatibility. Every cleanup (delete) action applies only after explicit approval (y), and deleted targets are moved to `~/.agentguard/trash` (a recoverable backup) rather than hard-deleted.

## Why

AI agents now connect to codebases, terminals, GitHub, databases, Slack, Drive, and internal tools. Existing SAST tools inspect application code, but they rarely answer:

> “What did the agent read, run, expose, or try to change?”

AgentGuard focuses on **agent behavior risk**: secrets in agent-visible files, risky tool permissions, dangerous shell patterns, and PR changes that deserve human security review.

## What AgentGuard checks

| Surface | Examples |
|---|---|
| Secrets | OpenAI/Anthropic/GitHub/Google-style tokens, credential-shaped environment values |
| Agent logs | risky shell commands, sensitive paths, unsafe operations visible in transcripts |
| PR diffs | newly-added secrets, PII, dangerous commands, agent policy violations |
| MCP/Codex config | broad filesystem roots, writable paths, credential passthrough, full-access servers |
| Policy files | YAML/JSON policy aliases, malformed policy documents, unsafe duplicates |
| Shell rc keys | API keys / credential-named vars exported in `.bashrc`/`.zshrc`/PowerShell `$PROFILE` |
| npm global AI CLIs | globally installed AI coding CLIs (Claude Code/Codex/Gemini/…) as onboarding/offboarding signals |
| AI tool config | residual credentials in `~/.claude`/`~/.codex`, Claude Desktop/Cursor MCP config |

## Example finding

```text
BLOCK  secret.github_token
Found a GitHub token in an agent-visible diff. Evidence is redacted before reporting.

REVIEW  mcp.broad_filesystem_access
MCP configuration exposes a broad filesystem root with write-capable access.
```

Verdicts:

- `PASS`: no findings
- `REVIEW`: non-critical findings, human review recommended
- `BLOCK`: high aggregate risk or critical secret/full-access finding

## Documentation

- [GitHub Actions / SARIF setup](docs/github-action.md)
- [Policy files](docs/policy.md)
- [Rule surfaces](docs/rules.md)
- [Examples](docs/examples.md)
- [AX live demo runbook](docs/ax-live-demo-runbook.md)
- [AX before/after rollout demo](docs/ax-before-after-rollout-demo.md)
- [AX judge evidence index (Korean)](docs/ax-judge-evidence-index.md)
- [AX submission readiness scorecard (Korean)](docs/ax-submission-readiness-scorecard.md)
- [Roadmap](docs/roadmap.md)
- [Development harness](docs/harness-workflow.md)

## Examples

- [`examples/risky-mcp.json`](examples/risky-mcp.json) — risky MCP filesystem config
- [`examples/risky-pr.diff`](examples/risky-pr.diff) — PR diff with fake secret-like material
- [`examples/agent-transcript.log`](examples/agent-transcript.log) — agent transcript with risky shell behavior
- [`examples/expected-report.md`](examples/expected-report.md) — sample markdown report
- [`examples/agentguard.sarif`](examples/agentguard.sarif) — sample SARIF payload

## GitHub code scanning workflow

Copy this workflow into `.github/workflows/agentguard-sarif.yml` to scan pull request diffs, write `agentguard.sarif`, and upload the result to GitHub code scanning. The `scan-diff --sarif --out agentguard.sarif` command matches the implemented CLI flags.

```yaml
name: AgentGuard code scanning
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  security-events: write

jobs:
  agentguard-sarif:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Emit AgentGuard SARIF
        run: |
          git diff --unified=0 ${{ github.event.pull_request.base.sha }}...${{ github.event.pull_request.head.sha }} \
            | node dist/index.js scan-diff --sarif --out agentguard.sarif || true

      - name: Upload AgentGuard SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: agentguard.sarif
```

## GitHub PR comment workflow

Copy this workflow into `.github/workflows/agentguard-pr.yml` to scan pull request diffs, persist the markdown report as an artifact, and post the same report as a PR comment. Critical findings fail the check; review-level findings keep the check green for human review.

```yaml
name: AgentGuard PR scan
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  agentguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Run AgentGuard on PR diff
        id: agentguard
        uses: ./.github/actions/agentguard
        with:
          base-sha: ${{ github.event.pull_request.base.sha }}
          head-sha: ${{ github.event.pull_request.head.sha }}
          report-path: agent-risk-report.md

      - name: Upload AgentGuard report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: agentguard-pr-report
          path: agent-risk-report.md

      - name: Comment AgentGuard report on PR
        if: ${{ !cancelled() }}
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body-path: agent-risk-report.md
```

## Local development

```bash
npm install
npm test
npm run typecheck
npm run build

# Example report
node dist/index.js scan-diff --out agent-risk-report.md < examples/risky-pr.diff
```

## Release checklist

Before publishing, verify the npm package contains only the built CLI and intended metadata/assets:

```bash
npm run build
npm pack --dry-run
```

The dry run should list `dist/`, `README.md`, `package.json`, and examples, without `src/` or `test/` files.

- Run `npm test`
- Run `npm run typecheck`
- Run `npm run build`
- Run `npm pack --dry-run`
- Install the packed tarball in a temporary project and run `npx agentguard scan-log`
- Publish with `npm publish --provenance --access public`

See [docs/release-process.md](docs/release-process.md) for the tag-triggered provenance release workflow and token setup.

## MVP scope

This first version is intentionally small:

- deterministic regex/rule scanner
- markdown/JSON report
- SARIF 2.1.0 output for GitHub code scanning
- no external network calls
- no secrets are printed in full

## Roadmap

- MCP permission graph
- dashboard for agent audit trails
