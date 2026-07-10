# AX timeboxed escalation drill

한국어 우선 AX Rollout Guard 운영 카드다. 목표는 AgentGuard가 `BLOCK` / `REVIEW` / `PASS`를 반환했을 때 누가 응답을 소유하고, 몇 분 또는 몇 시간 안에 판단하며, 어떤 evidence command와 artifact를 남기고, 언제 rerun하는지 한 장에서 고정하는 것이다.

범위는 문서, synthetic fixture, 기존 evidence command뿐이다. Scanner behavior, CLI flags, policy defaults, package metadata, dashboard/SaaS/auth, real customer data는 바꾸지 않는다.

## purpose

현장 운영자는 verdict를 "좋음/나쁨"으로 읽지 않고 escalation clock으로 읽는다. `BLOCK`은 rollout 중지와 수정 owner 지정, `REVIEW`는 사람 승인 조건 기록, `PASS`는 현재 fixture 기준 blocker 없음과 다음 update 시 재실행으로 연결한다.

이 카드는 AgentGuard가 runtime prevention을 제공한다고 말하지 않는다. AgentGuard evidence는 PR diff, MCP config, transcript/log, SARIF handoff를 다시 실행 가능한 command와 artifact로 남기고, human oversight와 business/security owner 판단으로 넘긴다.

## verdict escalation card

| AgentGuard verdict | Response owner | Timebox | Evidence command/artifact | Rerun trigger |
| --- | --- | --- | --- | --- |
| `BLOCK` | security owner + business owner가 rollout stop을 소유하고 remediation owner를 지정한다. evidence owner는 같은 fixture에서 command 재현을 소유한다. | 즉시 stop, 15분 안에 owner 지정, 2시간 안에 fix/policy condition 초안 작성. | `node dist/index.js scan-diff < examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff`, `node dist/index.js scan-mcp < examples/enterprise-scenarios/travel-reservation-agent/risky-mcp.json`, 또는 `.agentguard-demo/timeboxed-escalation.sarif` SARIF artifact. | secret-like diff 제거, MCP permission 축소, transcript/policy 보완, 또는 remediation owner의 수정 완료 알림이 있으면 same command로 rerun한다. |
| `REVIEW` | security owner가 residual risk 판단을 소유하고, business owner가 제한 rollout 여부를 소유한다. evidence owner는 reviewer memo에 command와 artifact path를 남긴다. | 30분 안에 reviewer 지정, same business day 안에 승인 조건/제한 조건/보류를 기록. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, and `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` plus JSON/SARIF reviewer note when needed. | approver가 허용 조건을 조정하거나, policy YAML, transcript/log, MCP config, PR diff가 updated되면 rerun한다. |
| `PASS` | pilot owner + business owner가 현재 fixture 기준 rollout candidate 판단을 소유한다. evidence owner는 command receipt와 commit/SHA를 기록한다. | next rollout checkpoint 전에 기록하고, 동일 범위에서는 24시간 freshness check에서 확인. | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff`, plus `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` equivalent commands from this card when the current fixture is clean. | PR diff, MCP config, policy, transcript/log, scanner version, or rollout scope가 updated되면 rerun한다. 다음 pilot wave 전에도 freshness rerun을 수행한다. |

Operator rule: `BLOCK`과 `REVIEW`가 함께 나오면 더 높은 escalation clock인 `BLOCK`을 먼저 적용한다. `PASS`는 현재 synthetic fixture와 current command에 대한 evidence state이지 production safety 보증이 아니다.

## fixture-backed evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 실행한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

| Surface | Exact command | Expected evidence | Drill handoff |
| --- | --- | --- | --- |
| BLOCK PR diff escalation | `node dist/index.js scan-diff < examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff` | Markdown report with `BLOCK` verdict and English-compatible rule IDs. | PR owner와 security owner가 secret-like diff, risky shell, export text를 remediation list로 옮긴다. |
| BLOCK MCP permission escalation | `node dist/index.js scan-mcp < examples/enterprise-scenarios/travel-reservation-agent/risky-mcp.json` | Markdown report with `BLOCK` verdict for broad filesystem, writable path, or credential passthrough posture. | MCP/tool owner가 filesystem root, write access, token passthrough 축소 조건을 적는다. |
| REVIEW commerce PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Markdown report with `REVIEW` verdict for a reviewer-owned remediation discussion. | business/security owners decide whether to limit rollout or require a fix. |
| REVIEW MCP permission escalation | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | Markdown report with `REVIEW` verdict for permission posture. | MCP/tool owner records least-privilege conditions before rollout. |
| transcript/log review | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | Policy-backed transcript/log evidence for approval-required or denied actions. | security owner가 허용 조건, rollback owner, expiry를 reviewer memo에 적는다. |
| PASS fixed diff checkpoint | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | Markdown report with `PASS` verdict for the fixed fixture. | pilot owner records the clean fixture as a rerunnable checkpoint, not production safety proof. |
| SARIF reviewer artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/timeboxed-escalation.sarif < examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff` | SARIF artifact with `ruleId`, result, and location-style fields for reviewer handoff. | CI/release owner가 `.agentguard-demo/timeboxed-escalation.sarif`를 PR/CI artifact로 보존하거나 경로를 evidence note에 남긴다. |

Fixtures:

- `examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff`
- `examples/enterprise-scenarios/travel-reservation-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff`
- `examples/agent-policy.yaml`

## public reference rows

| Public reference | Borrow | Avoid | AgentGuard drill use |
| --- | --- | --- | --- |
| GitHub SARIF/code scanning docs — https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | artifact, reviewer handoff, `ruleId`, result/location vocabulary. | endorsement, native product claim, or substitute claim. | `scan-diff --sarif --out .agentguard-demo/timeboxed-escalation.sarif`를 reviewer가 다시 열 수 있는 artifact로 설명한다. |
| OWASP LLM01 prompt injection — https://genai.owasp.org/llmrisk/llm01-prompt-injection/ | prompt injection, manipulated behavior, unauthorized action framing. | runtime prevention claim or saying static evidence eliminates prompt injection risk. | transcript/log `REVIEW`를 human oversight가 필요한 action framing으로 넘긴다. |
| OWASP agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic risk, tool misuse, excessive agency, mitigation vocabulary. | full threat-model coverage or external assurance language. | `BLOCK` / `REVIEW` escalation을 stop, contain, fix, rerun, residual-risk owner language로 좁힌다. |
| Snyk agent-scan public repo — https://github.com/snyk/agent-scan | rerunnable scanner evidence, local agent/MCP/tool category expectation. | vendor scope comparison, usage proof, or market claim. | AgentGuard의 current slice를 PR diff, MCP config, transcript/log evidence command로만 설명한다. |
| Tencent AI-Infra-Guard public repo — https://github.com/Tencent/AI-Infra-Guard | AI infrastructure guardrail and workflow-risk operationalization expectation. | broad red-team suite comparison or production deployment claim. | timebox owner가 scanner evidence를 운영 decision log에 붙이는 방식만 빌린다. |
| splx-ai agentic-radar public repo — https://github.com/splx-ai/agentic-radar | agentic workflow visibility and security report expectation. | hosted observability, dashboard, or graph-analysis scope claim. | rerunnable scanner evidence와 owner/action table만 연결한다. |

## machine-contract boundaries

- `PASS`, `REVIEW`, `BLOCK` stay English-compatible verdict values.
- `scan-diff`, `scan-mcp`, `scan-log` stay English-compatible CLI subcommands.
- `JSON`, `SARIF`, `ruleId`, result, location, and artifact fields stay machine-facing contract terms.
- Human-facing Korean text can explain owner, timebox, and rerun. Machine-facing names remain stable for automation.
- `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` are the global CLI forms; `node dist/index.js ...` is the local repo verification form.

## claim guardrails

- No fake adoption claim.
- No customer claim.
- No external audit badge claim.
- No public-reference endorsement claim.
- No runtime prevention claim.
- No platform parity claim.
- No scanner-rule expansion, CLI behavior change, hosted dashboard promise, package publishing promise, or production deployment claim.
- Synthetic fixtures remain synthetic and fixture-backed: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.
