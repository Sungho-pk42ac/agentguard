# AX CI reviewer handoff

한국어 우선 reviewer handoff입니다. 목적은 회사 문제를 먼저 말하고, 현재 AgentGuard CLI output이 CI, PR comment, SARIF evidence로 어떻게 전달되어 승인 판단에 쓰이는지 30초 안에 보여주는 것입니다. 이 문서는 product behavior를 바꾸지 않고, 저장소 fixture와 기존 CLI command만 사용합니다.

## 회사 문제에서 승인 artifact까지

| 회사 문제 | AgentGuard surface | CI/reviewer artifact | approval decision |
|---|---|---|---|
| PR diff에 agent-visible secret-like 값이나 risky shell material이 들어오면 출시 전에 멈춰야 한다. | `agentguard scan-diff` / `node dist/index.js scan-diff < examples/risky-pr.diff` | Markdown report, PR comment, SARIF result location과 rule fingerprint | `secret.github_token` finding이 있으면 `BLOCK`; 제거 후 같은 surface에서 `PASS` evidence를 확인한다. |
| MCP config가 broad filesystem root, writable path, credential passthrough를 열면 에이전트 권한이 회사 자료 범위를 넘을 수 있다. | `agentguard scan-mcp` / `node dist/index.js scan-mcp < examples/risky-mcp.json` | MCP config evidence row, rollout approval note, SARIF/Markdown artifact | `mcp.broad_filesystem_access`가 남아 있으면 `BLOCK`; root 축소와 read-only 조건 확인 후 `PASS` 후보로 둔다. |
| transcript/log에 승인 없는 export, 민감 경로 접근, 삭제성 명령이 보이면 사람 승인 조건이 필요하다. | `agentguard scan-log` / `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Policy-backed Markdown report와 PR reviewer checklist | reviewer가 approval-required action을 확인하고, 정책상 허용된 범위에서만 제한 rollout을 승인한다. |

## Fixture-backed commands

아래 명령은 현재 저장소 fixture에만 의존합니다. 발표나 CI reviewer handoff 전에 `npm run build`를 먼저 실행한 뒤 그대로 복사해 사용합니다. `<` stdin redirection은 POSIX shell/Git Bash/WSL 기준입니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

Referenced fixture paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`

Machine-facing contracts stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `secret.github_token`, `mcp.broad_filesystem_access`, `SARIF`, `BLOCK`, `PASS`.

## Public reference mapping

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://hackathon.jocodingax.ai/ | 기업 실제 문제에서 출발하고, 결과 artifact로 설득하는 result-first framing | gated portal scoring, submission mechanics, final company-problem claim | reviewer handoff 첫 줄을 "회사 문제 -> evidence artifact -> approval decision"으로 둔다. |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, mitigation vocabulary | external validation or scope guarantee | AgentGuard finding을 `scan-diff`, `scan-log`, `scan-mcp` evidence row에 연결한다. |
| https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices | MCP permission, token passthrough, confused deputy/SSRF-style framing | MCP-wide validation claim | MCP config를 rollout approval surface로 설명하고 broad filesystem access를 approval blocker로 둔다. |
| https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | SARIF rule, result, location, fingerprint concepts | same-scope product claim | Markdown, PR comment, SARIF artifacts가 reviewer에게 같은 finding evidence를 전달한다고 설명한다. |
| https://github.com/snyk/agent-scan | AI agent, MCP, skill scanning category language | vendor-scale parity or market proof | AgentGuard 범위를 PR diff, MCP config, transcript evidence로 좁혀 말한다. |

## Non-claims

- 실제 고객 데이터, 외부 운영 사용 근거, 운영 채택 근거를 주장하지 않습니다.
- 외부 보안 framework나 vendor가 AgentGuard를 보증했다고 말하지 않습니다.
- broad scanner parity, SaaS dashboard, auth, runtime monitoring 범위를 주장하지 않습니다.
- CLI command, rule ID, JSON/SARIF field 이름을 한국어로 바꾸지 않습니다.
