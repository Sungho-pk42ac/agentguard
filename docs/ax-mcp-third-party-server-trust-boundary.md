# AX MCP third-party server trust boundary card

한국어 우선 승인 카드로 외부 MCP server를 rollout 전에 허용할지 판단하는 회사 문제, third-party MCP server risk, AgentGuard evidence commands, approval condition을 한 장에 묶는다. CLI commands, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## Company problem

회사 문제: 엔터프라이즈 팀이 Codex, Claude Desktop, Cursor, 내부 agent에 외부 MCP server를 붙이려 할 때 보안/플랫폼 owner는 30초 안에 "이 server/tool을 운영 rollout에 연결해도 되는가?"를 판단해야 한다.

이 판단에는 server 이름보다 trust boundary가 중요하다. untrusted MCP server command가 어떤 package/binary를 실행하는지, 어떤 filesystem root를 읽거나 쓸 수 있는지, 어떤 env credential을 넘기는지, 그리고 human approver가 어떤 go/no-go evidence를 볼지가 먼저 정리되어야 한다.

## Third-party MCP server risk

Third-party MCP server risk: 외부 MCP server가 broad filesystem root, writable path, credential-like environment passthrough를 동시에 요구하면 agent/tool 경계가 흐려진다. `examples/risky-mcp.json` fixture는 `/` root, `--write`, `GITHUB_TOKEN` 형태의 env 전달을 사용해 이 위험을 합성 입력으로 보여준다.

이 card의 질문은 "MCP server가 유명한가?"가 아니라 "이 agent가 이 command, root, env boundary를 갖고도 least privilege 조건을 만족하는가?"이다. `BLOCK` 또는 `REVIEW` finding이 있으면 server/tool owner가 root 축소, read-only 전환, token passthrough 제거, sandbox/consent 조건, 또는 rollout 보류를 선택한다.

## AgentGuard evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 저장소 루트에서 아래 exact commands를 실행한다. Markdown artifact는 사람 reviewer가 읽고, SARIF artifact는 configured workflow 또는 evidence archive가 보존할 수 있는 reviewer handoff artifact다.

```bash
node dist/index.js scan-mcp --out .agentguard-demo/mcp-third-party-server-trust-boundary.md < examples/risky-mcp.json
```

```bash
node dist/index.js scan-mcp --sarif --out .agentguard-demo/mcp-third-party-server-trust-boundary.sarif < examples/risky-mcp.json
```

npm/global 설치 환경에서 같은 surface를 보여줄 때는 다음 command를 사용한다.

```bash
agentguard scan-mcp < examples/risky-mcp.json
```

Fixture: `examples/risky-mcp.json`. 대표 current rule IDs: `mcp-filesystem-wide-root`, `mcp-env-token`. Expected signal: broad filesystem root, writable path, credential-like environment passthrough가 남아 있으면 `BLOCK` 또는 `REVIEW`.

## Approval condition

Approval condition: human approver는 Markdown/SARIF evidence를 보고 다음 문장 중 하나를 남긴다.

| Evidence signal | Go/no-go condition |
|---|---|
| `BLOCK` for broad root, write-capable path, or credential-like env passthrough | 운영 rollout 보류. MCP owner가 root를 업무 fixture path로 좁히고, write access와 token passthrough를 제거한 뒤 같은 command로 재스캔한다. |
| `REVIEW` for residual permission risk | security owner와 business owner가 owner, scope, expiry, compensating control을 적은 뒤 제한 rollout 여부를 결정한다. |
| `PASS` after least-privilege rerun | 현재 입력 기준 차단 finding이 없다는 뜻이다. 외부 server 자체의 안전 보증이 아니라 point-in-time 정적 preflight evidence다. |

승인 질문: "이 외부 MCP server command가 이 root와 env boundary를 가져야만 업무 목적을 달성하는가, 그리고 남은 위험을 사람이 명시적으로 수락했는가?"

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, excessive agency, human control/mitigation vocabulary. | Do not claim OWASP endorsement, whole threat handling, or external assurance. | Frame risky MCP permission evidence as stop, reduce, approve-with-owner, or rerun language before rollout. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | confused deputy, token passthrough, least privilege, explicit user consent, server/tool trust boundary language. | Do not claim this evidence flow supplies runtime OAuth, per-client consent storage, session binding, or live server behavior. | Ask static preflight questions about untrusted MCP server command, filesystem root, writable access, and env credential boundaries. |
| GitHub SARIF upload — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | reviewer handoff artifact, SARIF file preservation, configured workflow owner, code review evidence vocabulary. | Do not claim SARIF upload, GitHub approval, or code-scanning alert routing happens without repository owner configuration. | Produce `scan-mcp --sarif --out ...` evidence that a reviewer-owned workflow or archive can preserve. |

## Current scope and non-claims

- Current scope is static preflight evidence from MCP config text.
- AgentGuard does not execute MCP servers in this evidence flow.
- AgentGuard does not install third-party MCP packages, replay tool calls, log in to remote services, or perform network execution of server commands.
- Runtime OAuth, runtime authorization, session control, consent UI, and MCP protocol assurance are outside this static card.
- AgentGuard does not provide OWASP endorsement, GitHub product parity, customer adoption proof, formal audit badge, or external assurance.
- SARIF/Markdown artifacts are handoff inputs. Repository owners must configure their own upload, archive, review, and exception workflow.

## Machine contract preservation

- No scanner logic, CLI behavior, JSON, SARIF, API, rule IDs, or severity/default policy changes are part of this card.
- CLI commands stay `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`, `agentguard scan-files`, and `agentguard doctor`.
- Local verification commands stay `node dist/index.js scan-mcp ...` for fresh-clone evidence.
- rule IDs stay English-compatible, including `mcp-filesystem-wide-root` and `mcp-env-token`.
- Synthetic fixture only: `examples/risky-mcp.json`.
- Human-facing explanation may be Korean-first; machine fields and artifact contracts remain English-compatible.
