# Changelog

All notable changes to AgentGuard will be documented here.

The format follows a lightweight keep-a-changelog style. This project is pre-1.0; breaking changes may occur between minor versions.

## [Unreleased]

## [0.3.0] - 2026-07-04

### Added

- Interactive tokscale-style admin dashboard: bare `agentguard` in a TTY (or `agentguard repl`) opens a full-screen, keyboard-navigated dashboard with 5 tabs (Overview/Agents/Credentials/Posture/Offboard), a findings-by-surface bar chart, and a PASS/REVIEW/BLOCK verdict badge. Replaces the earlier slash-command REPL; non-interactive subcommands stay unchanged.
- Findings views: severity-colored lists with ↑↓ navigation, an `f` severity filter, and an `enter` detail panel; a bottom keybind/status bar shows finding/critical counts and last-scan time. Agents tab surfaces installed AI-agent inventory for onboarding inspection.
- `/offboard` guided sweep: scope selection → residual scan (5 detection surfaces × 3 OS) → review → approval gate → recoverable cleanup → zod-validated audit report (JSON + Markdown).
- New detectors: shell rc key detector (`.bashrc`/`.zshrc`/PowerShell `$PROFILE`) and npm global AI CLI inventory.
- Baseline snapshots + diff under `~/.agentguard/` (appeared/disappeared), with opt-in `--track-rotation` value-fingerprint rotation detection. Default snapshots store zero secret material.
- Approval-gated cleanup actions: no file is modified/deleted without explicit approval; deletions move to `~/.agentguard/trash/<timestamp>/` (recoverable), with cross-volume (EXDEV) and locked-file (EBUSY) handling.
- Public zod contracts (`schemaVersion`) for audit reports and baselines.

### Removed

- **BREAKING:** removed `agentguard serve` and the local HTTP/browser preview (`src/server.ts`, `/api/scan`, `/healthz`). AgentGuard is a local offline CLI/TUI; there is no HTTP surface. All non-interactive subcommands and their exit codes are unchanged.

### Changed

- New runtime dependencies limited to `ink` (+ `react`) for the interactive session; no AI/LLM SDK (the AI shell is deferred to v0.4.0).
- `tsconfig` builds `.tsx` via `react-jsx`.
- Demo asset and README/examples updated from the serve preview to the interactive session.

## [0.2.0] - 2026-07-03

### Added

- Public docs for GitHub Actions, policy files, rule surfaces, and examples.
- Community files for contributions, security reporting, issue templates, and PR review.
- Safe synthetic examples for risky MCP config, PR diffs, and agent transcripts.
- Package metadata hardened for first npm publish (`engines`, `author`, `prepublishOnly`, postbuild `chmod` for bin executability).
- Tag-triggered npm release workflow with provenance, plus `docs/release-process.md`.
- Claude Desktop MCP config detection in posture scan.
- Cursor MCP config detection in posture scan.

### Fixed

- Scan finding paths and npm spawns normalized on Windows.

### Changed

- Tests split into behavior and doc-assertion groups (`test:behavior` / `test:docs`).
- CI now runs on both ubuntu and windows.

## [0.1.0] - Initial MVP

### Added

- TypeScript CLI with `scan-files`, `scan-diff`, `scan-log`, `scan-mcp`, and `report` commands.
- Markdown, JSON, and SARIF output.
- Policy loading for YAML/JSON policy files.
- Secret-shaped token detection and redacted evidence.
- MCP/Codex config risk detection.
- GitHub Action workflow examples.
