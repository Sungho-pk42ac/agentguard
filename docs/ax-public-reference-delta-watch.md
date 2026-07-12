# AX public-reference delta watch

한국어 우선으로 fresh public reference signal을 AgentGuard evidence command로 낮추는 hourly watch card입니다. 목표는 대상권 judge가 "이 팀은 unknown company problem과 public scanner ecosystem pressure를 읽고, 과장 없이, 지금 repo evidence로 바꾼다"는 흐름을 보게 하는 것입니다.

이 문서는 scanner behavior를 바꾸지 않습니다. AgentGuard, `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`, rule IDs, JSON, SARIF, API, machine fields는 English-compatible contract로 유지합니다.

## Hourly watch loop

1. Public reference signal 하나를 고른다.
2. Borrow / Avoid / AgentGuard action / Evidence command를 한 줄씩 갱신한다.
3. Evidence command는 현재 repo의 synthetic fixture만 사용한다.
4. 결과는 `README.md`, `docs/examples.md`, judge worksheet, SARIF/report handoff 중 어디에 보여줄지 적는다.

## Public reference delta table

| Public reference signal | Borrow | Avoid | AgentGuard action | Evidence command |
|---|---|---|---|---|
| [AX hackathon company-problem framing](https://hackathon.jocodingax.ai/) | Borrow: company problem, real judge, real output framing을 빌려 unknown company problem을 먼저 묻고 evidence story를 맞춘다. | Avoid: gated scoring, portal flow, private submission rule, real company data를 아는 것처럼 말하지 않는다. | AgentGuard action: company problem을 MCP permission, PR diff, transcript/log evidence 중 어디로 라우팅할지 정하고 Korean-first rollout approval 문장으로 끝낸다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: tool misuse, excessive agency, mitigation vocabulary를 agent rollout risk 설명에 빌린다. | Avoid: OWASP endorsement, complete threat coverage, external security sign-off처럼 말하지 않는다. | AgentGuard action: PR diff와 transcript/log를 tool misuse 또는 excessive agency evidence로 분리하고, approver가 볼 수정 조건을 적는다. | `node dist/index.js scan-diff < examples/risky-pr.diff` |
| [MCP security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | Borrow: permission, token, authorization, consent, least privilege framing을 MCP approval language에 빌린다. | Avoid: AgentGuard가 runtime MCP consent flow나 OAuth callback validation을 enforce한다고 말하지 않는다. | AgentGuard action: static `scan-mcp` evidence로 broad filesystem, writable path, credential passthrough를 승인 전 수정 조건에 연결한다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` |
| [Snyk `agent-scan`](https://github.com/snyk/agent-scan) | Borrow: AI agents, MCP servers, agent skills처럼 public scanner category를 선명하게 나누는 표현을 빌린다. | Avoid: 대형 vendor breadth, 운영 실적, 같은 scanner scope라고 말하지 않는다. | AgentGuard action: AgentGuard는 Korean-first rollout approval과 fixture-backed PR/MCP/transcript handoff에 집중한다고 좁혀 말한다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` |
| [Tencent `AI-Infra-Guard`](https://github.com/Tencent/AI-Infra-Guard) | Borrow: AI infra, agent scan, MCP scan, red-team ecosystem pressure가 커지고 있다는 category proof를 빌린다. | Avoid: AgentGuard가 AI-Infra-Guard breadth, deployment model, public-network posture를 가진다고 말하지 않는다. | AgentGuard action: broad platform story 대신 current local evidence surfaces와 approval owner handoff를 보여준다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-reference-delta-watch.sarif < examples/risky-pr.diff` |
| [splx-ai `agentic-radar`](https://github.com/splx-ai/agentic-radar) | Borrow: LLM agentic workflows를 scanner surface로 보는 public category proof를 빌린다. | Avoid: runtime discovery, agent workflow inventory breadth, external tool equivalence를 말하지 않는다. | AgentGuard action: agent workflow risk를 PR diff, MCP config, transcript/log review evidence로 낮춰 reviewer가 다시 실행하게 한다. | `node dist/index.js scan-diff < examples/risky-pr.diff` |
| [GitHub SARIF upload](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF artifact handoff와 code-scanning reviewer가 재실행 가능한 보안 증거를 보는 흐름을 빌린다. | Avoid: GitHub approval, 자동 업로드 구현, code-scanning 통과, 외부 보증처럼 말하지 않는다. | AgentGuard action: PR diff evidence를 SARIF file로 저장해 reviewer가 artifact와 Markdown report를 함께 검토하도록 연결한다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-reference-delta-watch.sarif < examples/risky-pr.diff` |

## Fixture-backed evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현합니다.

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-reference-delta-watch.sarif < examples/risky-pr.diff
```

Published CLI 설명에서는 같은 surface를 `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`로 읽습니다.

## Referenced repo paths

- `README.md`
- `docs/examples.md`
- `examples/risky-mcp.json`
- `examples/risky-pr.diff`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`

## Machine-contract guardrails

- CLI commands stay English-compatible: `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`.
- rule IDs stay stable for automation and reviewer search: `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment`.
- JSON, SARIF, API, and machine fields stay machine-facing. Korean-first copy explains context and approval action around those contracts.
- Static `scan-mcp` evidence is not runtime MCP consent enforcement. It is a rerunnable signal for permission and token posture review.

## Non-claim guardrails

- 말할 수 있는 것: public references에서 위험 언어와 category proof를 빌리고, AgentGuard의 current fixture-backed evidence로 PR diff, MCP config, transcript/log, SARIF artifact를 재실행한다.
- 말하지 않는 것: 실제 운영 실적, 외부 보증, 외부 scanner와 같은 범위, runtime containment 제품, all-in-one security platform.
- 회사 문제는 공개 framing만 빌린다. Gated portal detail, private scoring, real company data, real secret은 쓰지 않는다.
- Korean-first rollout approval copy may say `BLOCK -> fix condition -> PASS`, but CLI command names, rule IDs, verdict values, JSON/SARIF fields remain unchanged.
