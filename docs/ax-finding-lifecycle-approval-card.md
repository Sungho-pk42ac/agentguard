# AX finding lifecycle approval card

한국어 우선 심사위원(judge) 대상 카드입니다. 목적은 scanner output을 기업 rollout 승인 루프로 설명하는 것입니다. 핵심 문장: finding → source evidence → owner → fix/policy condition → rerun command/artifact → approval decision.

## 사용 목적

AgentGuard가 발견한 `BLOCK` / `REVIEW` / `PASS` 결과를 "무엇을 발견했는가"에서 끝내지 않고, 증거 원본, 담당자, 수정 또는 정책 조건, 재실행 명령과 artifact, 승인 결정을 한 장에 묶습니다. 이 카드는 기업 심사자가 "스캐너 결과가 실제 rollout 승인에 어떻게 쓰이는가"를 볼 때 사용합니다.

범위는 정적 evidence handoff입니다. AgentGuard는 아래 명령과 artifact를 통해 검토자가 재실행할 수 있는 근거를 남기며, MCP 서버 운영 제어나 GitHub code scanning 운영 판단은 해당 환경의 승인자가 별도로 수행합니다.

## Finding → evidence → owner → condition → rerun → approval

| Lifecycle step | Korean-first judge wording | Machine artifact kept stable |
|---|---|---|
| Finding | "어떤 위험이 배포 전에 잡혔는가?" | `BLOCK` / `REVIEW` / `PASS`, rule IDs |
| Source evidence | "원본 PR diff, MCP config, agent transcript/log 중 어디에서 나왔는가?" | fixture path, redacted evidence, line cue |
| Owner | "누가 수정 또는 예외 판단을 책임지는가?" | business owner, security owner, agent operator |
| Fix/policy condition | "코드 수정, MCP 권한 축소, 정책 예외 중 무엇이 승인 조건인가?" | `secret.github_token`, `mcp.broad_filesystem_access`, `agent.dangerous_command` |
| Rerun command/artifact | "같은 입력으로 다시 실행했을 때 어떤 JSON/SARIF/report가 남는가?" | `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `agentguard.sarif` |
| Approval decision | "조건 충족 후 승인, 조건부 보류, 차단 중 무엇인가?" | approval report sentence with `PASS` / `REVIEW` / `BLOCK` |

## 승인 카드 템플릿

| Field | Fill this for a rollout review |
|---|---|
| Finding | `BLOCK secret.github_token`, `REVIEW mcp.broad_filesystem_access`, or `REVIEW agent.dangerous_command` |
| Source evidence | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, or `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` |
| Owner | 보안 담당자, 업무 owner, agent 운영자 중 하나를 명시 |
| Fix/policy condition | secret 제거, MCP filesystem root 축소, denied command 정책 예외 승인 여부 |
| Rerun command/artifact | 아래 fixture-backed command와 `JSON`, `SARIF`, Markdown approval report |
| Approval decision | `PASS`: 배포 가능, `REVIEW`: 승인자 조건 필요, `BLOCK`: 조건 충족 전 rollout 중지 |

## Fixture-backed commands

PR diff finding을 JSON으로 재실행:

```bash
agentguard scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

PR diff finding을 SARIF reviewer artifact로 재실행:

```bash
agentguard scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

MCP config finding을 JSON으로 재실행:

```bash
agentguard scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
```

Agent transcript/log finding을 정책과 함께 JSON으로 재실행:

```bash
agentguard scan-log --policy examples/agent-policy.yaml --json < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

승인자가 보는 narrative artifact는 `examples/enterprise-scenarios/commerce-voc-agent/expected-approval-report.md` 형식의 approval report로 남깁니다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP LLM Top 10 — https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | prompt injection, sensitive-info, excessive-agency style threat/control framing | OWASP가 AgentGuard를 평가했다는 표현 | PR diff, MCP config, transcript/log finding을 승인 조건으로 연결 |
| MCP security best practices — https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices | trusted boundary, user consent, authorization wording | AgentGuard가 MCP 서버 실행을 관리한다는 표현 | MCP config evidence와 owner 승인 질문을 분리 |
| GitHub SARIF support — https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | SARIF를 reviewer handoff artifact와 source-of-record 형태로 설명 | GitHub가 결과를 대신 승인한다는 표현 | `agentguard scan-diff --sarif --out agentguard.sarif` artifact를 남김 |
| splx-ai agentic-radar — https://github.com/splx-ai/agentic-radar | agentic systems security scanner ecosystem positioning | 같은 제품 범위라는 표현 | AgentGuard는 Korean-first rollout approval loop에 집중 |
| Tencent AI-Infra-Guard — https://github.com/tencent/AI-Infra-Guard | AI agent/MCP security needs dedicated checks | platform scope 비교 우위 표현 | 현재 fixture-backed PR/MCP/transcript/SARIF evidence로 데모 |

## Machine-contract preservation

Human-facing 문장은 한국어 우선으로 작성합니다. Machine-facing 계약은 그대로 둡니다.

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`, `agent.dangerous_command`
- Verdicts: `BLOCK`, `REVIEW`, `PASS`
- Output contracts: `JSON`, `SARIF`, Markdown approval report
- Artifact names: `agentguard.sarif`, existing fixture paths under `examples/`

## Non-claim guardrails

- 이 카드는 scanner behavior, default policy, severity, verdict, JSON, SARIF, CLI flag contract를 바꾸지 않습니다.
- 공용 reference는 threat/control 또는 artifact handoff language를 빌리는 용도입니다.
- AgentGuard가 MCP 서버를 실행하거나 운영 권한을 강제한다고 말하지 않습니다.
- GitHub SARIF artifact는 reviewer handoff 근거이며, 승인 결정은 조직의 reviewer가 합니다.
- 운영 채택 실적, 외부 보증, 공개 scanner 대비 동일 범위 주장은 쓰지 않습니다.
