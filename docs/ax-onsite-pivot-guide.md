# AX onsite pivot guide

이 가이드는 현장에서 처음 듣는 company problem을 30초 안에 기존 AgentGuard evidence로 바꾸기 위한 한국어 우선 피벗 문서입니다. 새 scanner 동작을 만들지 않고, 이미 있는 MCP config, PR diff, agent transcript 문서와 fixture-backed command만 사용합니다.

> **데모 안전선**: 이 문서는 live simulation/demo에서 회사 문제를 기존 fixture-backed evidence로 빠르게 설명하기 위한 가이드입니다. 운영 audit, 실제 고객 자료, production rollout 승인 절차를 우회하는 용도로 쓰지 않습니다. 실제 회사 데이터가 들어오면 별도 보안 검토와 승인권자 확인이 먼저 필요합니다.

## 30초 현장 피벗

1. 회사 문제를 "업무 워크플로 → 에이전트가 만지는 surface → 실패 시 업무 영향" 한 문장으로 줄입니다.
2. surface를 AgentGuard가 이미 보여주는 `PR diff`, `MCP config`, `agent transcript` 중 하나에 붙입니다.
3. 아래 표에서 가장 가까운 evidence command를 그대로 실행하거나 발표 슬라이드에 붙입니다.
4. 결과를 `BLOCK`, `REVIEW`, `PASS` 언어로 말하고, 수정 조건은 기존 AX docs로 넘깁니다.
5. 발표에서는 현업 시나리오 적합성, 빠른 문제 적응력, 정직한 evidence boundary를 함께 말합니다.

## Company problem → existing evidence

| 현장 signal | AgentGuard surface | existing evidence command | fixture-backed path | 30초 설명 |
|---|---|---|---|---|
| "에이전트가 고객 VOC export, 환불, 쿠폰, CRM 메모 초안을 읽는다." | `MCP config` | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | broad root, writable path, credential passthrough 때문에 rollout 전 `BLOCK` 근거가 생깁니다. |
| "권한을 줄이면 같은 업무를 승인 후보로 볼 수 있나?" | `MCP config` | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | fixture 전용 read-only root로 좁힌 뒤 `PASS` evidence를 보여줍니다. |
| "에이전트 PR이 token-like 값이나 담당자 정보를 새로 추가한다." | `PR diff` | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | synthetic secret-like material과 개인정보 형태 텍스트를 `REVIEW` 또는 `BLOCK` 후보로 설명합니다. |
| "수정 PR이 위험 입력을 제거했다." | `PR diff` | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | 같은 surface에서 위험 입력 제거 후 `PASS`를 보여줍니다. |
| "발표에서 로그나 셸 행동까지 말해야 한다." | `agent transcript` | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-transcript.log` | 별도 AX fixture를 만들지 않고 기존 transcript demo로 approval-required shell behavior를 보조 설명합니다. |

## Handoff links

- 문제를 처음 구조화할 때: [AX company problem intake kit](ax-company-problem-intake-kit.md)
- 심사자에게 evidence 표만 보여줄 때: [AX judge evidence index](ax-judge-evidence-index.md)
- before/after 승인 스토리가 필요할 때: [AX before/after rollout demo](ax-before-after-rollout-demo.md)
- 발표 리허설 순서가 필요할 때: [AX live demo runbook](ax-live-demo-runbook.md)

## Public reference grounding

| Reference | 빌릴 점 / borrow | 피할 점 / avoid | 이 guide의 적용 |
|---|---|---|---|
| https://github.com/snyk/agent-scan | agent, MCP, PR 같은 scanner surface를 짧고 명확하게 말하는 방식을 빌립니다. | Snyk와 같은 scope, adoption, product maturity를 주장하지 않습니다. | AgentGuard는 이 문서에서 `scan-mcp`, `scan-diff`, `scan-log`로 관찰 가능한 surface만 말합니다. |
| https://github.com/Tencent/AI-Infra-Guard | AI infrastructure guardrail이라는 넓은 문제 framing을 빌립니다. | full AI infra platform이나 red-team platform coverage를 주장하지 않습니다. | AgentGuard는 현장 rollout gate로만 둡니다. |
| https://github.com/splx-ai/agentic-radar | agentic workflow scanner positioning과 workflow risk 언어를 참고합니다. | runtime monitoring이나 전 범위 workflow 감시를 말하지 않습니다. | company problem signal을 기존 fixture-backed command로만 매핑합니다. |

## 말할 문장

> "이 company problem은 에이전트가 `MCP config`, `PR diff`, `agent transcript` surface를 남기는 상황입니다. AgentGuard는 새 플랫폼을 주장하지 않고, 기존 fixture-backed command로 `BLOCK → 수정/정책 → PASS` evidence를 보여주는 rollout guard입니다."

## 하지 않는 주장

- 운영 proof, named account, market traction을 말하지 않습니다.
- 외부 reference의 endorsement, compliance, audit status를 말하지 않습니다.
- 다른 보안 제품군의 역할까지 수행한다고 말하지 않습니다.
- 종합 보안 플랫폼, 전 범위 workflow 감시, runtime monitoring을 말하지 않습니다.
- CLI commands, rule IDs, SARIF/API/machine fields를 한국어로 바꾸지 않습니다.
