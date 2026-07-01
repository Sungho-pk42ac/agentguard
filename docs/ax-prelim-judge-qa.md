# AX prelim judge Q&A answer bank

이 문서는 AX Rollout Guard 예선 심사에서 나올 수 있는 날카로운 질문에 한국어로 짧게 답하기 위한 answer bank입니다. 현재 증거는 synthetic fixture 기반이며, gated portal 세부 형식이 열리면 같은 질문 구조와 evidence command를 회사 문제에 맞게 adaptable 하게 바꾸는 용도입니다.

## Public reference signals

| Public signal | Borrow | Avoid | Answer-bank use |
|---|---|---|---|
| https://hackathon.jocodingax.ai/ | 기업 실제 문제, 기업 실무자/AI 직접 평가, 성과를 증명·설득·납득시키는 제출 framing | gated portal 세부 조건이나 비공개 과제를 아는 것처럼 말하지 않는다. | 답변은 "현재 synthetic 증거를 회사 문제에 맞게 바꿔 제출한다"로 시작한다. |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, agent 권한 완화라는 agentic risk vocabulary | OWASP 인증, 전체 threat coverage, 외부 검증을 주장하지 않는다. | 위험 질문에는 "무엇을 읽고 실행할 수 있는가"와 "어떤 승인 조건이면 멈추는가"로 답한다. |
| https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | MCP permission, token passthrough, confused deputy, SSRF, session/tooling risk framing | MCP 규격 적합성이나 공식 검증을 주장하지 않는다. | MCP 질문에는 broad filesystem, writable root, credential passthrough를 승인 전 차단 조건으로 설명한다. |
| https://github.com/snyk/agent-scan | agent component inventory/scanning category를 심사자가 이해하기 쉬운 언어 | 기업용 스캐너와 같은 범위라고 말하지 않는다. | AgentGuard는 PR diff, MCP config, transcript/log rollout evidence에 집중한다고 구분한다. |

## Hard judge questions

| Judge question | Concise answer script | Evidence to point at | Guardrail |
|---|---|---|---|
| "이게 기업 실제 문제와 무슨 관련이 있나요?" | "커머스 VOC 에이전트가 고객 export, PR 변경, 운영 transcript에 접근할 때 위험 권한과 secret-like 입력을 rollout 전에 멈추는 문제로 좁혔습니다. 지금 저장소 증거는 synthetic 이지만, 같은 command와 report 구조를 기업 fixture로 바꿀 수 있습니다." | `examples/enterprise-scenarios/commerce-voc-agent/` | 실제 고객 데이터나 운영 실적을 말하지 않는다. |
| "단순 scanner 아닌가요?" | "목표는 범용 scanner가 아니라 AX Rollout Guard pass입니다. PR diff, MCP config, transcript/log 세 surface에서 `BLOCK`, `REVIEW`, `PASS`와 승인 조건을 남겨 실무자가 출시 여부를 판단하게 합니다." | `docs/ax-judge-evidence-index.md`, `docs/ax-prelim-submission-pack.md` | 다른 보안 제품과 같은 범위라고 말하지 않는다. |
| "agentic AI 위험을 어떻게 설명하나요?" | "OWASP agentic vocabulary로는 tool misuse와 excessive agency를 줄이는 slice입니다. AgentGuard는 에이전트가 너무 넓은 filesystem 권한을 받거나 secret-like material을 PR에 싣는 순간 rollout을 멈추는 evidence를 만듭니다." | `secret.github_token`, `mcp.broad_filesystem_access` | OWASP 인증이나 coverage claim을 하지 않는다. |
| "MCP는 어떤 기준으로 보나요?" | "MCP public guidance의 permission, token passthrough, confused deputy, SSRF risk framing을 빌립니다. 이 저장소 slice에서는 broad filesystem root, writable path, credential passthrough를 사람이 승인해야 할 조건으로 표시합니다." | `agentguard scan-mcp` command | MCP 공식 적합성 표현을 쓰지 않는다. |
| "왜 예선에서 설득력이 있나요?" | "AX public page가 말하는 성과 증명 방향에 맞춰, 위험 입력을 보여주고 같은 surface에서 승인 조건을 설명합니다. 심사자는 데모 설명이 아니라 command, fixture, expected verdict를 바로 확인할 수 있습니다." | 아래 Evidence commands | gated portal 세부 평가표를 안다고 말하지 않는다. |
| "한 시간 안에 회사 문제가 바뀌면요?" | "문제 업종이 바뀌어도 surface는 PR diff, MCP config, transcript/log로 유지합니다. 회사 용어와 fixture만 바꾸고, `BLOCK → 수정 조건 → PASS` 설명은 유지합니다." | `docs/ax-onsite-pivot-guide.md` | 모든 업종을 이미 다룬다고 말하지 않는다. |

## Evidence commands

Run after `npm run build` so `node dist/index.js` exists.

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

Fixture paths:

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`

Expected use in Q&A:

- `scan-diff`: PR에 secret-like material이나 risky shell material이 보이면 rollout 전에 reviewer가 확인한다.
- `scan-mcp`: MCP config가 broad filesystem, writable path, token passthrough 위험을 열면 승인 조건을 좁힌다.
- `scan-log`: transcript/log가 정책상 review-required shell behavior를 보이면 운영 담당자가 멈출 근거를 남긴다.

## Non-claim guardrails

- 현재 문서는 synthetic fixture 기반 answer bank이며, 실제 조직 데이터, 고객명, 운영 실적을 말하지 않는다.
- 공개 AX page는 제출 framing 근거로만 사용한다. gated portal 세부 형식이나 비공개 평가 항목은 안다고 말하지 않는다.
- OWASP와 MCP reference는 risk language 근거이다. 인증, 공식 검증, 적합성 보장을 말하지 않는다.
- Snyk agent-scan은 agent component inventory/scanning category를 설명하는 참고점이다. AgentGuard는 현재 PR diff, MCP config, transcript/log rollout evidence에 집중한다.
- 이 slice는 docs/test contract만 추가한다. CLI behavior, rule IDs, verdict semantics, fixture contents를 바꾸지 않는다.
