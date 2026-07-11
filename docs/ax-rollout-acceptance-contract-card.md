# AX rollout acceptance contract card

Korean-first acceptance evidence card입니다. 목적은 처음 보는 `unknown company problem`을 AgentGuard가 이미 가진 PR diff, MCP config, agent transcript/log 증거로 바꿔서 승인자가 "지금 승인할 만큼 재실행 가능한가?"를 판단하게 하는 것입니다.

## 사용 목적

- 대상: AX Rollout Guard 현장 심사자, 보안 승인자, 운영자.
- 쓰임: 회사 문제를 받은 뒤 acceptance contract를 채우고, 같은 fixture-backed command를 다시 돌려 `PASS` / `REVIEW` / `BLOCK` 판단과 잔여 위험을 기록합니다.
- 경계: 이 카드는 정적 사전 승인 증거입니다. AgentGuard가 라이브 권한 집행, 외부 보안 제품 역할, 상용 운영 사례를 제공한다고 말하지 않습니다.

## Acceptance-contract matrix

| 승인 질문 | Evidence surface | Required artifact | Approval owner | Residual risk sentence |
|---|---|---|---|---|
| PR 변경이 secret/PII/shell 위험을 만들었나? | PR diff | Markdown report or JSON with `REVIEW` / `BLOCK` finding | 서비스 owner + security reviewer | 수정 전에는 위험 변경을 승인하지 않습니다. |
| MCP 도구 권한이 문제 해결 범위를 넘었나? | MCP config | Markdown report or JSON with broad tool/path finding | security reviewer | 허용 서버와 경로가 좁혀질 때까지 잔여 위험이 남습니다. |
| agent 실행 로그가 정책상 승인 작업을 포함하나? | agent transcript/log | Policy-backed Markdown report | 운영 owner | 정책 예외가 명시되지 않으면 재실행 후 승인합니다. |
| 승인자가 손으로 재검토할 산출물이 남았나? | expected approval report | `examples/enterprise-scenarios/commerce-voc-agent/expected-approval-report.md` | 최종 approver | 사람의 승인 문장과 잔여 위험 문장이 비어 있으면 보류합니다. |

## Exact evidence commands

Fresh clone 기준으로 먼저 `npm ci && npm run build`를 실행해 `dist/index.js`를 만든 뒤 아래 명령만 사용합니다.

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

Fixture paths:

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/enterprise-scenarios/commerce-voc-agent/expected-approval-report.md`
- `examples/agent-policy.yaml`

## Approver decision

| Verdict | 승인 문장 | Required evidence |
|---|---|---|
| `PASS` | "현재 문제 범위에서는 재실행 증거가 충분하므로 승인합니다." | 세 surface 모두 finding이 없거나 수정/정책 반영 후 통과했습니다. |
| `REVIEW` | "증거는 남았지만 owner 확인 전까지 조건부 보류합니다." | finding이 승인자 질문으로 라우팅되고 잔여 위험 문장이 있습니다. |
| `BLOCK` | "수정 또는 권한 축소 전에는 rollout을 승인하지 않습니다." | secret, broad MCP permission, or policy violation evidence가 남아 있습니다. |

## Rerun trigger

- PR diff가 바뀌면 `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` 형식의 새 입력으로 다시 증거를 남깁니다.
- MCP server/tool/path 범위가 바뀌면 `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` 형식의 새 입력으로 다시 확인합니다.
- 운영 정책이나 agent transcript/log가 바뀌면 `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` 형식으로 다시 확인합니다.
- 승인자, 잔여 위험, expected approval report 중 하나라도 비면 승인 전 재실행합니다.

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| `https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/` | agentic risk를 mitigation, control, residual risk 언어로 연결합니다. | 위협 범위를 모두 덮는다는 표현을 피합니다. | finding을 rollout approval question과 잔여 위험 문장으로 라우팅합니다. |
| `https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices` | least privilege, user consent, trusted boundary language를 빌립니다. | 라이브 MCP 권한 결정을 수행한다고 말하지 않습니다. | 사전 MCP config evidence에서 server/tool/path 범위를 승인자가 보게 합니다. |
| `https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql` | SARIF, reviewer artifact, developer handoff framing을 빌립니다. | GitHub security product 수준의 보증을 말하지 않습니다. | Markdown/JSON/SARIF 같은 reviewer-readable artifact handoff만 설명합니다. |
| `https://github.com/Tencent/AI-Infra-Guard` | public scanner ecosystem의 MCP/agent/infra scan breadth 압력을 참고합니다. | red-team suite나 vendor platform과 같은 범위라고 말하지 않습니다. | AgentGuard scope를 PR diff + MCP config + transcript evidence contract로 제한합니다. |

## Machine-contract boundaries

- Fresh-clone evidence commands use `node dist/index.js ...` after `npm run build`; installed-package CLI command names stay English-compatible as `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- Evidence surfaces stay English-compatible: `PR diff`, `MCP config`, `agent transcript/log`.
- Artifact names stay English-compatible: Markdown report, `JSON`, `SARIF`.
- Verdict tokens stay English-compatible: `PASS`, `REVIEW`, `BLOCK`.
- Korean-first 설명은 사람의 승인 판단을 돕고, machine field와 command spelling은 바꾸지 않습니다.

## Non-claim guardrails

- 상용 운영 사례, 유료 서비스 채택, reference account를 주장하지 않습니다.
- 외부 보증, 감사 통과, 표준 적합 상태를 주장하지 않습니다.
- 공개 reference의 승인이나 같은 수준의 보증을 주장하지 않습니다.
- AgentGuard 범위를 PR diff, MCP config, transcript/log acceptance evidence로 제한합니다.
- 승인자는 이 카드만으로 승인하지 않고, 명령 출력, artifact, owner decision, rerun trigger를 함께 확인합니다.
