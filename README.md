# AgentGuard

AgentGuard is an **AgentOps security scanner** for teams adopting Codex, Claude Code, Hermes, MCP servers, and other AI coding agents.

It scans:

- PR diffs for secrets/PII/dangerous commands
- agent transcripts and shell logs
- MCP/Codex configuration for high-risk tool access
- workspaces for sensitive files that agents must not read

## Why

AI agents now connect to codebases, terminals, GitHub, databases, Slack, Drive, and internal tools. Existing SAST tools inspect code, but they rarely answer:

> “What did the agent read, run, or expose?”

AgentGuard focuses on **agent behavior risk**.

## Quick start

```bash
npm install
npm run build

# Scan a repo/workspace
node dist/index.js scan-files .

# Scan a PR diff
git diff origin/main...HEAD | node dist/index.js scan-diff

# Emit SARIF for GitHub code scanning
git diff origin/main...HEAD | node dist/index.js scan-diff --sarif --out agentguard.sarif

# Scan Codex/MCP config
node dist/index.js scan-mcp < ~/.codex/config.toml
```

## Example report

```bash
agentguard scan-diff --out agent-risk-report.md < pr.diff
```

Verdicts:

- `PASS`: no findings
- `REVIEW`: non-critical findings, human review recommended
- `BLOCK`: high aggregate risk or critical secret/full-access finding

## MVP scope

This first version is intentionally small:

- deterministic regex/rule scanner
- markdown/JSON report
- SARIF 2.1.0 output for GitHub code scanning
- no external network calls
- no secrets are printed in full

## Development harness

AgentGuard is maintained through a small-slice agentic workflow: one issue, one branch, one PR, and executable verification for every change. See [`docs/harness-workflow.md`](docs/harness-workflow.md) before starting new work.

## Roadmap

- GitHub Action PR comment
- Codex/Hermes transcript adapters
- MCP permission graph
- policy-as-code (`agent-policy.yaml`)
- dashboard for agent audit trails
