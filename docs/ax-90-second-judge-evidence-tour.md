# AX 90-second judge evidence tour

이 문서는 AgentGuard를 AX Rollout Guard로 90초 안에 판단하게 만드는 한국어 우선 evidence tour입니다. 목표는 흩어진 docs와 합성 fixture를 **회사 문제 → command → verdict → 승인 문장** 순서로 압축하는 것입니다.

범위는 현재 저장소의 fixture-backed CLI evidence뿐입니다. Scanner behavior, CLI commands, rule IDs, policy defaults, package metadata, generated reports는 이 문서로 바꾸지 않습니다.

## 90초 진행 순서

| Stop | 회사 문제 | exact command | 기대 verdict와 읽는 법 | 승인 문장 |
|---|---|---|---|---|
| 1. MCP rollout gate | 커머스 VOC 에이전트가 로컬 파일과 업무 자료에 넓은 MCP filesystem 권한을 갖고 연결될 수 있다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `BLOCK`은 배포 rollout을 멈추고 broad root, writable path, credential-like env를 줄이라는 뜻이다. | "MCP 권한이 `BLOCK`이므로 root 축소와 read-only 전환 전에는 AX 에이전트 운영 연결을 승인하지 않습니다." |
| 2. PR diff gate | AX 에이전트가 만든 PR diff에 secret-like 값이나 위험한 shell material이 새로 들어갈 수 있다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK`은 출시 전 PR merge를 차단하고 diff에서 agent-visible secret/risky material을 제거하라는 뜻이다. | "PR diff evidence가 `BLOCK`이므로 secret-like material 제거 전에는 merge나 배포를 승인하지 않습니다." |
| 3. transcript/log gate | 에이전트 실행 transcript에 승인 없는 export, 민감 경로 접근, 삭제성 명령이 남을 수 있다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `REVIEW`는 사람이 승인 조건을 확인하고 제한 rollout 여부를 판단해야 한다는 뜻이다. | "transcript/log가 `REVIEW`이므로 승인자가 정책 예외와 실행 범위를 확인한 뒤 제한 rollout만 허용합니다." |
| 4. SARIF handoff | 같은 PR diff finding을 CI/security-tool friendly artifact로 넘겨야 한다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | SARIF는 GitHub code scanning이 이해하는 ruleId, result, location, evidence routing용 artifact이고, verdict 자체를 새로 만들지 않는다. | "Markdown은 사람이 읽고, SARIF는 같은 finding을 machine-readable evidence로 보존합니다." |

`PASS`는 현재 입력에서 차단 finding 없는 상태라는 뜻이다. 이 tour의 risky fixtures는 judge가 위험과 gate language를 빠르게 볼 수 있도록 만든 합성 입력이며, 실제 고객 데이터나 운영 적용을 주장하지 않는다.

## Fixture boundary

- `examples/risky-mcp.json`: MCP config stop의 합성 입력.
- `examples/risky-pr.diff`: PR diff stop과 SARIF stop의 합성 입력.
- `examples/agent-policy.yaml`: transcript/log stop의 approval boundary 정책.
- `examples/agent-transcript.log`: transcript/log stop의 합성 실행 기록.

발표 전에 저장소 루트에서 `npm run build`를 실행한다. 위 commands는 POSIX shell redirection 기준이며, 전역 설치 환경에서는 같은 surface를 `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`로 실행할 수 있다. SARIF stop의 `.agentguard-demo/agentguard.sarif`는 `--out` parent directory creation smoke로도 쓰이며, 현재 CLI는 없는 parent directory를 생성한다. Machine-facing command names, JSON/SARIF fields, rule IDs는 English-compatible contract로 둔다.

## Public reference grounding

| Reference | 빌릴 점 / borrow | 피할 점 / avoid | AgentGuard action |
|---|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, excessive agency, mitigation/control vocabulary를 빌린다. | OWASP 보증, 전체 위협 대응, 공식 검토 완료처럼 말하지 않는다. | `scan-mcp`, `scan-diff`, `scan-log` 결과를 rollout stop-control-mitigate 언어로 낮춘다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF rule, result, location, evidence routing language를 빌린다. | GitHub code scanning과 같은 역할이라고 하거나 presentation용으로 CLI/rule ID를 바꾼다고 말하지 않는다. | `scan-diff --sarif --out` artifact를 human Markdown과 같은 finding의 machine-readable handoff로 설명한다. |
| https://github.com/snyk/agent-scan | AI agents, MCP servers, agent skills처럼 category를 선명하게 나누는 framing을 빌린다. | Snyk enterprise 범위, adoption, vendor-scale coverage를 AgentGuard 범위처럼 말하지 않는다. | AgentGuard 차이는 PR diff + MCP config + transcript/log rollout evidence gate로 좁혀 말한다. |
| https://github.com/Tencent/AI-Infra-Guard | AI infrastructure guardrail과 agent workflow security category framing을 빌린다. | broad red-team platform parity나 full platform coverage를 주장하지 않는다. | 이 tour는 scanner surface를 넓히지 않고, 기존 CLI evidence를 judge path로 압축한다. |
| https://github.com/splx-ai/agentic-radar | agentic workflow, tool, MCP visibility framing을 참고한다. | dashboard, runtime observability, full workflow graph coverage를 제공한다고 말하지 않는다. | AgentGuard action은 command evidence를 `BLOCK` / `REVIEW` / `PASS` 판단 언어와 승인 문장으로 연결하는 것이다. |

## Non-claims

- 합성 fixture 기반 evidence tour이며 실제 조직명, 실제 사용자 데이터, 운영 실적을 말하지 않는다.
- 외부 reference는 설명 언어와 artifact framing을 빌리는 근거일 뿐, 인증이나 제품 동등성을 의미하지 않는다.
- Dashboard, auth, hosted SaaS, database, customer upload, broad agent-security platform coverage는 이 tour 범위가 아니다.
