# AgentGuard Risk Report

**Verdict:** BLOCK
**Risk score:** 14
**Findings:** 4

| Severity | Category | File | Finding | Evidence |
|---|---|---|---|---|
| critical | secret | diff | OpenAI-style API key | `sk-p…0000` |
| critical | secret | diff | Anthropic API key | `sk-a…0000` |
| high | dangerous-command | diff | Denied command pattern: rm -rf | `rm -rf` |
| high | mcp-risk | diff | MCP server receives credential-like environment variables | `credential env` |

## Recommendations
- **OpenAI-style API key:** Remove the secret, rotate it, and load it from a secret manager or environment variable.
- **Anthropic API key:** Remove the secret, rotate it, and load it from a secret manager or environment variable.
- **Denied command pattern: rm -rf:** Require human approval or replace with a safer scoped command.
- **MCP server receives credential-like environment variables:** Use least-privilege tokens, avoid write scopes, and rotate credentials after agent sessions.
