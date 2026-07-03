# AX boardroom go/no-go brief

한국어 우선 boardroom approval brief입니다. 목적은 AgentGuard의 기존 fixture-backed evidence를 대상권 발표와 임원/보안 승인자가 바로 읽을 수 있는 `go/no-go` 문장으로 바꾸는 것입니다.

범위는 현재 저장소의 합성 fixture와 이미 구현된 CLI surface입니다. CLI/rule/JSON/SARIF machine contract unchanged: command name, rule ID, verdict vocabulary, JSON/SARIF field를 발표용으로 바꾸지 않습니다.

## 대상권 boardroom use

AX Rollout Guard 발표나 회사 rollout review에서 "이 agent workflow를 운영에 연결해도 되는가?"를 묻는 순간에 씁니다. 심사자나 승인자는 scanner row보다 다음 네 가지를 먼저 봅니다.

| Boardroom question | Evidence answer |
|---|---|
| 무엇이 위험한가? | PR diff, MCP config, transcript/log에서 나온 `BLOCK`, `REVIEW`, `PASS` evidence |
| 사업 승인 조건은 무엇인가? | blocker 제거, 조건부 제한 rollout, 또는 go 후보 |
| 누가 잔여 위험을 소유하는가? | residual risk owner와 재실행 command |
| 무엇을 주장하지 않는가? | 운영 telemetry, 실제 token scope, SaaS permission, external assurance |

## Decision map: BLOCK / conditional REVIEW / PASS

| Verdict | Business approval condition | Boardroom wording | Residual risk |
|---|---|---|---|
| `BLOCK` | 운영 배포 no-go. secret, full-access, destructive action 같은 blocker를 제거하고 같은 surface에서 재검사하기 전까지 rollout을 진행하지 않는다. | "현재 evidence 기준 no-go입니다. blocker 제거 후 재검토합니다." | diff/config/log 밖 runtime telemetry와 실제 token scope는 별도 owner 확인이 필요하다. |
| `conditional REVIEW` | 조건부 제한 rollout만 검토한다. owner 승인, mitigation, rollback 조건, approval log를 남기고 같은 command를 다시 실행한다. | "조건부 제한 rollout 후보입니다. 승인 조건과 rollback owner를 닫기 전에는 권한을 넓히지 않습니다." | SaaS permission, 누락된 audit log, transcript 밖 tool call은 residual risk owner가 확인한다. |
| `PASS` | go 후보. 같은 fixture-backed surface에서 finding이 없거나 허용 범위로 정리되었고, 남은 운영 위험은 승인 memo에 분리되어 있다. | "현재 evidence 기준 제한 rollout go 후보입니다." | AgentGuard는 현재 fixture-backed evidence만 본다. production account, runtime telemetry, token scope는 별도 운영 evidence가 필요하다. |

## Fixture-backed commands

저장소 루트에서 실행합니다. fresh clone이면 먼저 `npm ci && npm run build`로 `dist/` artifact를 만듭니다.

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
```

Fixture paths:

- `examples/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/agent-policy.yaml`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`

Reading guide:

- `examples/risky-mcp.json` is the fast `BLOCK`-style boardroom stop example when broad filesystem access appears.
- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` and `agent-transcript.log` are `conditional REVIEW` examples for company-problem discussion, mitigation, and owner approval.
- `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` is the `PASS` candidate example after the MCP scope is narrowed.

## Residual risk register

| Risk left after AgentGuard evidence | Owner prompt | Boardroom action |
|---|---|---|
| runtime telemetry not present in the transcript | "운영 로그에서 같은 action이 실제로 발생했는가?" | telemetry owner가 별도 evidence를 붙인다. |
| token scope not visible in diff/config | "이 credential이 읽기 전용, 최소 권한, 만료 조건을 갖는가?" | secret owner가 scope와 rotation evidence를 남긴다. |
| SaaS permission outside MCP config | "연결된 SaaS account가 export/delete/admin 권한을 갖는가?" | app owner가 permission snapshot을 확인한다. |
| approval log outside the fixture | "사람 승인 ticket 또는 change record가 있는가?" | rollout owner가 approval log와 rollback owner를 memo에 적는다. |

## Public reference framing

| Reference | Borrow | Avoid | Boardroom use |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | threat -> mitigation -> residual risk framing for agent/tool risk | external assurance, standards mark, or parity claim | finding을 "위협, 완화, 남은 위험" 세 줄로 낮춰 쓴다. |
| MCP Security Best Practices: https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | least privilege, consent/authorization, token handling, human-in-the-loop wording | MCP semantics change or AgentGuard-as-MCP-governance claim | broad access와 credential passthrough를 approval condition으로 연결한다. |
| Tencent AI-Infra-Guard: https://github.com/Tencent/AI-Infra-Guard | multi-surface AI infrastructure and MCP scanning category clarity | broad AI-infra suite or enterprise rollout proof | AgentGuard 범위를 PR diff, MCP config, transcript/log evidence로 좁혀 말한다. |
| splx-ai Agentic Radar: https://github.com/splx-ai/agentic-radar | agentic workflow and MCP security assessment category language | broad adversarial assessment suite or runtime monitoring claim | boardroom brief의 residual risk 칸에 "아직 보지 못한 surface"를 남긴다. |

## Honesty guardrails

- 이 brief는 합성 fixture-backed executive/security approval narrative입니다.
- 외부 reference는 vocabulary와 framing의 근거이지 AgentGuard 결과 보증이 아닙니다.
- hosted SaaS, auth, dashboard, billing, runtime monitoring, account upload workflow를 주장하지 않습니다.
- 대상권 발표에서는 "현재 CLI surface로 확인 가능한 rollout evidence"만 말합니다.
- machine-facing strings는 그대로 둡니다: `node dist/index.js scan-diff`, `scan-mcp`, `scan-log`, `BLOCK`, `REVIEW`, `PASS`, rule IDs, JSON/SARIF fields.
