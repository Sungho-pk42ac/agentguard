# AX MCP consent/token handoff card

한국어 우선 운영 카드로 회사의 MCP rollout 질문을 사용자 동의(consent), token passthrough, confused deputy 위험과 AgentGuard의 static MCP config evidence command에 연결한다. CLI commands, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## Company problem

회사 문제: 상담, 채용, VOC, 운영 자동화 agent가 MCP server를 통해 repo, filesystem, GitHub, 내부 도구에 접근한다. 배포 승인자는 agent가 무엇을 읽고, 어떤 token을 도구에 넘기며, 어떤 evidence를 보고 사람 승인으로 넘길지 한 장에서 판단해야 한다.

이 카드는 AgentGuard가 현재 제공하는 정적 MCP config evidence를 approval handoff로 좁힌다. 실제 고객 데이터나 운영 credential을 쓰지 않고 `examples/risky-mcp.json` fixture만 사용한다.

## MCP risk

MCP risk: broad filesystem access, writable root, credential-like environment passthrough가 함께 있으면 agent/tool 경계가 흐려진다. 사용자가 의도하지 않은 도구 호출이 token passthrough와 결합되면 confused deputy 흐름이나 agentic tool misuse로 이어질 수 있다.

AgentGuard의 현재 범위는 런타임 consent UI나 OAuth/session control이 아니라, 배포 전 MCP config에서 사람 검토가 필요한 신호를 분리하는 것이다. human approver는 evidence를 보고 권한 축소, token 전달 제거, 예외 승인, rollout 중지를 결정한다.

## AgentGuard evidence command

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 빌드된 CLI로 같은 fixture를 재현한다.

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
```

npm/global 설치 환경에서 승인자에게 보여줄 exact AgentGuard command는 다음과 같다.

```bash
agentguard scan-mcp < examples/risky-mcp.json
```

Fixture: `examples/risky-mcp.json`.

## Static execution-safety boundary

정적 preflight 경계: `scan-mcp`는 MCP config text를 evidence로 읽고 rule finding을 만든다. AgentGuard는 이 카드의 흐름에서 MCP server를 실행하지 않는다. untrusted MCP server command, package install, OAuth/session handoff, tool call replay, network login은 이 evidence command의 범위 밖이다.

이 경계의 대상권 positioning은 "배포 전에 위험한 MCP 설정 텍스트를 사람 승인 queue로 올리는 control"이다. static no MCP server execution evidence로 broad filesystem root, writable path, credential-like environment passthrough를 먼저 걸러내고, 남는 residual risk는 human approver가 권한 축소, sandbox/consent 요구, 예외 승인, rollout 중지를 결정한다.

## Expected verdict

Expected verdict: `BLOCK` or `REVIEW` for broad filesystem access, writable filesystem exposure, and credential-like environment passthrough. 대표 rule ID는 `mcp.broad_filesystem_access`이며, terminal/Markdown evidence는 승인자가 읽을 수 있는 한국어 우선 설명을 붙인다.

`PASS`는 같은 workflow에서 broad root와 credential passthrough가 제거되었거나 정책 예외가 문서화된 뒤 재스캔해 판단한다. 이 카드는 severity/default policy를 바꾸지 않는다.

## Approval question

승인 질문: "이 agent가 이 MCP server를 통해 `/` 또는 넓은 filesystem root를 읽거나 쓸 필요가 있고, `GITHUB_TOKEN` 같은 token passthrough를 도구에 넘겨도 되는가?"

승인자가 `아니오`라고 답하면 권한 root를 좁히고 token env 전달을 제거한 뒤 다시 `agentguard scan-mcp < examples/risky-mcp.json` 형태의 실제 대상 config 스캔을 실행한다. `예`라고 답하면 residual risk와 owner를 approval record에 남긴다.

## Public reference borrow/avoid notes

| Public reference | Borrow | Avoid |
|---|---|---|
| MCP security best practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | user consent, token passthrough, confused deputy, SSRF/tool-boundary language for why MCP config needs explicit review. | Do not claim AgentGuard enforces runtime authorization, OAuth/session control, consent UI, or complete MCP risk handling. |
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, mitigation/control vocabulary for explaining why human approval is needed. | Do not claim OWASP endorsement, complete threat coverage, or external assurance. |
| Snyk `agent-scan` — https://github.com/snyk/agent-scan | explicit warning pattern that some MCP scanners may execute MCP server commands and need consent/sandboxing. | Do not claim AgentGuard launches MCP servers at runtime or provides Snyk enterprise parity. |
| Tencent `AI-Infra-Guard` — https://github.com/Tencent/AI-Infra-Guard | broad AI infra, MCP, and agent-skill inventory framing for why MCP rollout evidence belongs in the approval packet. | Do not claim end-to-end AI security platform scope or Tencent feature parity. |
| GitHub SARIF upload — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | reviewer-facing artifact handoff language: finding, evidence, owner, and remediation/approval loop. | Do not claim GitHub native app parity, replacement, or hosted code-scanning product behavior. |

## Machine contract guardrails

- No scanner rule, CLI behavior, JSON, SARIF, API, or severity/default policy change.
- CLI commands stay `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-files`, `agentguard doctor`.
- rule IDs stay English-compatible, including `mcp.broad_filesystem_access`.
- Synthetic fixture only: `examples/risky-mcp.json`.
- No customer logo, buyer name, finished rollout, formal audit badge, or public trust badge claim.
