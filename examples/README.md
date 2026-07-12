# AgentGuard examples

이 디렉터리는 AgentGuard 문서와 테스트에서 재사용하는 synthetic fixtures를 보관합니다. 실제 고객 자료나 운영 secrets를 넣지 마세요.

## Evidence operations cards

- [AX evidence retention policy card](../docs/ax-evidence-retention-policy.md)
- [AX critical alert routing card](../docs/ax-critical-alert-routing-card.md)
- [AX public signal-to-proof queue](../docs/ax-public-signal-to-proof-queue.md)
- [AX agent action custody route](../docs/ax-agent-action-custody-route.md)
- [AX MCP authorization proof queue](../docs/ax-mcp-authorization-proof-queue.md)
- [AX AI judge evidence manifest](../docs/ax-ai-judge-evidence-manifest.md)
- [AX finding lifecycle approval card](../docs/ax-finding-lifecycle-approval-card.md)
- [AX agent skill inventory evidence card](../docs/ax-agent-skill-inventory-evidence-card.md)
- [AX data egress approval route](../docs/ax-data-egress-approval-route.md)
- [AX env custody approval route](../docs/ax-env-custody-approval-route.md)

## Core fixtures

- `risky-pr.diff` — PR diff scanner demo input.
- `risky-mcp.json` — MCP config scanner demo input.
- `agent-transcript.log` — agent transcript/log scanner demo input.
- `agent-policy.yaml` — demo policy for command approval and transcript scans.
- `agentguard.sarif` — sample SARIF handoff artifact.
