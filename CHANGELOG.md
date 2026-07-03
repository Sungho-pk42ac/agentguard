# Changelog

All notable changes to AgentGuard will be documented here.

The format follows a lightweight keep-a-changelog style. This project is pre-1.0; breaking changes may occur between minor versions.

## [Unreleased]

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
