# AX rollout control map

이 문서는 AgentGuard -> AX Rollout Guard의 대상권 positioning을 한국어 우선으로 설명하는 한 장짜리 control map입니다. 목표는 public threat language -> AgentGuard surface -> exact command -> expected verdict -> approval condition -> residual risk를 심사자가 바로 확인하게 만드는 것입니다.

범위는 현재 저장소의 합성 fixture와 구현된 CLI surface입니다. scanner behavior, command name, rule ID, verdict, SARIF/JSON field는 바꾸지 않습니다.

이 control map이 보강하는 심사 포인트는 세 가지입니다. **현업성**은 기업 담당자가 배포 전 실제로 묻는 승인 조건과 잔여 위험을 한 줄로 남기는 것입니다. **발표력**은 public threat language를 exact command와 expected verdict로 즉시 연결하는 것입니다. **정직성**은 합성 fixture, 구현된 CLI surface, 남은 운영 evidence gap을 분리해 말하는 것입니다.

## Public reference control map

| Public reference | borrow | avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | borrow: agent autonomy, tool misuse, excessive agency, mitigation/control vocabulary를 빌린다. | avoid: OWASP 확인, 모든 agent threat 대응, 외부 신뢰 마크처럼 말하지 않는다. | action: PR diff와 transcript/log evidence를 "무엇을 읽고 실행했는가"와 사람 승인 조건으로 낮춘다. |
| Tencent AI-Infra-Guard: https://github.com/Tencent/AI-Infra-Guard | borrow: agent, MCP, AI infrastructure threat inventory framing을 빌린다. | avoid: 넓은 red-team suite, broad AI-infra scanner, 같은 범위처럼 말하지 않는다. | action: AgentGuard는 PR diff, MCP config, transcript/log를 rollout gate evidence로 묶는 현재 범위만 설명한다. |
| splx-ai Agentic Radar: https://github.com/splx-ai/agentic-radar | borrow: agentic workflow, MCP scanner, reportable security insights category language를 빌린다. | avoid: runtime monitoring, workflow graph scanner, 같은 product coverage처럼 말하지 않는다. | action: exact fixture-backed commands가 만드는 reviewer-visible Markdown evidence를 proof로 둔다. |
| GitHub SARIF support: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | borrow: SARIF rule, result, location, artifact routing language를 빌린다. | avoid: GitHub security product 역할 주장, presentation용 CLI/rule ID rename처럼 말하지 않는다. | action: human Korean control map과 machine-readable output이 같은 finding surface를 가리키게 한다. |

## Fixture-backed rollout checks

저장소 루트에서 실행합니다. fresh clone이면 먼저 `npm ci && npm run build`로 `dist/` artifact를 만듭니다.

| Surface | public threat framing | exact command | expected verdict | approval condition | residual risk |
|---|---|---|---|---|---|
| PR diff | agent-created PR에 secret-like material, destructive shell behavior, reviewer action item이 들어갈 수 있다. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `REVIEW` | secret-like value 제거, 위험 shell step 삭제 또는 사람 승인 ticket을 남긴 뒤 같은 surface를 재실행해 `PASS` 후보 evidence를 확보한다. | AgentGuard는 diff에 보이는 material만 본다. 실행 후 runtime state나 비공개 ticket system 상태는 별도 확인이 필요하다. |
| MCP config | broad tool access, credential passthrough, filesystem integration이 agent 권한을 넓힐 수 있다. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `REVIEW` | filesystem scope를 업무 fixture root로 줄이고 credential passthrough를 제거하거나 최소 권한 token으로 바꾼 뒤 제한 rollout만 승인 후보로 둔다. | config 파일에 없는 실제 server-side 권한, token scope, 운영 logging은 이 command만으로 확인하지 않는다. |
| Transcript/log | agent가 승인 없는 export, 민감 경로 접근, 삭제성 명령을 시도했을 수 있다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` | 담당자가 approval-required action을 확인하고 허용 범위, rollback owner, 재실행 조건을 승인 리포트에 남긴 경우에만 진행한다. | transcript/log에 남지 않은 tool call, 외부 SaaS action, 누락된 audit log는 별도 운영 evidence가 필요하다. |

## Approval condition

심사 발표에서는 세 command 모두를 rollout decision surface로 읽습니다.

- `REVIEW`는 "현업 담당자 승인 전에는 운영 연결을 넓히지 않는다"는 stop condition입니다.
- `BLOCK`은 기존 CLI verdict vocabulary에 남아 있으며, 이 map의 세 commerce VOC commands는 현재 fixture에서 `REVIEW` evidence를 만듭니다.
- `PASS`는 같은 surface에서 위험 입력이 제거된 뒤 제한 rollout 승인 후보로만 말합니다.
- approval condition은 command output, 수정 또는 정책 근거, residual risk owner를 함께 남기는 것입니다.

## Residual risk

AgentGuard는 이 slice에서 PR diff, MCP config, transcript/log의 합성 fixture evidence를 제공합니다. 다음은 남는 위험입니다.

- repo 밖 runtime telemetry, 실제 token scope, SaaS permission, 조직 approval workflow는 이 문서의 proof가 아닙니다.
- public references는 vocabulary와 framing의 근거이지 외부 확인이나 시장 실적 근거가 아닙니다.
- CLI behavior, scanner rule, default blocking policy를 바꾸지 않으므로 새 위협 category는 다음 slice에서 별도 rule/test/evidence가 필요합니다.

## Honesty guardrails

- 이 문서는 합성 fixture-backed judge handoff입니다.
- AgentGuard를 Tencent AI-Infra-Guard, splx-ai Agentic Radar, GitHub security products와 같은 범위라고 말하지 않습니다.
- OWASP, Tencent, splx-ai, GitHub가 AgentGuard 결과를 외부 확인 근거로 제공했다고 말하지 않습니다.
- hosted service, account system, payment flow, company upload workflow를 주장하지 않습니다.
- machine-facing strings는 그대로 유지합니다: `AgentGuard`, `node dist/index.js scan-diff`, `scan-mcp`, `scan-log`, `REVIEW`, `PASS`, rule IDs, JSON/SARIF fields.
