# AX prompt-injection evidence routing card

한국어 우선 routing card로 AX Rollout Guard 심사자가 prompt-influenced agent action을 기존 AgentGuard evidence command와 approval evidence에 연결하게 한다.
CLI commands, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## 30초 prompt-injection evidence route

1. 회사 문제: agent가 외부 지시나 prompt-injection성 content에 끌려 tool misuse, 과도한 권한 사용, PR diff 변경, MCP config 위험, transcript/log 정책 위반을 만들 수 있다.
2. AgentGuard surface: `agentguard scan-log`는 transcript/log policy evidence, `agentguard scan-mcp`는 MCP config evidence, `agentguard scan-diff`는 PR diff와 SARIF reviewer evidence를 만든다.
3. evidence handoff: 아래 명령은 모두 synthetic commerce VOC fixture-backed command이며 scanner behavior, CLI name, rule ID, machine field를 바꾸지 않는다.
4. approval reading: `BLOCK`은 rollout 중지 또는 수정 후 재스캔, `REVIEW`는 security approver가 조건부 승인 근거를 남김, `PASS`는 현재 evidence 기준으로 다음 gate 진행이다.

## Problem → surface → command → approval table

| Prompt-injection/tool-abuse problem | AgentGuard surface | Exact fixture-backed command | Expected verdict | Approval condition |
|---|---|---|---|---|
| Agent transcript가 prompt-influenced agent action을 보여 주고 policy-sensitive tool action이 approval 없이 이어진다. | Transcript/log policy evidence for security approver memo. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` finding expected for policy-sensitive agent actions. | Approver memo에 허용 조건, owner, rerun date를 남기거나 transcript/policy를 수정해 `PASS`로 재스캔한다. |
| MCP config가 broad filesystem 또는 credential passthrough로 prompt-injected tool misuse blast radius를 키운다. | MCP config local operator review. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK` or `REVIEW` expected for broad filesystem access and credential exposure. | Writable/broad root와 credential passthrough를 줄이고 security approver가 residual risk를 승인해야 한다. |
| PR diff가 prompt-influenced change로 secret-like value나 risky shell behavior를 reviewer에게 숨길 수 있다. | PR diff Markdown plus SARIF/GitHub code scanning artifact. | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` finding expected; command may exit expected nonzero while still writing SARIF artifact. | Merge stop, diff 수정, 재스캔, 그리고 필요한 경우 `agentguard.sarif`를 PR/CI artifact로 보존한다. |

## Public reference borrow/avoid/action rows

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, prompt-influenced action, approval/mitigation vocabulary. | Do not claim OWASP coverage, formal assurance, or complete mitigation suite scope. | Route transcript/log, MCP config, and PR diff evidence to reviewer approval conditions before rollout. |
| GitHub code scanning docs — https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning | developer/reviewer alert routing and SARIF artifact framing for code review evidence. | Do not claim GitHub native app behavior, hosted dashboard, or code scanning substitute scope. | Keep `scan-diff --sarif --out agentguard.sarif` as reviewer artifact handoff while Markdown stays business-readable. |
| splx-ai `agentic-radar` — https://github.com/splx-ai/agentic-radar | Public category signal that agentic workflow scanners review prompt/tool risk before rollout. | Do not claim attack simulation, runtime monitoring, hosted dashboard scope, or benchmark equality. | Use category vocabulary only to explain why narrow fixture-backed AgentGuard commands matter to AX judges. |
| Tencent `AI-Infra-Guard` — https://github.com/Tencent/AI-Infra-Guard | Broad AI infra, MCP, and agent risk category awareness. | Do not claim full red-team platform scope, Tencent feature equality, or private infrastructure scanning. | Keep AgentGuard positioned as PR/MCP/transcript pre-rollout evidence with exact commands and approval conditions. |

## Fixture-backed command contract

Fresh clone에서는 repository root에서 먼저 `npm ci && npm run build`를 실행한다. 아래 상대경로 명령은 모두 repository root 기준이다. npm/global 설치 후에는 같은 subcommands를 `agentguard scan-log`, `agentguard scan-mcp`, `agentguard scan-diff`로 실행할 수 있다.

- Transcript/log approval evidence: `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- MCP prompt-injection blast-radius review: `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- PR diff SARIF reviewer handoff: `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`

Fixture inputs are synthetic and existing repo files: `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, and `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`.

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished proof, field deployment proof, or external assurance claim.
- No standards badge, audit badge, benchmark parity, or third-party approval claim.
- No statement that AgentGuard replaces OWASP guidance, GitHub code scanning, splx-ai agentic-radar, Tencent AI-Infra-Guard, SAST, MCP authorization, runtime prompt-injection detection, or a broad AI security suite.
- No GitHub App, dashboard, auth, SaaS, runtime monitoring, attack simulation, or runtime detector implementation claim.
- No product rename and no change to CLI commands, rule IDs, JSON, SARIF, API, or machine fields.
- Synthetic fixtures remain synthetic and fixture-backed: `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, and `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`.
