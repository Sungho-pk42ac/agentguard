# AX human approval gate checklist

## 목적

이 카드는 기업 보안/현업 책임자가 Codex, Cursor, Claude Code, MCP 서버 같은 새 agent/tool workflow를 업무에 넣기 전 60초 안에 묻는 질문을 AgentGuard의 재현 가능한 증거 명령으로 연결한다. 목표는 **한국어 승인 판단**을 빠르게 만들되, `agentguard` CLI, `PASS` / `REVIEW` / `BLOCK`, `JSON`, `SARIF`, `ruleId`, `locations` 같은 machine contract는 영어 그대로 유지하는 것이다.

AgentGuard는 여기서 pre-rollout static evidence와 reviewer handoff를 만든다. MCP 서버 실행, runtime OAuth/session enforcement, 실시간 tool interception, 자동 승인, 외부 인증을 구현했다고 말하지 않는다.

## Human approval gate route

| Human approval question | AgentGuard evidence command | Expected decision action | Rerun trigger |
| --- | --- | --- | --- |
| 이 agent가 업무 파일/토큰/PII에 과도하게 접근하는가? | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK`이면 MCP 권한·root·env를 줄인 뒤 재검사한다. `REVIEW`이면 승인자가 예외 조건을 적는다. | MCP config, agent permission, env descriptor 갱신 시 |
| PR diff에 secret/PII/위험한 설정이 들어왔는가? | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` finding은 merge 전 제거/마스킹하고, 남은 `REVIEW`는 owner와 residual risk를 남긴다. | PR diff 또는 policy 갱신 시 |
| agent transcript가 금지 명령이나 approval-required operation을 시도했는가? | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `denied-command` 또는 critical finding은 rollout pause, mitigation, rerun evidence가 필요하다. | transcript/log, policy, runbook 갱신 시 |
| reviewer/CI가 같은 증거를 artifact로 받을 수 있는가? | `mkdir -p .agentguard-demo/human-approval-gate && node dist/index.js scan-diff --sarif --out .agentguard-demo/human-approval-gate/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF는 reviewer handoff artifact다. GitHub upload, CodeQL parity, external approval 자체를 의미하지 않는다. | SARIF/report artifact 재생성 또는 CI handoff 갱신 시 |

## Exact fixture-backed commands

Fresh clone 기준:

```bash
npm ci
npm run build
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
mkdir -p .agentguard-demo/human-approval-gate && node dist/index.js scan-diff --sarif --out .agentguard-demo/human-approval-gate/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

위 명령의 source-of-record 입력은 다음 fixture다.

- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`

## Public references: Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| OWASP Agentic AI threats — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic workflow의 tool/action risk, mitigation, human review 언어 | OWASP 공식 검증·인증·동등성 또는 runtime guardrail 보장 주장 | PR diff, transcript, MCP config를 `BLOCK` / `REVIEW` / `PASS` evidence로 묶고 승인자가 mitigation을 기록하게 한다. |
| MCP Security Best Practices — https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices | least privilege, explicit consent, token boundary, authorization boundary vocabulary | AgentGuard가 MCP 서버를 실행하거나 OAuth/session/consent enforcement를 구현했다는 주장 | `scan-mcp`로 broad filesystem, writable path, env/token exposure를 사전 승인 질문으로 전환한다. |
| GitHub SARIF support — https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | SARIF reviewer artifact, `ruleId`, `locations`, code scanning handoff language | 자동 SARIF upload, GitHub approval, CodeQL parity, 외부 승인 주장 | `scan-diff --sarif --out`으로 reviewer가 같은 PR evidence를 재검토할 수 있는 artifact를 만든다. |

## Machine contracts

- CLI surface names stay English-compatible: `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`, `--policy`, `--sarif`, `--out`, `--json`.
- Verdict and artifact fields stay machine-readable: `PASS`, `REVIEW`, `BLOCK`, `JSON`, `SARIF`, `ruleId`, `locations`, `level`, `message`.
- Human-facing Markdown can be Korean-first; command names, rule IDs, JSON/SARIF fields, and exit-code semantics are not translated or renamed.

## Non-claim guardrails

- No fake customer adoption, 고객사 도입 완료, production case study, active users, or enterprise client claims.
- No SOC 2, ISO 27001, OWASP/MCP/GitHub/Snyk certification, conformance, endorsement, or official approval claims.
- No Snyk, GitHub code scanning, CodeQL, OWASP, MCP, or public scanner replacement/parity/equivalence claims.
- No runtime OAuth/session/consent/tool-interception enforcement claims unless a future implementation and tests actually add that behavior.
- No claim that SARIF artifact creation equals automatic GitHub upload, reviewer approval, or business approval.
