# AX reviewer non-response fallback card

한국어 우선 AX Rollout Guard 운영 카드다. 목표는 AgentGuard의 `PASS` / `REVIEW` / `BLOCK` 또는 reviewer non-response 상태를 사람이 읽는 fallback 절차로 고정하는 것이다. 이 문서는 현재 fixture-backed evidence와 reviewer handoff를 설명하며, CLI, rule IDs, JSON, SARIF machine fields는 영어 호환 계약으로 유지한다.

## 판정/무응답 fallback matrix

| Status | Owner / 담당자 | Timeout / timebox | Fallback artifact / 대체 산출물 | Exact rerun command / 재실행 명령 | Residual risk decision / 잔여 리스크 결정 |
| --- | --- | --- | --- | --- | --- |
| `PASS` | pilot owner가 현재 fixture 기준 release candidate 기록을 소유하고, evidence owner가 commit/SHA와 command receipt를 남긴다. | 다음 rollout checkpoint 전, 또는 24시간 freshness check 전까지 확인한다. | Markdown report와 `.agentguard-demo/reviewer-nonresponse.sarif` 경로를 optional reviewer handoff artifact로 기록한다. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | 현재 fixture에서 새 차단 finding이 없다는 의미로만 기록한다. 잔여 리스크는 production account, token scope, runtime telemetry owner가 별도 확인한다. vendor parity나 customer adoption 증거로 승격하지 않는다. |
| `REVIEW` | security owner가 human oversight 판단을 소유하고, business owner가 제한 rollout 또는 보류 조건을 소유한다. | 30분 안에 reviewer 지정, same business day 안에 approve / limit / defer 중 하나를 기록한다. | Reviewer memo, Markdown report, log-check stdout/stderr receipt, 필요 시 `.agentguard-demo/reviewer-nonresponse.sarif`. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | reviewer가 허용 조건, 만료 시각, rollback owner를 쓰면 제한 rollout 가능하다. 응답이 없으면 reviewer non-response row로 이동한다. |
| `BLOCK` | security owner와 business owner가 rollout stop을 공동 소유하고, remediation owner가 fix/policy condition을 소유한다. | 즉시 stop, 15분 안에 owner 지정, 2시간 안에 fix/policy condition 초안 작성. | PR diff Markdown report, MCP permission report, `.agentguard-demo/reviewer-nonresponse.sarif` SARIF artifact path, remediation note. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | 차단 finding이 남아 있으면 residual risk를 accept하지 않는다. secret-like diff 제거, MCP permission 축소, policy 보완 뒤 same command로 rerun한다. |
| reviewer non-response | escalation owner가 reviewer timeout을 소유하고, security backup reviewer가 residual risk decision을 소유한다. | `REVIEW`는 same business day 종료 30분 전, `BLOCK`은 2시간 timeout 직후, `PASS` freshness는 24시간 timeout 후 escalates. | `reviewer-nonresponse.md` memo, command stdout/stderr receipt, `.agentguard-demo/reviewer-nonresponse.sarif`, and unresolved reviewer question list. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` plus the original trigger command from the `PASS` / `REVIEW` / `BLOCK` row. | 응답 없음은 승인으로 취급하지 않는다. backup reviewer가 approve / limit / block / defer 중 하나를 명시하기 전까지 rollout은 제한 또는 보류 상태다. |

## Fixture-backed evidence commands

이 카드는 새 scanner behavior를 만들지 않는다. 아래 명령은 현재 synthetic fixtures를 다시 실행해 reviewer handoff에 붙일 evidence를 만든다.

| Evidence surface | Command | Existing fixture path | Reviewer handoff use |
| --- | --- | --- | --- |
| PR diff reviewer fallback | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `REVIEW` 또는 `BLOCK` discussion에서 exact diff evidence를 다시 붙인다. |
| MCP authorization boundary posture | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP config 권한 경계, filesystem scope, writable path review를 owner에게 보낸다. |
| Transcript/log policy check | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | approval-required action, denied action, human oversight memo를 reviewer에게 넘긴다. |
| SARIF reviewer handoff artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/reviewer-nonresponse.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/reviewer-nonresponse.sarif`를 CI/PR artifact note에 남긴다. 자동 업로드나 자동 승인으로 해석하지 않는다. |

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | human oversight, mitigation, control, residual-risk language. | OWASP endorsement, full coverage, certification, or complete agentic security claim. | `REVIEW`와 reviewer non-response를 사람 검토와 residual risk decision으로 남긴다. |
| MCP Authorization spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | authorization boundary, resource/audience state, trusted redirect vocabulary. | runtime OAuth, session consent, token validation, or MCP authorization enforcement claim. | MCP fixture evidence를 static reviewer handoff로만 기록하고 runtime enforcement라고 말하지 않는다. |
| GitHub SARIF support: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF artifact, result, location, reviewer handoff vocabulary. | native GitHub product claim, automatic GitHub upload, automatic triage, or automatic approval. | `.agentguard-demo/reviewer-nonresponse.sarif` path를 artifact receipt로 적고 upload 여부는 CI/release owner 결정으로 남긴다. |
| Snyk `agent-scan`: https://github.com/snyk/agent-scan | agent/MCP scanner category clarity and MCP server/skills scan vocabulary. | parity, replacement, certification, adoption, or benchmark superiority claim. | AgentGuard examples stay fixture-backed and explain the specific PR/MCP/transcript surfaces covered here. |
| Tencent `AI-Infra-Guard`: https://github.com/Tencent/AI-Infra-Guard | agent scanner, MCP scanner, AI infra scanner category language. | full-stack red-team platform parity or replacement claim. | Use the category language only to help reviewers place this small fallback card in the public scanner ecosystem. |
| splx-ai `agentic-radar`: https://github.com/splx-ai/agentic-radar | agentic workflow scanner and report handoff vocabulary. | framework coverage, runtime testing parity, or product adoption claim. | Keep the fallback card scoped to current AgentGuard fixture commands and reviewer memo outputs. |

## Non-claim guardrails

- No runtime OAuth/MCP enforcement: this card is static evidence routing for current fixtures, not an authorization server, OAuth session validator, token audience validator, or MCP consent runtime.
- No automatic GitHub upload/approval: SARIF and Markdown paths are reviewer handoff artifacts; GitHub upload, alert triage, PR approval, and merge gating remain outside this card.
- No vendor parity/certification/adoption claims: the public references provide vocabulary only. They do not certify AgentGuard, prove replacement coverage, or imply customer adoption.
- No CLI/rule/JSON/SARIF machine contract changes: commands, rule IDs, JSON fields, SARIF fields, exit codes, and scanner behavior stay unchanged.
- Synthetic fixtures remain synthetic and fixture-backed: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.

## Machine-contract boundaries

- Human-facing Korean copy may explain `PASS`, `REVIEW`, `BLOCK`, reviewer non-response, owner, timeout, fallback artifact, rerun command, and residual risk decision.
- Machine-facing contracts remain English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`, rule IDs, JSON, SARIF, `ruleId`, `result`, `location`, and `artifact`.
- This card does not add scanner rules, severity thresholds, default blocking policy, SaaS/dashboard/auth behavior, real customer data, or new fixture data.
