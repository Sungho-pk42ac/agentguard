# AX adversarial judge checklist

한국어 우선 30초 심사 방어 체크리스트입니다. 알 수 없는 회사 workflow를 받았을 때 심사자가 던질 수 있는 공격적 질문을 AgentGuard/AX Rollout Guard의 현재 fixture-backed evidence command로 바로 연결합니다. 제품명, CLI command, rule IDs, SARIF/JSON fields는 machine contract로 유지하고, 한국어 문장은 판단을 빠르게 돕는 presentation layer로만 둡니다.

## Purpose

- 목표: "이 회사 agent rollout을 지금 승인해도 되는가?"라는 질문을 PR diff, MCP config, transcript/log evidence로 쪼개서 `BLOCK`, `REVIEW`, `PASS` 판단까지 보여줍니다.
- 사용 시점: judge가 unknown company problem, MCP permission, agent-generated change, SARIF/PR evidence, 공개 reference 근거를 짧게 묻는 순간.
- 범위: deterministic CLI gate와 문서화된 증거 routing입니다. scanner rule, severity policy, product name, rule IDs를 발표용으로 바꾸지 않습니다.

## Public references

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | 빌릴 점: autonomous behavior, tool use, mitigation framing으로 "agent가 무엇을 할 수 있어서 위험한가"를 묻습니다. | 피할 점: OWASP 보증, 전체 threat coverage, 외부 보장처럼 들리는 표현. | PR diff, MCP config, transcript/log finding을 rollout approval condition으로 좁혀 설명합니다. |
| [GitHub SARIF support docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Borrow: SARIF `ruleId`, `results`, `locations`, `partialFingerprints` 중심의 reviewer evidence routing. | Avoid: GitHub security product 기능을 바꾸거나 CLI/rule IDs를 presentation용으로 바꾸는 주장. | Markdown report, SARIF, PR evidence가 같은 finding을 가리키도록 command와 artifact path를 그대로 보여줍니다. |
| [Model Context Protocol security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | 빌릴 점: permission, credential, user consent, confused deputy 언어로 MCP config 질문을 구성합니다. | 피할 점: MCP 표준 적합성, 런타임 permission enforcement, vendor trust badge. | `scan-mcp` evidence로 broad filesystem, writable path, credential env passthrough를 approval hold 조건에 연결합니다. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Borrow: agent-generated change와 repo activity를 security evidence로 보는 category language. | Avoid: vendor-scale breadth, 대형 security suite와 같은 범위 주장. | Korean-first rollout approval gate로 차별화하고 PR diff + MCP + transcript/log를 한 줄 decision으로 묶습니다. |

## Adversarial questions

| Judge challenge | 30-second answer | Evidence command |
|---|---|---|
| "새 회사 workflow를 받으면 무엇부터 막습니까?" | 먼저 agent가 만든 PR diff에서 secret-like change와 risky automation을 봅니다. | `node dist/index.js scan-diff < examples/risky-pr.diff` |
| "MCP config가 왜 rollout blocker입니까?" | filesystem breadth, writable root, credential env passthrough는 agent autonomy와 permission boundary 문제입니다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` |
| "agent가 실제로 승인 없이 행동했는지 어떻게 보나요?" | transcript/log를 policy와 함께 읽어 shell/export/delete성 행동을 reviewer condition으로 남깁니다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` |
| "judge나 reviewer가 어디서 evidence를 봅니까?" | 터미널 Markdown report, PR comment에 붙일 Markdown report, GitHub code scanning용 SARIF를 같은 finding 흐름으로 봅니다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` |
| "공개 reference를 기능처럼 과장한 것 아닙니까?" | reference는 질문 프레임만 빌리고, 현재 evidence는 저장소 fixture와 CLI output으로만 말합니다. | `docs/ax-rollout-references.md`와 이 checklist를 함께 제시합니다. |

## Exact fixture-backed commands

저장소 루트에서 빌드 후 아래 commands를 그대로 실행합니다. 설치된 binary를 설명할 때도 machine-facing surface는 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` 그대로 유지합니다.

```bash
npm run build
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

Fixture paths:

- `examples/risky-pr.diff` -> PR evidence와 Markdown report에서 `secret.github_token` 같은 rule finding을 보여줍니다.
- `examples/risky-mcp.json` -> MCP permission evidence에서 `mcp.broad_filesystem_access` 같은 rule vocabulary를 보여줍니다.
- `examples/agent-policy.yaml` -> transcript/log review policy를 고정합니다.
- `examples/agent-transcript.log` -> agent behavior evidence를 reviewer가 다시 읽을 수 있게 합니다.

## Expected verdicts

| Evidence surface | Expected verdict | Judge-facing meaning |
|---|---|---|
| PR diff Markdown report | `BLOCK` 또는 high-risk review evidence | secret-like diff나 risky automation이 있으면 rollout을 멈추고 PR 수정 조건을 남깁니다. |
| MCP config report | `BLOCK` 또는 `REVIEW` | permission, credential, consent boundary가 넓으면 운영자 승인을 요구합니다. |
| Transcript/log report | `REVIEW` | agent action이 policy 기준을 넘으면 사람 reviewer가 승인 조건을 확인합니다. |
| SARIF output | same finding routed as SARIF `results` | GitHub code scanning이 읽는 `ruleId`, `locations`, `partialFingerprints`를 보존합니다. |
| Clean rerun after fix | `PASS` | blocking finding이 사라진 경우에만 rollout approval sentence로 넘어갑니다. |

## Approval / hold conditions

- Approve only when: PR diff, MCP config, transcript/log evidence가 같은 company problem에 대해 `PASS`이거나 reviewer가 남은 `REVIEW` 항목을 명시적으로 승인했습니다.
- Hold when: `BLOCK` finding이 하나라도 남아 있거나, MCP filesystem/credential boundary가 설명되지 않았거나, transcript/log action owner가 불명확합니다.
- Hold when: SARIF artifact와 Markdown report가 서로 다른 command, ruleId, file path를 가리켜 reviewer가 같은 finding임을 확인할 수 없습니다.
- Approve wording: "현재 fixture-backed evidence 기준으로 blocking finding이 없고, 남은 review item은 owner와 수정 조건이 있습니다."
- Hold wording: "현재 evidence는 rollout 승인보다 수정/사람 검토가 먼저입니다. 아래 command output을 기준으로 owner와 fix condition을 남깁니다."

## Non-claim guardrails

- 공개 reference는 threat-model, SARIF routing, MCP permission, agent-generated-change 질문을 빌리는 근거입니다. 외부 기관 보장이나 vendor parity처럼 말하지 않습니다.
- AgentGuard는 현재 CLI evidence gate입니다. dashboard, hosted auth, customer-data workflow, broad AI infra scanner로 범위를 넓혀 말하지 않습니다.
- Synthetic fixtures는 synthetic이라고 말합니다. 실제 운영 실적, 실제 회사 data, paid deployment, reference account를 암시하지 않습니다.
- CLI commands, command flags, rule IDs, JSON/SARIF machine fields는 영어 contract로 유지합니다. 한국어 문서는 판단 설명만 담당합니다.
- `BLOCK`은 위험을 과장하는 말이 아니라 rollout hold condition입니다. `REVIEW`는 사람 승인 조건이고, `PASS`는 현재 deterministic checks에서 blocking finding이 없다는 뜻입니다.
