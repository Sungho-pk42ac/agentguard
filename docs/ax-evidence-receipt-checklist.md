# AX evidence receipt checklist

이 문서는 AX Rollout Guard 심사자와 reviewer가 **한국어 우선 evidence receipt**를 같은 형식으로 확인하게 만드는 체크리스트입니다. 범위는 PR diff, MCP, transcript/log, SARIF/reviewer handoff 증거를 현재 저장소 fixture와 command로 남기는 것뿐입니다. CLI behavior, scanner rules, package publishing, JSON/SARIF machine contracts는 바꾸지 않습니다.

## Evidence receipt format

각 receipt는 한 surface마다 아래 필드를 채웁니다.

| Field | 작성 기준 |
|---|---|
| Surface | `PR diff`, `MCP`, `transcript/log`, `SARIF`, `reviewer handoff` 중 하나를 적는다. |
| Exact command | 저장소 루트에서 실행한 command를 그대로 붙인다. |
| Fixture path | 입력 fixture의 상대 경로를 적고, 합성 fixture임을 명시한다. |
| Verdict | `PASS`, `REVIEW`, `BLOCK` 중 observed verdict를 적는다. |
| Evidence artifact | Markdown report, SARIF file, transcript snippet, reviewer note path를 적는다. |
| Business approval condition | 배포 승인 또는 중단 조건을 한국어로 한 문장 적는다. |
| Residual risk | fixture 기준 한계와 운영 적용 전 확인할 남은 리스크를 적는다. |

## Surface checklist

| Surface | Receipt check | Reviewer question |
|---|---|---|
| PR diff | risky change가 `scan-diff` evidence로 남았고 fixture path가 receipt에 있다. | "이 diff를 사람이 보기 전에 merge해도 되는가?" |
| MCP | filesystem scope, writable path, credential passthrough가 `scan-mcp` evidence로 남았다. | "이 MCP 권한을 운영 agent에 그대로 줄 수 있는가?" |
| transcript/log | agent shell behavior와 approval-required action이 `scan-log --policy` evidence로 남았다. | "agent가 승인 없이 실행한 행동을 추적할 수 있는가?" |
| SARIF | 같은 finding을 SARIF artifact로 넘기며 Markdown 설명과 machine fields를 섞지 않는다. | "CI/security tooling으로 route할 artifact가 있는가?" |
| reviewer handoff | command, fixture, verdict, approval condition, residual risk가 한 receipt에 묶인다. | "reviewer가 재실행하거나 보류 결정을 내릴 enough evidence가 있는가?" |

## Fixture-backed commands

아래 command는 모두 현재 저장소의 합성 fixture만 사용합니다. 발표 전 `npm run build` 후 저장소 루트에서 실행합니다.

| Surface | Exact command | Fixture path | Receipt note |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` | PR diff receipt에는 risky line, rule ID, `REVIEW` 또는 `BLOCK` reason을 적는다. |
| MCP | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | MCP receipt에는 broad root, writable access, credential passthrough 여부를 적는다. |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | transcript/log receipt에는 approval-required tool behavior와 reviewer owner를 적는다. |
| SARIF/reviewer handoff | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff` | SARIF receipt에는 artifact path, rule ID, Markdown handoff 위치를 함께 적는다. |

## Public reference borrow/avoid guide

| Public reference | Borrow | Avoid |
|---|---|---|
| AX 인재전쟁: https://hackathon.jocodingax.ai/ | REAL PROBLEM, REAL JUDGE, REAL OUTPUT framing을 빌려 "회사 문제 → command → verdict → 승인 조건" receipt로 낮춘다. | 실제 기업 채택, 운영 실적, 채용 결과, 외부 보증을 AgentGuard 성과처럼 말하지 않는다. |
| OWASP Agentic AI threats/mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, sensitive data, mitigation/control vocabulary를 빌려 receipt의 risk language를 선명하게 한다. | OWASP가 AgentGuard를 보증했거나 모든 agentic threat를 다룬다고 말하지 않는다. |
| GitHub SARIF support: https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | SARIF `rules`, `results`, `locations` 같은 machine-readable handoff vocabulary를 빌린다. | GitHub security products 역할을 수행한다거나 GitHub artifact가 human approval을 대신한다고 말하지 않는다. |
| Snyk agent-scan: https://github.com/snyk/agent-scan | public agent-security scanner가 agent, MCP server, skill 같은 surface를 나누는 방식을 참고한다. | Snyk agent-scan과 같은 product scope, market adoption, enterprise coverage를 주장하지 않는다. |

## Reviewer handoff receipt

```text
Surface:
Exact command:
Fixture path:
Observed verdict:
Evidence artifact:
Business approval condition:
Residual risk:
Reviewer owner:
```

Guardrails:

- 이 receipt는 합성 fixture 기반 evidence handoff입니다.
- 실제 고객, 실제 secret, 실제 transcript, private log를 넣지 않습니다.
- CLI commands, rule IDs, verdict values, JSON/SARIF fields는 English-compatible machine contract로 유지합니다.
- 외부 reference는 설명 언어와 reviewer framing을 빌리는 근거이며, AgentGuard의 외부 보증이나 동등 범위 주장이 아닙니다.
