# AX real judge demo map

## 사용 목적

대상권/AX 인재전쟁 심사자가 30초 안에 "공식 문제 언어"와 AgentGuard의 실제 증거 명령을 연결하도록 돕는 한국어 우선 데모 지도입니다.

이 문서는 공개 페이지와 공개 보안 참고자료의 표현을 빌려 현재 저장소의 synthetic fixture 명령에 매핑합니다. gated portal 세부 내용, 최종 기업 문제 내용, 운영 조직 실명 사례, 외부 기관 보증, MCP 실행 통제는 주장하지 않습니다.

## Public references

| Public reference | borrow | avoid | slice-shape |
| --- | --- | --- | --- |
| https://hackathon.jocodingax.ai/ | REAL PROBLEM / REAL JUDGE / REAL OUTPUT, company problem, working result framing | gated portal 세부 내용이나 최종 기업 문제를 안다는 표현 | 공개 문구를 현재 AgentGuard evidence command로 번역 |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, sensitive data exposure | 외부 기관의 endorsement/certification처럼 읽히는 표현 | finding 언어를 agentic risk vocabulary에 맞춤 |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, consent, authorization, excessive scope | AgentGuard가 MCP 서버 동작을 직접 통제한다는 표현 | MCP config 위험 설명을 최소 권한과 과도한 scope 관점으로 설명 |
| https://github.com/snyk/agent-scan | AI agent/MCP/skill scanner category | Snyk와 동일 제품이거나 기존 보안 플랫폼을 갈아치운다는 표현 | PR diff + MCP config + transcript + 한국어 승인 evidence 차이를 설명 |

## REAL PROBLEM

기업이 AX agent를 붙이면 agent가 PR diff, MCP config, transcript/log에 걸쳐 다음 위험을 동시에 만듭니다.

- PR diff에 secret-shaped token, PII, risky shell material이 들어갈 수 있습니다.
- MCP config가 broad filesystem root, writable path, credential passthrough처럼 excessive scope를 줄 수 있습니다.
- agent transcript에는 사람이 승인해야 할 shell action과 sensitive path 접근이 남습니다.

AgentGuard의 데모 문제 정의는 "agent rollout 전에 이 위험을 사람이 승인 가능한 증거로 바꾸는가?"입니다.

## REAL JUDGE

심사자가 바로 확인해야 하는 질문은 세 가지입니다.

- 한국어 현업 담당자가 결과를 읽고 승인 조건을 말할 수 있는가?
- 공식/public risk vocabulary인 tool misuse, excessive agency, sensitive data exposure, least privilege, consent, authorization, excessive scope와 연결되는가?
- 실제 fixture-backed command가 PR diff, MCP config, agent transcript를 각각 재현하는가?

## REAL OUTPUT

기대 출력은 거창한 플랫폼 설명이 아니라 현재 CLI에서 바로 나오는 evidence입니다.

- `scan-diff`: PR diff에서 secret-shaped 또는 risky change를 잡아 `BLOCK`/`REVIEW` 판단 근거를 만듭니다.
- `scan-mcp`: MCP config에서 broad filesystem access, writable root, credential passthrough를 찾아 least privilege 검토로 연결합니다.
- `scan-log`: agent transcript에서 shell action과 sensitive path risk를 찾아 승인 조건 문장으로 연결합니다.

## Exact evidence commands

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

심사 데모에서는 위 세 명령을 순서대로 보여주고, finding을 다음 문장으로 접습니다.

1. REAL PROBLEM: agent rollout 입력물이 PR diff, MCP config, transcript로 흩어져 있습니다.
2. REAL JUDGE: 현업 승인자는 `BLOCK`/`REVIEW` 근거와 조건을 한국어로 확인해야 합니다.
3. REAL OUTPUT: AgentGuard가 현재 fixture에서 위험 근거를 보여주고, 수정/정책 조건으로 넘어갈 수 있게 합니다.

## Approval sentence

승인 문장 예시:

> 이 AX agent rollout은 PR diff의 secret-shaped change, MCP config의 broad writable scope, transcript의 review-required shell action이 해소되거나 정책 승인 조건에 묶일 때만 다음 단계로 진행한다.

## Forbidden claims

이 데모에서 말하지 않는 것:

- 공개되지 않은 portal 세부 내용이나 최종 기업 문제 내용을 알고 있다는 표현.
- 운영 조직의 실명 사례나 외부 채택 실적이 있다는 표현.
- 외부 기관이나 행사 주최 측의 인증·검증·승인·보증 표현.
- AgentGuard가 Snyk, GitHub security products, SAST, DAST, CNAPP 같은 기존 도구군과 같은 범위를 제공한다는 표현.
- AgentGuard가 MCP 서버 실행에 직접 개입하거나 권한 결정을 독자적으로 내린다는 표현.
