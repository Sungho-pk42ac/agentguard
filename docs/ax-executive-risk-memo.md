# AX executive risk memo

한국어 우선 executive risk memo 템플릿입니다. 목적은 AgentGuard scanner evidence를 회사 배포 승인자가 30초 안에 읽을 수 있는 `go/no-go` 판단으로 바꾸는 것입니다. 이 문서는 현재 저장소 fixture와 기존 CLI surface만 사용하며, CLI behavior, rule ID, JSON/SARIF field를 바꾸지 않습니다.

## 언제 사용하나

AX Rollout Guard 발표나 회사 내부 rollout review에서 "이 agent workflow를 지금 배포해도 되는가?"를 묻는 순간에 사용합니다. 대상은 PR diff, MCP config, transcript/log evidence를 이미 뽑았지만, 담당 임원이나 보안 책임자가 scanner row 대신 의사결정 문장으로 보고 싶어 하는 상황입니다.

사용 조건:

- `npm run build` 뒤 아래 fixture-backed command를 실행할 수 있다.
- memo 작성자는 finding을 숨기지 않고 `BLOCK`, `REVIEW`, `PASS` 중 하나로 승인 상태를 적는다.
- 남은 운영 evidence gap은 "추가 확인 필요"로 남기고, AgentGuard가 보지 못한 runtime state를 본 것처럼 쓰지 않는다.

## 메모 템플릿

| 항목 | 작성 내용 |
|---|---|
| 배포 대상 | agent workflow 이름, 연결 MCP/tool, 담당 owner |
| 사업 목적 | 왜 지금 rollout이 필요한지 한 문장 |
| scanner evidence | `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` 결과와 artifact 위치 |
| 주요 위험 | `secret.github_token`, `mcp.broad_filesystem_access`, approval-required action처럼 의사결정에 필요한 finding |
| mitigation / control | secret 제거, MCP root 축소, read-only 권한, 사람 승인 ticket, rollback owner |
| residual risk | transcript 밖 tool call, 실제 token scope, SaaS permission, runtime telemetry처럼 추가 확인이 필요한 영역 |
| approval decision | `BLOCK`, `REVIEW`, `PASS` 중 하나와 `go/no-go` 문장 |

짧은 memo 예시:

```text
제목: Commerce VOC agent 제한 rollout go/no-go
결론: REVIEW - broad MCP filesystem access와 approval-required transcript action이 남아 있어 운영 배포는 보류한다.
근거: scan-diff는 secret-like material을 표시했고, scan-mcp는 mcp.broad_filesystem_access를 표시했으며, scan-log는 정책 승인 대상 action을 표시했다.
필요 조치: secret-like value 제거, MCP root를 read-only fixture/export 경로로 축소, export action owner 승인 기록 후 같은 command를 재실행한다.
잔여 위험: AgentGuard는 diff/config/log evidence만 본다. 실제 token scope와 외부 SaaS 권한은 운영 owner가 별도 확인한다.
```

## 증거 명령

저장소 루트에서 실행합니다. fresh clone이면 먼저 `npm ci && npm run build`로 `dist/` artifact를 만듭니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

Expected CLI shape: blocker examples can exit non-zero while still producing the intended `BLOCK`/`REVIEW` evidence. In POSIX shells, `< file` is the canonical demo form. In Windows PowerShell, use `Get-Content examples/risky-pr.diff | node dist/index.js scan-diff` style piping when `<` redirection is unavailable.

Fixture paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`

Machine-facing strings stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `secret.github_token`, `mcp.broad_filesystem_access`, `SARIF`, `BLOCK`, `REVIEW`, `PASS`.

## Public reference signals

| Public reference signal | Borrow | Avoid | Memo use |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, excessive agency, mitigation/control vocabulary | external assurance, scope guarantee, or standards mark | finding row를 threat + mitigation + residual risk로 낮춰 쓴다. |
| Snyk agent-scan: https://github.com/snyk/agent-scan | agent workflow and MCP scanning category language | vendor parity, market proof, or same product scope | AgentGuard 범위를 PR diff, MCP config, transcript/log evidence로 좁혀 말한다. |
| Tencent AI-Infra-Guard: https://github.com/Tencent/AI-Infra-Guard | AI infrastructure risk posture and inventory framing | broad AI-infra suite or platform claim | rollout memo는 현재 CLI surface가 주는 control evidence만 다룬다. |
| splx-ai Agentic Radar: https://github.com/splx-ai/agentic-radar | agentic security assessment and residual-risk framing | broad red-team platform claim or runtime monitoring claim | residual risk section에 "무엇을 아직 보지 못했는가"를 명확히 둔다. |
| GitHub SARIF support: https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | code scanning artifact handoff language: rule, result, location | unsupported reviewer behavior promise or fingerprint outcome promise | SARIF/Markdown/PR comment를 같은 finding의 reviewer artifact로 설명한다. |

## Approval wording

임원 memo에는 아래 세 문장 중 하나를 그대로 고릅니다.

- `BLOCK`: "현재 evidence 기준으로 운영 배포는 no-go입니다. blocker finding을 제거하고 같은 surface에서 재검토하기 전까지 rollout을 진행하지 않습니다."
- `REVIEW`: "현재 evidence 기준으로 제한 rollout만 검토 가능합니다. owner 승인, mitigation, rollback 조건을 memo에 남긴 뒤 go/no-go를 다시 판단합니다."
- `PASS`: "현재 fixture-backed evidence 기준으로 제한 rollout은 go 후보입니다. 남은 runtime, token scope, SaaS permission risk는 운영 owner 확인 대상으로 남깁니다."

## Honesty guardrails

- 이 memo는 합성 fixture-backed executive handoff입니다.
- 외부 framework, vendor, repository가 AgentGuard 결과를 보증한다고 쓰지 않습니다.
- broad scanner parity, hosted dashboard, auth/SaaS, runtime monitoring, company upload workflow를 주장하지 않습니다.
- SARIF artifact는 reviewer handoff 수단으로만 말하고, code scanning 운영 결과를 약속하지 않습니다.
- machine contract는 그대로 둡니다: CLI command name, rule ID, JSON/SARIF field, verdict vocabulary를 발표용으로 바꾸지 않습니다.
