# AX reference command routing card

한국어 우선 설명으로 공개 reference signal을 AgentGuard의 exact evidence command에 연결한다. CLI, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## 사용 목적

AX Rollout Guard 심사자가 "이 공개 기준을 빌렸다면 AgentGuard에서는 어떤 명령으로 증거를 보나?"를 한 장에서 확인하게 한다. 이 카드는 AgentGuard가 공개 reference를 구현했다거나 대체한다고 말하지 않고, 기존 fixture-backed command로 PR diff, MCP config, transcript/log evidence를 라우팅한다.

Fixture는 모두 synthetic commerce VOC agent 예제다. Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 아래 `node dist/index.js ...` commands를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-log`, `agentguard scan-mcp`, `agentguard scan-diff`로 실행할 수 있다.

## Public reference → AgentGuard command routing

| Public reference | Borrow | Avoid | Evidence command | Expected verdict | Judge-safe sentence |
|---|---|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, mitigation vocabulary로 transcript/log risk를 설명한다. | OWASP coverage, formal assurance, or broad security-suite claim. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` finding expected for policy-sensitive agent actions; `PASS` only after the transcript no longer violates the sample policy. | "OWASP의 agentic risk vocabulary를 빌려 transcript/log evidence를 reviewer가 이해할 언어로 좁혔습니다." |
| MCP security best practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | permission, credential, user-consent framing으로 MCP config risk를 설명한다. | MCP conformance, consent UI, OAuth/session control, or runtime enforcement claim. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK` or `REVIEW` expected for broad filesystem access and credential passthrough. | "MCP permission/credential framing을 빌려 rollout 전 수정 또는 승인 조건을 남깁니다." |
| GitHub SARIF support docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | rule-result-location artifact flow로 PR diff finding을 reviewer handoff에 연결한다. | GitHub native app, product parity, or code scanning replacement claim. | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` finding expected; command may exit expected nonzero while still writing SARIF artifact. | "GitHub SARIF reviewer flow를 빌려 AgentGuard finding을 rule/result/location evidence로 전달합니다." |

## Judge-safe routing script

1. 공개 reference는 "빌릴 vocabulary"와 "피할 claim"으로만 소개한다.
2. 바로 evidence command를 실행하거나 artifact path를 보여준다: `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `agentguard.sarif`.
3. verdict는 `PASS`, `REVIEW`, `BLOCK` 중 하나로 읽는다. `scan-diff --sarif`는 risky finding 때문에 expected nonzero가 나와도 SARIF file 자체가 reviewer artifact다.
4. `agentguard.sarif`는 로컬 재현용 root artifact 이름이며 `.gitignore`에 포함되어 있다. PR/CI에서는 필요한 경우 별도 artifact/upload step으로 보존한다.
5. 발표 문장은 "공개 기준을 제품 기능처럼 말하기"가 아니라 "공개 기준의 언어를 현재 AgentGuard evidence command에 연결하기"로 끝낸다.

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished, or adoption claim.
- No external audit badge, standards badge, or formal assurance claim.
- No statement that AgentGuard is a substitute for OWASP guidance, MCP authorization, GitHub code scanning, SAST, or a broad AI security suite.
- No product rename and no change to CLI commands, rule IDs, JSON, SARIF, API, or machine fields.
- Synthetic fixtures remain synthetic and fixture-backed: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.
