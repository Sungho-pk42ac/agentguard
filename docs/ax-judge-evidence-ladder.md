# AX judge evidence ladder

이 문서는 예선/본선 심사자가 AgentGuard -> AX Rollout Guard 흐름을 30초 안에 검증하도록 만든 한국어 우선 한 장짜리 evidence ladder입니다. 목표는 public reference -> exact command -> fixture -> expected verdict -> business approval sentence를 한 줄로 연결하는 것입니다.

## Public reference grounding

| Public reference | borrow | avoid | slice-shape |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, agent rollout risk vocabulary | OWASP certification, external endorsement, broad threat-scope claim | 위험 설명을 "에이전트가 무엇을 읽고 실행할 수 있는가"와 "어떤 승인 조건이면 멈추는가"로 좁힌다. |
| MCP security best practices: https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | permission, token, tool boundary, credential passthrough framing | MCP conformance, certification, standard-wide scope claim | `scan-mcp` command는 broad filesystem, writable path, credential passthrough를 rollout approval condition으로 매핑한다. |
| Snyk agent-scan: https://github.com/snyk/agent-scan | AI agent activity scanning category가 심사자에게 이해되는 표현 | same product scope, market signal, Snyk와 같은 coverage claim | AgentGuard는 PR diff, MCP config, transcript/log evidence를 묶는 rollout gate로 구분한다. |
| GitHub code scanning/SARIF docs: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | developer-facing artifact, CI evidence, machine-readable report framing | GitHub native tool role claim, same feature scope claim | commands는 reviewer artifact를 만드는 입력이며 JSON/SARIF machine contracts는 영어 식별자를 유지한다. |

## 30-second ladder

준비: fresh clone에서는 아래 `node dist/index.js ...` command를 실행하기 전에 `npm ci && npm run build`로 `dist/` CLI artifact를 먼저 생성합니다.

| Step | public reference signal | exact command | fixture | expected verdict | evidence for judge | business approval sentence |
|---|---|---|---|---|---|---|
| 1. MCP permission risk | MCP security best practices의 permission, token, tool boundary framing | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `BLOCK` | broad filesystem root, writable access, credential env passthrough가 MCP server 설정에 남아 있음을 승인 조건으로 연결한다. | "MCP config가 넓은 filesystem root, write-capable 권한, credential passthrough를 열기 때문에 fixture 전용 root와 read-only 권한으로 줄이기 전에는 운영 연결을 승인하지 않습니다." |
| 2. MCP permission fix | MCP least-permission framing을 같은 surface에서 재검토 | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS` | 같은 MCP rollout surface가 read-only fixture root로 줄어든 경우를 보여준다. | "MCP 권한이 fixture 전용 read-only root로 축소되어 `PASS` evidence가 남았으므로, VOC 자동화는 제한된 권한 조건에서만 승인 후보로 봅니다." |
| 3. PR diff review risk | OWASP tool misuse/excessive agency vocabulary와 Snyk-style agent activity scan framing | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `REVIEW` | VOC agent PR diff에 synthetic secret-like material과 PII-shaped reviewer input이 들어간 상태를 rollout 전 reviewer evidence로 보여준다. | "PR diff의 agent rollout 위험이 `REVIEW`로 확인됐으므로, secret-like material과 PII-shaped input을 제거하기 전에는 사람 승인 없이 배포하지 않습니다." |
| 4. PR diff fix | GitHub code scanning/SARIF docs의 developer-facing artifact framing | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `PASS` | 같은 PR diff surface를 재실행해 위험 입력 제거 후 reviewer artifact로 남긴다. | "수정 PR diff가 같은 command에서 `PASS`로 재검증되었으므로, reviewer는 이 변경을 제한된 rollout 승인 후보로 볼 수 있습니다." |
| 5. Transcript approval risk | OWASP tool misuse/excessive agency vocabulary와 GitHub-style reviewer artifact framing | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` plus `examples/agent-policy.yaml` | `REVIEW` | transcript/log에 승인 없는 export와 삭제성 shell behavior가 남으면 사람이 확인해야 할 운영 승인 근거가 된다. | "transcript/log에 approval-required tool behavior가 `REVIEW`로 남았으므로, 담당자 확인과 제한된 rollout 조건을 승인 리포트에 남긴 뒤에만 진행합니다." |

## Judge talk track

1. "AgentGuard는 지금 PR diff, MCP config, transcript/log를 검사합니다."
2. "OWASP와 MCP 자료는 risk language와 permission framing을 빌리는 근거이며, 인증이나 제품 보증을 뜻하지 않습니다."
3. "`scan-mcp`, `scan-diff`, `scan-log` 세 command가 commerce VOC rollout fixture를 서로 다른 surface에서 검사합니다."
4. "`BLOCK`은 배포 중단 근거, `REVIEW`는 사람 승인 조건, `PASS`는 같은 surface 재검토 후 승인 후보 evidence입니다."

## Honesty guardrails

- 이 문서는 합성 fixture 기반 judge handoff입니다. 실제 운영 도입, 실제 고객, 외부 기관 인증, 외부 보증을 주장하지 않습니다.
- AgentGuard를 Snyk, GitHub security products, OWASP, MCP tooling과 같은 범위라고 말하지 않습니다.
- 이 slice는 CLI behavior, scanner rule, default severity, policy behavior를 바꾸지 않습니다.
- machine-facing strings는 그대로 유지합니다: `node dist/index.js scan-diff`, `scan-mcp`, `scan-log`, `BLOCK`, `REVIEW`, `PASS`, JSON/SARIF fields.
