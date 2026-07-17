# AX guardrail review checkpoints

한국어 우선 운영 카드다. unknown **company problem**을 받은 뒤 AI agent/tool rollout을 바로 승인하지 말고, public guardrail/security reference에서 빌린 질문을 AgentGuard의 현재 fixture-backed evidence command로 낮춰 묻는다. 이 문서는 scanner behavior, CLI option, rule ID, JSON/SARIF schema, policy default, package publishing을 바꾸지 않는다.

## 목적

현장 심사나 기업 보안 리뷰에서 "이 agent workflow를 배포해도 되나?"라는 질문이 나오면, 대답은 agent self-report가 아니라 재실행 가능한 증거여야 한다. 이 카드는 human oversight, least privilege, tripwire, reviewer handoff 언어를 exact command와 owner decision으로 연결한다.

## Public references: Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| OWASP Agentic AI Threats and Mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Borrow: human oversight, threat mitigation, tool abuse, sensitive-data exposure 질문을 owner review language로 빌린다. | Avoid: OWASP endorsement, formal coverage, or assurance claim. | PR diff와 transcript/log finding을 `BLOCK` / `REVIEW` owner decision으로 낮춘다. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Borrow: least privilege, scope minimization, token boundary, tool access review vocabulary. | Avoid: runtime MCP enforcement, OAuth/session validation, or MCP conformance claim. | `scan-mcp` evidence로 broad filesystem, writable root, env token 위험을 security owner에게 넘긴다. |
| GitHub SARIF support — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | Borrow: SARIF `ruleId`, location, artifact, reviewer handoff vocabulary. | Avoid: automatic upload, GitHub approval, or Code Scanning replacement claim. | SARIF artifact를 reviewer-owned archive/upload input으로 제시한다. |
| OpenAI Guardrails Python — https://openai.github.io/openai-guardrails-python/ | Borrow: guardrail/tripwire framing: suspicious input/output should trigger a decision path. | Avoid: claiming AgentGuard runs OpenAI guardrails or is endorsed by OpenAI. | AgentGuard findings를 rollout 전 tripwire checkpoint와 rerun trigger로 설명한다. |

## Guardrail checkpoint map

| Guardrail question | Owner | AgentGuard evidence | Approval decision | Rerun trigger |
| --- | --- | --- | --- | --- |
| agent-generated PR delta가 business rollout 후보로 안전한가? | business owner + evidence owner | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK`이면 rollout 중지, `REVIEW`이면 fix/policy 조건을 적고 같은 PR diff evidence를 재실행한다. | PR diff, policy, or build artifact가 바뀌면 재실행 |
| MCP/tool permission이 least privilege와 workspace trust boundary를 지키는가? | security owner | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | broad root, writable path, env token surface가 있으면 permission 축소 전까지 `BLOCK` 또는 conditional `REVIEW`로 둔다. | MCP config, agent tool list, workspace path가 바뀌면 재실행 |
| transcript/log의 approval-required operation을 human oversight로 설명할 수 있는가? | pilot owner + security owner | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | denied command나 민감 동작은 owner, residual risk, mitigation condition이 없으면 승인하지 않는다. | transcript, policy YAML, or agent prompt가 바뀌면 재실행 |
| reviewer channel로 같은 finding을 artifact handoff할 수 있는가? | evidence owner + reviewer | `node dist/index.js scan-diff --sarif --out .agentguard-demo/guardrail-review/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF는 reviewer handoff source-of-record다. 승인 자체가 아니라 review input이다. | PR diff 또는 SARIF/report artifact path가 바뀌면 재생성 |

## Exact fixture-backed commands

모든 명령은 합성 fixture만 사용한다. fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 아래 commands를 저장소 루트에서 실행한다.

```bash
node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
mkdir -p .agentguard-demo/guardrail-review
node dist/index.js scan-diff --sarif --out .agentguard-demo/guardrail-review/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Expected reading:

- PR diff evidence should preserve English-compatible finding IDs such as `generic-secret-assignment` or `denied-command` when present.
- MCP evidence should preserve `scan-mcp` permission findings as static config review input.
- Transcript evidence should preserve `scan-log` and policy-backed owner questions.
- SARIF output should preserve `SARIF`, `ruleId`, `severity`, and artifact location fields for reviewer handoff.

## Machine contracts

- `PASS`, `REVIEW`, `BLOCK` stay English machine verdicts.
- `scan-diff`, `scan-mcp`, `scan-log` stay CLI/machine command names.
- `JSON`, `SARIF`, `ruleId`, `severity`, `locations` stay artifact contract vocabulary.
- Korean copy is for human approval, remediation, residual-risk, and rerun wording only.

## Non-claim guardrails

- No claim that AgentGuard runs OpenAI guardrails.
- No claim that AgentGuard implements runtime MCP authorization.
- No automatic SARIF upload claim.
- No customer adoption, certification, scanner parity, or hosted dashboard claim.
- Public references are framing inputs only; they do not approve, certify, or endorse AgentGuard.
- This card documents static fixture-backed evidence. It does not add runtime guardrail enforcement, OAuth/session validation, consent UI, or hosted approval workflow.
