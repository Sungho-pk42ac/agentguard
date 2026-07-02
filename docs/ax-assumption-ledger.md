# AX assumption ledger

이 문서는 기업 문제형 본선에서 unknown/gated facts를 만났을 때 AgentGuard를 과장하지 않고 AX Rollout Guard 판단으로 피벗하기 위한 한국어 우선 assumption ledger입니다. 목표는 public signals와 synthetic evidence를 묶어 대상권 심사자가 바로 볼 수 있는 판단 스크립트를 만드는 것이며, 회사 포털, customer data, 운영 채택 사실을 추정하지 않습니다.

## 확인된 공개 사실

- AgentGuard의 현재 machine-facing surface는 `scan-diff`, `scan-mcp`, `scan-log`, Markdown report, JSON/SARIF output, policy file입니다.
- 이 저장소의 enterprise scenario와 before/after rollout fixture는 synthetic fixture입니다. customer account, 회사 시스템, 운영 데이터, private transcript가 아닙니다.
- 기업 문제형 본선에서는 회사 내부 포털, 정책, 데이터 흐름, 승인권자 같은 gated facts가 현장에서만 확인될 수 있습니다.
- AgentGuard가 지금 증명할 수 있는 것은 gated company facts 자체가 아니라 PR diff, MCP config, agent transcript/log evidence를 배포 전 승인 조건으로 바꾸는 deterministic rollout gate입니다.
- 대상권 발표에서는 "모르는 사실을 아는 척"하는 대신 "확인된 사실, 가정, evidence command, pivot trigger"를 분리해야 합니다.

## Public reference mapping

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | agent autonomy, tool misuse, excessive agency, threat-to-mitigation framing | OWASP endorsement, certification, complete threat coverage claim | finding을 threat → mitigation/evidence로 낮춰 `BLOCK → 수정 조건 → PASS` 판단에 연결한다. |
| [Snyk `agent-scan`](https://github.com/snyk/agent-scan) | AI agents, MCP servers, agent skills를 scanner category로 선명하게 나누는 표현 | Snyk ecosystem parity, commercial scanner breadth, adoption comparison | AgentGuard를 Korean-first PR diff + MCP config + transcript/log rollout evidence gate로 좁혀 설명한다. |
| [Tencent `AI-Infra-Guard`](https://github.com/Tencent/AI-Infra-Guard) | Agent/MCP/Skills 같은 넓은 AI infra surface taxonomy | end-to-end AI red-team suite, platform parity, all-infra coverage | 넓은 taxonomy는 risk checklist로만 빌리고, 현재 evidence는 existing CLI fixture surfaces로 제한한다. |
| [splx-ai `agentic-radar`](https://github.com/splx-ai/agentic-radar) | agentic workflow scanner와 MCP/devsecops topic framing | devsecops replacement, attack-simulation parity, broad-platform claim | 기존 PR/MCP/log commands와 docs worksheet를 workflow risk pivot script로 묶는다. |

## Assumptions ledger

| Unknown/gated fact | Safe working assumption | Evidence to use now | Pivot when confirmed |
|---|---|---|---|
| 회사 포털 접근 방식 | 포털 세부 구조는 모른다. agent가 남기는 PR diff, MCP config, transcript/log surface만 판단한다. | synthetic evidence commands로 broad filesystem, risky diff, approval-required command를 보여준다. | 포털이 실제로 MCP/filesystem을 쓰면 `scan-mcp` 중심으로, PR workflow면 `scan-diff` 중심으로 피벗한다. |
| 승인권자와 정책 | 승인권자는 역할 단위로만 둔다: 운영 리드, 보안 담당, 팀장. | expected approval report와 worksheet 문구를 사용한다. | 실제 승인권자가 확인되면 "배포 승인 조건" 항목만 바꾼다. |
| 데이터 민감도 | 실제 개인정보나 secret은 쓰지 않는다. fake secret-like, PII-shaped synthetic fixture로만 설명한다. | risky/fixed PR diff와 transcript/log fixture를 사용한다. | 실제 데이터 분류표가 나오면 rule severity를 바꾸지 말고 발표 문구의 업무 영향만 업데이트한다. |
| 경쟁 도구와 비교 범위 | 공개 repo 설명에서 surface language만 빌린다. | borrow/avoid/action table을 보여준다. | 비교 질문이 나오면 "AgentGuard는 rollout gate slice"라고 답하고 full platform 비교로 확장하지 않는다. |
| 본선 문제 적합성 | 처음 받은 문제를 바로 구현하지 않고 evidence surface로 변환한다. | company problem intake kit, final worksheet, assumption ledger를 함께 사용한다. | 문제에 PR/MCP/log surface가 전혀 없으면 이 slice로는 다루지 않고 stop condition을 보고한다. |

## Evidence commands

아래 명령은 현재 저장소의 fixture-backed command만 사용합니다. 발표 전에 `npm run build`를 실행하고 저장소 루트에서 그대로 실행합니다. 모든 입력은 synthetic fixture이며, 실제 회사 데이터가 아닙니다.

```bash
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

Evidence story:

- Risky MCP: broad/writable filesystem 설정을 `BLOCK` rollout stop으로 설명한다.
- Fixed MCP: fixture 전용 read-only root로 줄인 뒤 `PASS` 또는 승인 후보 상태를 보여준다.
- Risky PR diff: synthetic secret-like/PII-shaped material을 merge 전 reviewer evidence로 설명한다.
- Fixed PR diff: 위험 입력 제거 뒤 같은 command로 재검증한다.
- Agent transcript/log: 승인 없는 export, 민감 경로 접근, 삭제성 명령을 사람 승인 조건이 필요한 `REVIEW` evidence로 설명한다.

## Pivot triggers

| Trigger | Pivot action | Stop line |
|---|---|---|
| 회사 문제가 PR 변경 중심이다. | `scan-diff`와 SARIF/Markdown report를 중심으로 승인 조건을 만든다. | "이 판단은 PR diff evidence 기준입니다." |
| 회사 문제가 agent tool 권한 중심이다. | `scan-mcp`로 filesystem root, writable path, credential passthrough를 설명한다. | "MCP runtime enforcement나 표준 인증을 주장하지 않습니다." |
| 회사 문제가 실행 로그/운영 행동 중심이다. | `scan-log --policy examples/agent-policy.yaml`로 approval-required behavior를 설명한다. | "transcript/log가 없으면 최종 판단 전입니다." |
| gated portal detail이 확인되지 않았다. | confirmed fact와 assumption을 분리하고, synthetic fixture 기준이라고 표시한다. | "포털 내부 사실은 확인 전이므로 범위 밖입니다." |
| 심사자가 경쟁 제품 수준의 broad platform을 묻는다. | public reference mapping의 Borrow/Avoid/AgentGuard action으로 답한다. | "AgentGuard는 이 slice에서 rollout gate evidence에 집중합니다." |

## Honesty guardrails

- No fake adoption: 운영 채택, reference account, customer deployment를 주장하지 않는다.
- No customer claim: 회사명, customer account, 내부 포털 세부 사실을 확인 없이 말하지 않는다.
- No certification claim: OWASP, MCP, Snyk, Tencent, splx-ai가 AgentGuard를 인증, 검증, 감사, 승인했다고 말하지 않는다.
- No parity claim: Snyk `agent-scan`, Tencent `AI-Infra-Guard`, splx-ai `agentic-radar`와 같은 생태계, coverage, platform 규모라고 말하지 않는다.
- No broad-platform claim: end-to-end AI red-team suite, devsecops replacement, all-agent-security coverage를 주장하지 않는다.
- No real data: actual secret, 개인정보, private transcript, 운영 로그, 내부 문서를 fixture로 쓰지 않는다.
- Synthetic fixture label: 모든 demo input과 output은 synthetic fixture, synthetic evidence 기준이라고 명시한다.
- Machine contract preservation: `agentguard`, `scan-diff`, `scan-mcp`, `scan-log`, rule IDs, JSON/SARIF fields는 presentation 때문에 바꾸지 않는다.

## 대상권 judging script

> "기업 문제형 본선에서는 회사 포털과 내부 정책처럼 지금 모르는 정보가 있습니다. 그래서 AgentGuard는 모르는 사실을 제품 기능처럼 말하지 않고, 확인된 public signals와 synthetic evidence를 분리합니다. 이 ledger는 OWASP식 threat-to-mitigation 언어와 공개 agent/MCP scanner category를 빌리되, AgentGuard가 현재 증명할 수 있는 PR diff, MCP config, transcript/log rollout gate로만 피벗합니다. 결과적으로 대상권 심사자가 보는 것은 broad platform 주장이 아니라, unknown/gated facts를 안전하게 처리하는 배포 승인 판단표입니다."
