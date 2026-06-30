# Rule surfaces

AgentGuard is intentionally small and deterministic. It focuses on risk surfaces that appear when AI coding agents interact with codebases, terminals, PRs, and MCP/Codex configuration.

## Secrets

AgentGuard detects common token shapes and redacts evidence before reporting. Current coverage includes OpenAI-style, Anthropic-style, GitHub-style, and Google API key-like tokens.

Example surfaces:

- `.env` files visible to an agent
- PR diffs that add credential-shaped values
- MCP config `env` blocks that pass credentials into tools

## PR diffs

`scan-diff` only scans added lines. This keeps review focused on newly introduced risk.

```bash
git diff origin/main...HEAD | agentguard scan-diff
```

Use `--sarif` to produce GitHub code-scanning output:

```bash
git diff origin/main...HEAD | agentguard scan-diff --sarif --out agentguard.sarif
```

## Agent logs and transcripts

`scan-log` detects risky commands or policy violations in agent transcripts.

```bash
agentguard scan-log --policy agent-policy.yaml < transcript.log
```

Useful for reviewing Codex, Claude Code, Hermes, MCP, or CI logs before merging agent-generated work.

## MCP/Codex config

`scan-mcp` checks structured and TOML-ish MCP/Codex config for:

- broad filesystem roots
- writable filesystem paths
- credential passthrough in environment variables
- sensitive integrations such as filesystem or GitHub
- approval-required tools defined by policy

```bash
agentguard scan-mcp < ~/.codex/config.toml
```

## Workspace scans

`scan-files` scans a repo/workspace for sensitive files and credential-shaped content:

```bash
agentguard scan-files .
```

By default, AgentGuard avoids printing full secrets. Reports are designed for safe PR comments and review artifacts.

## Non-goals for the MVP

- no dynamic sandboxing
- no runtime agent control
- no network calls
- no guarantee that every possible secret format is covered
- no replacement for full SAST/DAST/security review
