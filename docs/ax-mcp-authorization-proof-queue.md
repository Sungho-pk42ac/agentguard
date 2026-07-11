# AX MCP authorization proof queue

한국어 우선 카드입니다. 목적은 대상권 심사자가 묻는 "MCP/OAuth callback/session risk를 어떻게 승인 증거로 바꾸나?"에 대해 현재 AgentGuard가 가진 정적 evidence와 승인자 결정을 한 줄씩 연결하는 것입니다.

## Purpose

AgentGuard는 MCP server를 실행하거나 OAuth flow를 수행하지 않습니다. 이 카드는 runtime authorization 구현 설명이 아니라, MCP/OAuth callback/session risk 질문을 `scan-mcp`, `scan-log`, SARIF reviewer handoff 증거로 바꾸는 proof queue입니다.

대상권 답변의 핵심 문장:

- "state mismatch, trusted redirect URI, authorization boundary 같은 질문은 현재 scanner가 직접 검증한다고 말하지 않는다."
- "대신 MCP config, agent transcript/log, PR diff/SARIF artifact를 근거로 named owner review와 승인자 결정을 남긴다."
- "승인 증거는 `BLOCK` / `REVIEW` / `PASS` verdict values를 바꾸지 않고, 누가 어떤 residual risk를 보고 승인했는지까지 붙인다."

## Proof queue

| Reviewer question | AgentGuard evidence | Owner decision |
| --- | --- | --- |
| MCP server가 과도한 filesystem 권한으로 authorization boundary를 넘을 수 있나? | `scan-mcp` 결과에서 `mcp.broad_filesystem_access` 같은 rule IDs와 JSON finding을 확인한다. | Security owner가 `BLOCK`이면 rollout 중단, `REVIEW`이면 제한 scope와 named owner review를 요구한다. |
| OAuth callback/session 흐름에서 state mismatch나 trusted redirect URI 질문이 나오면 무엇을 보여주나? | AgentGuard가 state validation이나 redirect URI validation을 수행한다고 말하지 않고, `scan-log` evidence로 agent action, denied command, policy approval gap을 보여준다. | App owner가 runtime OAuth control은 별도 시스템의 책임으로 기록하고, AgentGuard finding은 approval log의 static preflight 증거로 붙인다. |
| reviewer가 GitHub code scanning으로 넘겨 달라고 하면 무엇을 전달하나? | SARIF artifact command로 PR diff evidence를 만든다. | Reviewer가 SARIF를 code scanning 또는 별도 review packet에 첨부할지 결정한다. AgentGuard는 upload/triage/approval workflow를 소유한다고 말하지 않는다. |

## Exact fixture-backed commands

MCP config proof:

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
```

Expected use: broad filesystem access와 credential-like environment passthrough를 `BLOCK` 또는 `REVIEW` evidence로 제시한다. Human text는 Korean-first 설명이다. `agentguard scan-mcp`, CLI commands, rule IDs, JSON, machine fields는 그대로 유지한다.

Transcript/log proof:

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

Expected use: denied command, risky shell behavior, approval policy gap을 `REVIEW` evidence로 제시한다. 이 증거는 OAuth session binding이나 authorization server validation을 대체하지 않는다.

SARIF reviewer artifact proof:

```bash
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

Expected use: reviewer handoff artifact로 SARIF를 만든다. GitHub upload는 선택적 handoff일 뿐이며 AgentGuard가 automatic upload, triage, approval을 수행한다고 말하지 않는다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| MCP Authorization spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | state mismatch, trusted redirect URI, authorization boundary, named owner review 질문을 승인 체크리스트 언어로 빌린다. | runtime OAuth, state validation, redirect URI validation, session binding, authorization server, consent UI를 AgentGuard 기능으로 주장하지 않는다. | `scan-mcp`와 `scan-log` evidence를 "static preflight + approver decision"으로 라우팅한다. |
| OWASP Agentic AI threats and mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent/tool risk, mitigation, human approval vocabulary를 빌린다. | full OWASP coverage나 external validation을 주장하지 않는다. | tool misuse 질문을 fixture-backed evidence command와 residual risk owner로 바꾼다. |
| GitHub SARIF upload: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF reviewer artifact handoff language를 빌린다. | automatic upload, GitHub workflow ownership, code scanning triage ownership을 주장하지 않는다. | SARIF command를 optional reviewer handoff로 문서화한다. |
| Snyk `agent-scan`: https://github.com/snyk/agent-scan | AI-agent/MCP scanner category language를 빌린다. | parity, vendor-scale coverage, adoption을 주장하지 않는다. | Korean-first local PR/MCP/transcript rollout evidence로 차별점을 둔다. |
| Tencent `AI-Infra-Guard`: https://github.com/Tencent/AI-Infra-Guard | public scanner ecosystem vocabulary를 빌린다. | broad red-team platform이나 customer proof를 주장하지 않는다. | current AgentGuard proof queue를 local CLI evidence와 승인자 결정에 고정한다. |

## Machine-contract boundaries

- `agentguard scan-mcp`, `agentguard scan-log`, `scan-diff`, CLI commands, rule IDs, verdict values, JSON, SARIF, API, and machine fields remain English-compatible.
- This card does not change scanner behavior, detector logic, severity, default verdicts, package metadata, or output schemas.
- Human explanation can be Korean-first, but machine contracts remain stable: `mcp.broad_filesystem_access`, `BLOCK`, `REVIEW`, `PASS`, JSON fields, and SARIF fields stay fixed.
- AgentGuard evidence is static rollout readiness evidence. Runtime OAuth authorization, state validation, redirect URI validation, consent UI, session binding, and authorization server duties stay outside AgentGuard.

## Non-claim guardrails

- No customer claim: synthetic fixtures only, no real adoption story.
- No external compliance mark claim: no standards badge, public-reference endorsement, or third-party audit story.
- No parity claim: do not present AgentGuard as equivalent to public scanners, code scanning products, OWASP guidance, or the MCP spec.
- No broad platform claim: do not describe AgentGuard as an all-purpose security suite or a hosted dashboard/SaaS/auth product.
- No runtime auth claim: AgentGuard does not run MCP servers, validate OAuth callback state, validate redirect URIs, bind sessions, operate an authorization server, or provide consent UI.
