# AX first-60-seconds evidence priority card

한국어 우선 priority card로 AX 인재전쟁 심사자나 현장 operator가 시간이 1분뿐일 때 어떤 기존 AgentGuard evidence를 먼저 보여 줄지 고정한다. 목표는 회사 문제, 현업성, 결과물성, 재현성, honest boundaries를 한 장에서 읽게 하는 것이다.

범위는 현재 저장소의 synthetic fixture-backed evidence와 이미 있는 docs path뿐이다. Scanner behavior, CLI commands, rule IDs, JSON, SARIF, API machine fields는 이 카드로 바꾸지 않는다.

## 첫 60초 우선순위

1. 0-15초: 회사 문제를 먼저 말한다. "커머스 VOC agent rollout에서 PR diff, MCP config, transcript/log가 배포 전 gate를 지나야 한다."
2. 15-35초: `BLOCK`이 왜 rollout stop인지 보여 준다. MCP broad filesystem access와 credential passthrough는 agent/tool misuse blast radius를 키운다.
3. 35-50초: 같은 finding을 사람이 읽는 Markdown과 reviewer artifact인 SARIF로 나눠 보여 준다.
4. 50-60초: 한계를 말한다. 지금 evidence는 static pre-rollout check이고, MCP runtime authorization, hosted dashboard, hidden judging rubric을 안다고 말하지 않는다.

## Evidence priority table

| Priority | Judge/operator should show first | Exact fixture-backed command | Existing evidence/doc path | Why it matters in the first minute |
|---|---|---|---|---|
| 1 | MCP permission blast radius | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json`, `docs/ax-mcp-consent-token-handoff.md` | `mcp.broad_filesystem_access` 같은 rule IDs로 broad root, writable path, credential passthrough를 보여 주고 `BLOCK`이면 운영 연결을 멈춘다. |
| 2 | PR diff reviewer risk | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff`, `docs/ax-90-second-judge-evidence-tour.md` | `secret.github_token` 같은 PR diff signal을 먼저 보여 주면 결과물성 and 재현성이 바로 보인다. |
| 3 | Agent transcript/log approval | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log`, `docs/ax-prompt-injection-evidence-routing-card.md` | tool misuse나 approval-required action을 transcript/log evidence로 연결해 현업 reviewer가 남길 질문을 만든다. |
| 4 | SARIF reviewer handoff | `mkdir -p .agentguard-demo && node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff`, `docs/ax-sarif-reviewer-loop-card.md` | GitHub code scanning이 읽는 SARIF artifact framing을 빌려 같은 PR diff finding을 reviewer channel로 보낸다. |

`PASS`는 현재 입력에서 차단 finding이 없다는 뜻이다. `REVIEW`는 사람이 residual risk와 owner를 남겨야 한다는 뜻이다. `BLOCK`은 rollout stop 또는 수정 후 재스캔 조건이다.

## Existing evidence paths

- `docs/ax-90-second-judge-evidence-tour.md`: 첫 설명이 60초를 넘을 때 이어서 쓰는 longer tour.
- `docs/ax-mcp-consent-token-handoff.md`: MCP least-privilege, user consent, token boundary 질문을 담당자에게 넘기는 카드.
- `docs/ax-sarif-reviewer-loop-card.md`: SARIF/report handoff와 reviewer approval condition을 보여 주는 카드.
- `docs/ax-prompt-injection-evidence-routing-card.md`: OWASP agent/tool misuse framing을 transcript/log, MCP config, PR diff evidence로 라우팅하는 카드.
- `examples/risky-mcp.json`: MCP config synthetic fixture.
- `examples/risky-pr.diff`: PR diff synthetic fixture.
- `examples/agent-policy.yaml`: transcript/log policy fixture.
- `examples/agent-transcript.log`: agent transcript/log synthetic fixture.

Fresh clone에서는 repository root에서 `npm ci && npm run build` 후 위 `node dist/index.js ...` commands를 실행한다. `--out .agentguard-demo/agentguard.sarif`는 CLI가 parent directory를 만들어 주는 built-artifact smoke 대상이며, `.agentguard-demo/`는 제출 repo가 아니라 재생성 가능한 local evidence directory로 둔다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`로 실행할 수 있다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, excessive agency, mitigation/control vocabulary. | Do not imply OWASP endorsement, complete mitigation scope, or external assurance. | Put MCP, PR diff, and transcript/log evidence into threat-to-evidence priority order. |
| MCP security best practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, user consent, token security, confused-deputy, authorization boundary language. | Do not imply runtime MCP enforcement, OAuth/session control, or consent UI behavior. | Use `agentguard scan-mcp` evidence to raise owner questions about broad root, writable path, and credential passthrough. |
| GitHub SARIF code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF rule/result/location artifact and reviewer-channel framing. | Do not imply native GitHub product status, automatic upload, or security-product scope. | Keep `agentguard scan-diff --sarif --out .agentguard-demo/agentguard.sarif` as machine-readable handoff for the same PR diff evidence. |

## Boundary notes

- This card compresses existing evidence order for 대상권/AX judging; it does not add scanner behavior.
- Synthetic fixtures remain synthetic and do not represent real customer data, field rollout proof, or live company telemetry.
- CLI commands, rule IDs, JSON, SARIF, API, package metadata, and verdict vocabulary stay English-compatible.
- The card does not claim MCP runtime control, GitHub account workflow automation, SaaS dashboard/auth, dashboard evidence, or private judging-material knowledge.
