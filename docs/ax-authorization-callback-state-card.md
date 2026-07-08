# AX authorization callback state card

한국어 우선 운영 카드로 unknown company의 agent authorization callback/state 리스크를 현재 AgentGuard CLI evidence와 정직한 승인 질문에 연결한다. CLI commands, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## Company problem

회사 문제: 사내 AX agent가 MCP server, GitHub, filesystem, 내부 승인 도구를 연결한 뒤 OAuth authorization callback을 통해 도구 권한을 받는다. 심사자와 rollout approver는 "callback/state 검증은 런타임에서 해야 한다"는 경계와 "지금 이 config/log evidence만으로도 rollout을 막거나 검토로 넘길 신호가 있는가"를 한 장에서 구분해야 한다.

이 카드는 runtime OAuth 기능을 새로 주장하지 않고, 기존 synthetic fixture인 `examples/risky-mcp.json`, `examples/agent-policy.yaml`, `examples/agent-transcript.log`만 사용한다. 목적은 authorization callback 자체를 스캔했다는 말이 아니라, callback 승인 전에 사람에게 보여줄 정적 evidence와 승인 질문을 고정하는 것이다.

## Authorization callback risk

Authorization callback risk: state mismatch, untrusted redirect URI, authorization server precaution 부재는 OAuth callback에서 권한을 다른 세션이나 도구 흐름에 붙일 수 있는 위험이다. agent가 넓은 MCP filesystem root, writable access, token passthrough를 가진 상태라면 callback 뒤에 생긴 credential 권한이 과도한 tool surface와 결합될 수 있다.

AgentGuard의 현재 범위는 authorization server, runtime authorization, session binding, state validation, trusted redirect URI validation이 아니다. 현재 slice는 배포 전 정적 evidence로 `BLOCK`/`REVIEW` 신호를 만들고, human approver가 callback 연결 전에 권한 축소와 residual risk 수용 여부를 묻게 하는 것이다.

## AgentGuard evidence command

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 빌드된 CLI로 같은 fixture를 재현한다.

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
```

Expected evidence: `BLOCK` 또는 `REVIEW` for `mcp.broad_filesystem_access`, writable filesystem exposure, and credential-like environment passthrough. 이 결과는 authorization callback 전에 MCP tool 권한을 줄이거나 token passthrough를 제거해야 한다는 reviewer evidence다.

Agent transcript/log 쪽에서는 같은 agent rollout의 위험 행동을 기존 policy로 확인한다.

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

Expected evidence: `REVIEW` for denied command evidence such as `git push --force` or `rm -rf`, plus policy-gated transcript behavior. 이 evidence는 callback/state 리스크를 직접 검증하지 않고, agent가 승인 뒤 실행할 수 있는 동작을 사람이 검토해야 한다는 승인 맥락을 만든다.

## Expected verdict

Expected verdict: `BLOCK` when `mcp.broad_filesystem_access` or credential-like passthrough exposes broad tool authority before callback approval. `REVIEW` when transcript evidence shows denied command behavior such as `git push --force`, `rm -rf`, or another denied command that needs owner approval before rollout.

`PASS`는 MCP root가 좁아지고 token passthrough가 제거되었으며 transcript/log policy findings가 정리된 뒤 재스캔해서 판단한다. 이 카드는 severity/default policy를 바꾸지 않는다.

## Approval question

승인 질문: "이 agent가 OAuth authorization callback 이후에도 같은 MCP server로 넓은 filesystem root, writable access, token passthrough, denied shell behavior를 사용할 필요가 있는가, 그리고 state mismatch 또는 redirect URI 오용이 발생했을 때 누가 rollout을 중지할 것인가?"

승인자가 `아니오`라고 답하면 MCP root를 좁히고 token env 전달을 제거한 뒤 실제 대상 config/log로 `agentguard scan-mcp`와 `agentguard scan-log`를 다시 실행한다. `예`라고 답하면 residual risk, owner, rollback condition, callback/state runtime validation owner를 approval record에 남긴다.

## Public reference borrow/avoid notes

| Public reference | Borrow | Avoid |
|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic tool misuse, excessive agency, secret exposure vocabulary for explaining why callback approval needs human rollout questions. | Do not claim OWASP endorsement, full threat coverage, or external assurance. |
| MCP Authorization spec — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | state mismatch, trusted redirect URI, authorization server precautions, and the boundary between callback validation and rollout approval evidence. | Do not claim AgentGuard performs runtime OAuth, authorization server duties, session binding, state validation, redirect URI validation, or full MCP spec coverage. |
| GitHub code scanning — https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning | reviewer-facing artifact routing: finding, evidence, owner, remediation, and approval loop language. | Do not claim GitHub native app parity, replacement, hosted scanning, or product-equivalent behavior. |

## Machine contract guardrails

- No scanner detector, CLI behavior, product name, rule IDs, JSON, SARIF, API, or severity/default policy change.
- CLI commands stay English-compatible: `agentguard scan-mcp`, `agentguard scan-log`, `agentguard scan-diff`, `agentguard doctor`.
- rule IDs stay English-compatible, including `mcp.broad_filesystem_access`.
- Synthetic fixtures only: `examples/risky-mcp.json`, `examples/agent-policy.yaml`, `examples/agent-transcript.log`.
- No OAuth implementation, runtime auth/session change, authorization callback validation, redirect URI validation, or package metadata/release change.
- No customer logo, buyer name, finished rollout, formal audit badge, public trust badge, or adoption claim.
