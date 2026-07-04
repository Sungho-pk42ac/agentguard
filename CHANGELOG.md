# Changelog

All notable changes to AgentGuard will be documented here.

The format follows a lightweight keep-a-changelog style. This project is pre-1.0; breaking changes may occur between minor versions.

## [Unreleased]

### Added

- **Control plane (Fleet · Observe, Phase 1).** A hybrid-SaaS evolution: each developer PC and CI reports redacted findings to a central control plane, and a security team sees org-wide risk on one screen. Raw secrets and file bodies NEVER leave the reporting machine — only redacted metadata (rule ID, surface, severity, home/username-stripped location, redacted evidence, fingerprint) is transmitted.
- **Report agent — `agentguard report --push`.** Opt-in flag on the scan commands that redacts, signs, and POSTs findings to a control plane (`--endpoint`, `--org`, `--asset`). Uses only Node built-ins + zod (no new runtime dependencies). A client redaction guard fails closed BEFORE any network call if a raw-secret pattern is present. Without `--push`, all commands behave byte-identically. Hybrid enrollment: CI via OIDC id-token, developer PC via a device token (`~/.agentguard/enrollment.json`).
- **`control-plane/` package.** A standalone Node service: ingest API (`POST /v1/enroll`, `POST /v1/reports`) with signature + 300s freshness verification and an INDEPENDENT server-side redaction re-check (shape + entropy, 422 on violation, nothing persisted); multi-tenant, org-scoped storage over a `StoragePort` with `node:sqlite` and in-memory adapters (Postgres documented for production); a `TokenVerifier` (device-token HMAC + OIDC) and `NotifierPort` (Slack/Teams webhook + recording double); org-scoped aggregation (`/v1/dashboard/summary`, `/v1/dashboard/trend`, `/v1/assets`, `/v1/findings`); a server-rendered HTML dashboard; and critical-finding alerts deduped by (org, fingerprint). Shipped with 36 tests (contract parity, redaction invariant + adversarial, signature valid/tampered/stale, tenant isolation, alert dedup, storage parity, 3-asset E2E). Not included in the published CLI package.
- Shared wire contract (`src/contract/report-payload.ts`): a single canonical zod schema imported by both the report agent and the control plane so the redaction/egress shape cannot drift; `buildFingerprint` and `stripUserPath` (home/username stripping) helpers.

## [0.3.0] - 2026-07-04

### Added

- Interactive tokscale-style admin dashboard: bare `agentguard` in a TTY (or `agentguard repl`) opens a full-screen, keyboard-navigated dashboard with 6 tabs (Overview/Agents/Credentials/Posture/Baseline/Offboard), a findings-by-surface bar chart, and a PASS/REVIEW/BLOCK verdict badge. Replaces the earlier slash-command REPL; non-interactive subcommands stay unchanged.
- Findings views: severity-colored lists with ↑↓ navigation, an `f` severity filter, and an `enter` detail panel; a bottom keybind/status bar shows finding/critical counts and last-scan time. Agents tab surfaces installed AI-agent inventory for onboarding inspection; the Baseline tab snapshots the current scan (`[s]`) and shows drift (appeared/disappeared/rotated) against `~/.agentguard/baselines`.
- `/offboard` guided sweep: scope selection → residual scan (5 detection surfaces × 3 OS) → review → approval gate → recoverable cleanup → zod-validated audit report (JSON + Markdown).
- New detectors: shell rc key detector (`.bashrc`/`.zshrc`/PowerShell `$PROFILE`) and npm global AI CLI inventory.
- Baseline snapshots + diff under `~/.agentguard/` (appeared/disappeared), with opt-in `--track-rotation` value-fingerprint rotation detection. Default snapshots store zero secret material.
- Approval-gated cleanup actions: no file is modified/deleted without explicit approval; deletions move to `~/.agentguard/trash/<timestamp>/` (recoverable), with cross-volume (EXDEV) and locked-file (EBUSY) handling.
- Public zod contracts (`schemaVersion`) for audit reports and baselines.
- Dashboard interactivity controls: `?` full keybind overlay; `/` live search (surface/path/evidence); `g` severity sort; `i` session-hide (display-only — writes no file, leaves verdict/aggregate unchanged); `1`/`2`/`3` scan presets (Quick/Project/Full, Quick default) with live per-surface progress and a Full-scan confirmation; `w` 30s auto-rescan; consistent ↑↓/`enter` across list tabs; a first-run welcome line and a "깨끗함 ✓" empty-state; finding detail now shows the full path plus a severity rationale and category remediation guidance; basic mouse support (wheel scroll, tab click); a colored ASCII banner on the loading screen.
- CLI file-path input (additive): `scan-diff`/`scan-log`/`scan-mcp`/`report` accept an optional file path (e.g. `agentguard scan-mcp config.toml`) in addition to stdin, so shells without `<` redirection (PowerShell) work. stdin-first — piped output/exit/JSON/SARIF stay byte-identical; the path is read only when stdin is a TTY; a missing file exits 2. `--help` is Korean-first with PowerShell examples.

### Removed

- **BREAKING:** removed `agentguard serve` and the local HTTP/browser preview (`src/server.ts`, `/api/scan`, `/healthz`). AgentGuard is a local offline CLI/TUI; there is no HTTP surface. All non-interactive subcommands and their exit codes are unchanged.

### Changed

- New runtime dependencies limited to `ink` (+ `react`) for the interactive session; no AI/LLM SDK (the AI shell is deferred to v0.4.0).
- `tsconfig` builds `.tsx` via `react-jsx`.
- Demo asset and README/examples updated from the serve preview to the interactive session.

### Fixed

- Dashboard scan no longer freezes the terminal: the global npm CLI inventory runs via non-blocking `spawn`, and the loading view shows an animated spinner with an elapsed-seconds counter so an in-progress scan is visibly alive.
- Launching the dashboard from a broad directory (home, a drive root) no longer triggers an enormous filesystem walk: landing-view project-file scanning is limited to real project roots (a `.git`/`package.json`/`pyproject.toml`/… marker present) and never the home directory. Explicit `scan-files` and the guided offboard scope are unchanged.
- Terminal window/tab title is now set to `agentguard` (previously showed a transient "npm ls" while the global npm inventory scan ran).
- Resolved a Node `DEP0190` deprecation warning by invoking the npm inventory with a static command string instead of an args array under `shell: true`.

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
