# AX agent feedback-loop evidence card

한국어 우선 enterprise AX rollout judge 대상 카드입니다. 핵심 문장: finding → owner → fix condition → rerun command/artifact → approval decision.

## 사용 목적

AgentGuard finding을 "스캔 결과"로 끝내지 않고, 누가 고치고 어떤 조건에서 다시 실행하며 어떤 승인 결정을 내릴지까지 한 장에 묶습니다. 이 카드는 commerce VOC agent rollout judge가 `BLOCK` / `REVIEW` / `PASS`를 실제 승인 루프로 해석할 때 사용합니다.

현재 범위는 local static/pre-rollout evidence와 reviewer/approval handoff입니다. AgentGuard는 PR diff, MCP config, agent transcript/log, SARIF artifact를 재실행 가능한 근거로 남깁니다. AgentGuard scope is not runtime OAuth/session/control. Public reference tools and standards remain separate systems, and this card does not describe GitHub upload automation.

## Finding → owner → fix condition → rerun artifact → approval decision

| Loop step | Korean-first judge wording | Stable machine evidence |
|---|---|---|
| Finding | "어떤 rollout 위험이 배포 전에 잡혔는가?" | `BLOCK` / `REVIEW` / `PASS`, rule IDs |
| Owner | "누가 수정, 정책 예외, 잔여위험 수용을 결정하는가?" | security owner, business owner, agent operator |
| Fix condition | "secret 제거, MCP 권한 축소, 위험 명령 정책 승인 중 무엇이 완료 조건인가?" | `secret.github_token`, `mcp.broad_filesystem_access`, `agent.dangerous_command` |
| Rerun command/artifact | "같은 fixture로 다시 실행하면 어떤 JSON/SARIF/Markdown 근거가 남는가?" | `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `.agentguard-demo/ax-agent-feedback-loop-evidence-card.sarif` |
| Approval decision | "조건 충족 후 승인, 조건부 검토, rollout 중지 중 무엇인가?" | approval sentence using `PASS` / `REVIEW` / `BLOCK` |

## Evidence loop card

| Finding | Owner | Fix condition | Rerun command/artifact | Approval decision |
|---|---|---|---|---|
| `BLOCK secret.github_token` in PR diff | Security owner | token-like value removed or replaced with safe secret reference | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`; Markdown/terminal evidence from `agentguard scan-diff` | `PASS` only after the rerun no longer reports the secret rule ID |
| `REVIEW mcp.broad_filesystem_access` in MCP config | Agent platform owner | filesystem root is narrowed or business exception is recorded | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`; Markdown/terminal evidence from `agentguard scan-mcp` | `REVIEW` stays until an owner accepts the residual tool boundary |
| `REVIEW agent.dangerous_command` in transcript/log | Agent operator plus business owner | denied command is removed, policy exception is approved, or rollout is stopped | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`; Markdown/terminal evidence from `agentguard scan-log --policy` | `BLOCK` if no owner accepts the command path; otherwise conditional approval |
| PR diff reviewer handoff | Reviewer | same finding is preserved as a review artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-agent-feedback-loop-evidence-card.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`; SARIF artifact | reviewer records approve, request-fix, or stop decision outside AgentGuard |

## Fixture-backed rerun commands

Fresh-clone reviewer commands use `node dist/index.js ...` after `npm ci && npm run build`; packaged/global installs expose the same subcommands as the `agentguard ...` command contract.

PR diff finding:

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

MCP config finding:

```bash
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
```

Agent transcript/log finding with rollout policy:

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

SARIF reviewer artifact:

```bash
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-agent-feedback-loop-evidence-card.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Top 10 for LLM Applications — https://owasp.org/www-project-top-10-for-large-language-model-applications/ | agentic AI risk framing such as prompt injection, sensitive information disclosure, insecure plugin/tool design, and excessive agency | external assurance or whole-standard coverage language | map PR diff, MCP config, and transcript/log findings into owner and fix-condition questions |
| MCP Authorization spec — https://modelcontextprotocol.io/specification/draft/basic/authorization | state, redirect, scope, token, and authorization-boundary vocabulary for explaining why tool authority needs an owner | runtime OAuth/session/control claims or authorization-server duties | keep MCP evidence as pre-rollout config/log review, then point the runtime validation owner to their own control plane |
| GitHub SARIF upload — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | artifact, reviewer handoff, and source-location vocabulary around SARIF files | hosted upload, triage, or approval automation claims | produce a local `.agentguard-demo/ax-agent-feedback-loop-evidence-card.sarif` artifact for reviewers to inspect or route manually |
| Snyk CLI commands — https://docs.snyk.io/developer-tools/snyk-cli/commands | first-minute CLI discipline: show exact command, input, and help-oriented operator path | platform-breadth comparison or substitute-product language | keep AgentGuard commands copy-pasteable and tied to existing fixtures |

## Machine-contract preservation

Human-facing explanation stays Korean-first. Machine-facing contracts stay English-compatible and unchanged.

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- CLI flags: `--policy`, `--sarif`, `--out`
- Output contracts: `JSON`, `SARIF`, Markdown reviewer notes
- Verdicts: `PASS`, `REVIEW`, `BLOCK`
- rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`, `agent.dangerous_command`
- Fixture paths: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, `examples/agent-policy.yaml`

## Non-claim guardrails

- 이 카드는 scanner behavior, severity policy, CLI flags, JSON/SARIF schemas, package metadata, product naming, hosted workflow, runtime authorization claims를 바꾸지 않습니다.
- AgentGuard의 현재 설명 범위는 local static/pre-rollout evidence와 reviewer/approval handoff입니다.
- AgentGuard가 MCP server, OAuth session, redirect URI, token audience, runtime authorization을 실행 또는 검증한다고 말하지 않습니다.
- SARIF는 local reviewer artifact입니다. GitHub 업로드, triage, 승인 자동화는 이 카드의 범위가 아닙니다.
- Public references supply vocabulary only. AgentGuard 보증, substitute-product scope, feature-equivalence, 운영 채택 실적을 주장하지 않습니다.
