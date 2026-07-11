# AX critical alert routing card

한국어 우선 운영 카드로 AgentGuard `BLOCK`/`REVIEW` evidence를 alert owner, approval owner, reviewer channel, rollout stop condition에 연결한다.
CLI commands, rule IDs, JSON, SARIF, and machine fields stay English-compatible.

## 사용 목적

AX Rollout Guard에서 PR diff, MCP config, agent transcript/log evidence가 나오면 팀은 "누가 멈추고, 누가 승인하고, 어떤 artifact를 reviewer queue에 붙이는가"를 바로 정해야 한다. 이 카드는 현재 AgentGuard fixture-backed command만 사용해 `BLOCK`, `REVIEW`, `PASS` verdict를 팀 alert/approval routing queue로 옮기는 최소 계약이다.

AgentGuard는 Slack/Teams 전달, hosted dashboard, runtime OAuth, consent UI, token authorization, runtime monitoring, customer data processing, or product rename을 약속하지 않는다. 현재 범위는 local CLI evidence와 SARIF/Markdown artifact를 사람이 읽는 approval queue에 넘기는 것이다.

## Critical alert routing queue

| Evidence source | Alert owner | Approval owner | Reviewer channel | Rollout stop condition |
|---|---|---|---|---|
| PR diff에 secret-like assignment 또는 위험한 shell 변경이 보인다. | release owner | security reviewer + business owner | Markdown report, PR artifact, optional SARIF | `BLOCK`이면 rollout을 멈추고 secret/risky command 제거 후 같은 `scan-diff` evidence를 다시 붙인다. |
| MCP config가 broad filesystem root, writable path, credential passthrough를 노출한다. | platform owner | permission owner | MCP permission review queue | `BLOCK`이면 permission owner가 filesystem root, write access, token passthrough를 줄이기 전까지 rollout을 stop한다. `REVIEW`는 승인 조건과 expiry를 남긴다. |
| transcript/log에 승인 없는 export, 삭제성 shell, 대량 작업 흔적이 남는다. | local operator | business decision owner | transcript/log reviewer handoff | `REVIEW`이면 승인 조건 또는 rollback decision을 남기고 같은 `scan-log` evidence를 재실행한다. |
| SARIF artifact가 PR reviewer에게 전달된다. | release owner | code reviewer + security reviewer | SARIF artifact in reviewer channel | SARIF는 reviewer channel 중 하나다. `BLOCK` finding이 남아 있으면 merge/rollout gate를 진행하지 않는다. |

## Evidence command contract

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한다. 아래 명령은 Bash/Zsh 기준 stdin redirection 예시이며, npm/global 설치 후에는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

| Queue input | Exact AgentGuard command | Team routing result |
|---|---|---|
| PR diff evidence | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK` 또는 `REVIEW` finding을 release owner가 PR reviewer queue에 붙인다. |
| MCP permission evidence | `node dist/index.js scan-mcp < examples/risky-mcp.json` | MCP `BLOCK`은 permission owner에게 route한다. broad tool/filesystem access는 least privilege 질문으로 축소한다. |
| Transcript/log evidence | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | 승인 필요 작업은 business decision owner가 `REVIEW` approval memo 또는 rollback decision으로 처리한다. |
| SARIF reviewer artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/critical-alerts/agentguard.sarif < examples/risky-pr.diff` | SARIF artifact is one reviewer channel. GitHub code scanning workflow에 업로드할 수 있는 handoff file로 보존한다. |

Required synthetic fixtures: `examples/risky-pr.diff`, `examples/risky-mcp.json`, `examples/agent-policy.yaml`, `examples/agent-transcript.log`.

## Approval owner stop conditions

- `BLOCK`: rollout을 멈춘다. alert owner는 source artifact, exact command, exit result, reviewer channel을 남기고 approval owner가 수정 또는 rollback을 결정한다.
- `REVIEW`: rollout을 자동 진행하지 않는다. approval owner가 residual risk, 승인 조건, expiry/rerun trigger를 문장으로 남긴 뒤 다음 gate를 결정한다.
- `PASS`: 현재 evidence 기준으로 차단 finding이 없거나 줄어든 상태다. 다음 gate로 진행하되 source artifact와 command를 보존한다.

Approval owner가 확인하는 질문은 세 가지다.

1. 이 finding이 agent/tool misuse, secret exposure, broad permission, unsafe shell action 중 어디에 해당하는가?
2. alert owner와 approval owner가 분리되어 있는가, 아니면 같은 사람이 self-approval하고 있는가?
3. 같은 source artifact에서 어떤 command가 rerun evidence를 만든다는 것을 보장하는가?

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent/tool misuse, human oversight, and stop-condition framing. | Do not claim OWASP endorsement or external assurance. | Add alert owner and rollout stop condition for `BLOCK`/`REVIEW` findings. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, user consent, token/tool authorization boundary. | Do not claim AgentGuard performs runtime OAuth, consent UI, token issuance, or server-side authorization checks. | Route MCP `BLOCK` evidence to the permission owner with least-privilege remediation questions. |
| GitHub SARIF upload — https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file | SARIF/security alert artifact handoff into a reviewer workflow. | Do not claim GitHub workflow ownership or native account integration. | Treat `.agentguard-demo/critical-alerts/agentguard.sarif` as one reviewer channel beside Markdown/terminal evidence. |
| Snyk `agent-scan` — https://github.com/snyk/agent-scan | AI-generated code and agent workflow scanner category language. | Do not claim feature equality or scanner scope equality. | Differentiate AgentGuard as PR diff + MCP config + transcript/log evidence routing for Korean-first rollout approval. |

## Machine-contract boundaries

- `scan-diff`, `scan-mcp`, `scan-log` stay English-compatible.
- CLI commands, rule IDs, JSON, SARIF, and machine fields stay unchanged.
- Representative rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`.
- `PASS`, `REVIEW`, `BLOCK` stay machine-facing verdict vocabulary. Korean prose may explain them, but does not rename them.

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished, or buyer-reference claim.
- No external audit badge, standards badge, or formal assurance claim.
- No statement that AgentGuard owns Slack/Teams delivery, webhook delivery, hosted alert delivery, dashboard workflow, account auth flow, runtime monitoring, or attack simulation.
- No statement that AgentGuard has the same platform scope as GitHub code scanning, Snyk `agent-scan`, OWASP guidance, MCP authorization, SAST, or a broad AI security suite.
- No product rename and no change to CLI commands, rule IDs, JSON, SARIF, API, or machine fields.
