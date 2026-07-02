# AX onsite triage card

이 카드는 AX Rollout Guard 예선/본선 현장에서 회사 문제 신호를 5분 안에 AgentGuard의 기존 증거 명령으로 연결하기 위한 한국어 우선 triage card입니다. 목표는 **회사 문제 신호 → PR diff / MCP config / agent transcript / SARIF proof → PASS/REVIEW/BLOCK evidence**를 빠르게 고르는 것입니다. 모든 입력은 현재 저장소의 합성 fixture만 사용합니다.

## 5-minute onsite triage

1. 회사 문제를 한 문장으로 줄인다: "어떤 업무 에이전트가 어떤 자료, 도구, 변경 권한을 갖는가?"
2. 아래 `Company problem signal map`에서 가장 가까운 surface를 고른다.
3. `Fixture-backed evidence commands`의 exact command를 실행해 같은 surface의 expected verdict를 보여준다.
4. `PASS`는 rollout 후보, `REVIEW`는 사람 승인 필요, `BLOCK`은 수정 전 중단으로 설명한다.
5. SARIF가 필요한 CI/security-tool 설명에서는 `agentguard.sarif` artifact path를 보여주되, GitHub code scanning을 대체한다고 말하지 않는다.

## Company problem signal map

| 회사 문제 신호 | AgentGuard surface | Existing fixture | Evidence verdict | 현장 설명 |
|---|---|---|---|---|
| "에이전트가 PR에 secret-like 값이나 위험한 shell material을 넣을 수 있다." | PR diff | `examples/risky-pr.diff` | `BLOCK` | PR 승인 전에 agent-generated diff를 멈추는 evidence gate로 설명한다. |
| "MCP filesystem 권한이 너무 넓거나 writable이다." | MCP config | `examples/risky-mcp.json` | `BLOCK` | tool misuse와 excessive agency를 운영 연결 전 통제하는 approval boundary로 설명한다. |
| "에이전트 transcript에 승인 없는 export, 민감 경로 접근, 삭제성 명령이 보인다." | agent transcript | `examples/agent-transcript.log` + `examples/agent-policy.yaml` | `REVIEW` | 로그를 사람 승인 조건으로 낮추고 제한 rollout만 허용하는 evidence로 설명한다. |
| "같은 업무 흐름을 제한된 권한으로 다시 보여줘야 한다." | MCP config / PR diff | `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`, `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `PASS` | before/after fixture로 remediation 후 승인 후보가 되는 흐름을 보여준다. |
| "CI나 security reviewer가 읽을 artifact가 필요하다." | SARIF | `examples/agentguard.sarif` | `BLOCK` finding을 machine-readable artifact로 보존 | GitHub SARIF support 형식에 맞춘 evidence handoff라고 설명한다. |

## Fixture-backed evidence commands

발표장에서 build 결과와 직접 연결하려면 먼저 `npm run build`를 실행합니다. 아래 commands는 POSIX shell(Bash, zsh, Git Bash) 기준입니다.

| Surface | exact command | Expected evidence |
|---|---|---|
| PR diff risk | `node dist/index.js scan-diff < examples/risky-pr.diff` | Expected verdict: `BLOCK`; secret-like PR material 또는 dangerous command finding을 보여준다. |
| MCP config risk | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Expected verdict: `BLOCK`; broad filesystem root, writable access, credential passthrough 같은 MCP rollout risk를 보여준다. |
| agent transcript risk | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Expected verdict: `REVIEW`; 승인 없는 shell behavior를 사람 검토 조건으로 남긴다. |
| fixed MCP control | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | Expected verdict: `PASS`; 제한된 read-only fixture root로 줄어든 상태를 보여준다. |
| fixed PR diff control | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | Expected verdict: `PASS`; 위험 입력 제거 후 같은 PR diff surface를 재검토한다. |
| SARIF proof | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff` | Expected artifact path: `agentguard.sarif`; repository sample: `examples/agentguard.sarif`. |

## Public reference grounding

| Reference | 빌릴 점 / borrow | 피할 점 / avoid |
|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic AI threats to controls / mitigations mapping을 빌려 회사 문제 신호를 AgentGuard evidence gate로 낮춘다. | generic chatbot risk copy나 OWASP 보증처럼 말하지 않는다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF가 CI-consumable security evidence artifact라는 설명과 artifact path framing을 빌린다. | GitHub security products의 역할까지 수행한다고 말하지 않는다. |
| https://www.npmjs.com/package/agent-scan | Snyk `agent-scan` npm page는 normal fetch에서 403 / blocked normal fetch로 기록한다. agent/MCP scanning category label만 참고한다. | fetch되지 않은 상세 내용을 근거로 삼거나 vendor-scale claim을 하지 않는다. |
| https://github.com/Tencent/AI-Infra-Guard | AI infrastructure guardrail category clarity를 빌린다. | Tencent project와 같은 기능 범위라고 말하지 않는다. |
| https://github.com/splx-ai/agentic-radar | agentic workflow scanning category clarity를 빌린다. | runtime monitoring이나 broad workflow scope를 제공한다고 말하지 않는다. |

## English-compatible machine contract

이 문서는 한국어 우선 설명 카드이지만 machine-facing contract는 바꾸지 않습니다.

- CLI commands: `scan-diff`, `scan-mcp`, `scan-log`
- rule IDs: 예시는 `secret.github_token`, `mcp.broad_filesystem_access`, `agent.dangerous_shell`처럼 English-compatible 값을 유지한다.
- JSON, SARIF, API, machine fields: CI parser, GitHub code scanning, shell scripts가 읽는 field names는 English-compatible로 유지한다.
- Verdict fields: `PASS`, `REVIEW`, `BLOCK`을 그대로 사용한다.
- Fixture paths and artifact paths: `examples/...`, `agentguard.sarif`를 그대로 사용한다.

## Non-claims

- 실제 사용자 데이터, real credentials, private transcript, real customer deployment evidence를 포함하지 않는다.
- 실제 조직 운영 적용 실적, 사용자 명단, 공개되지 않은 심사 포털 조건을 주장하지 않는다.
- 외부 보증이나 제품 평가 완료 상태를 주장하지 않는다.
- 외부 도구들이 맡는 기능 범위까지 수행한다고 말하지 않는다.
- 모든 agentic workflow 보안 범위를 제공한다고 말하지 않는다.
- CLI behavior, rule IDs, JSON/SARIF/API/machine fields, default severity는 이 문서로 변경하지 않는다.
