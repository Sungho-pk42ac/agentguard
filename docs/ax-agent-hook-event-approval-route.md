# AX agent hook event approval route

## 목적

이 문서는 AX Rollout Guard 데모에서 기업이 Codex/Cursor/Claude Code/MCP 기반 agent workflow를 업무에 넣기 전에, **agent hook/tool event**를 어떤 source-of-record evidence로 보고 누가 `PASS` / `REVIEW` / `BLOCK` 승인을 판단해야 하는지 30초 안에 설명하기 위한 한국어 우선 카드입니다.

범위는 문서/테스트 계약입니다. AgentGuard는 현재 Claude Code Hooks를 설치하거나 실행하지 않고, OpenAI guardrails를 대신 실행하지 않으며, MCP runtime OAuth/session/redirect 검증을 구현한다고 주장하지 않습니다. 이 카드는 기존 `scan-log`, `scan-mcp`, `scan-diff`, SARIF handoff 명령으로 hook-style 이벤트 로그를 승인 판단에 연결하는 정적 운영 경로만 고정합니다.

## Hook event approval route

| Hook/event question | AgentGuard evidence | Approval decision | Rerun trigger |
| --- | --- | --- | --- |
| 에이전트가 tool 실행 전 어떤 파일/명령/권한을 요청했는가? | `scan-log` transcript evidence로 denied-command, sensitive path, approval-required operation을 확인한다. | `BLOCK`: 삭제/외부전송/위험 셸 명령. `REVIEW`: 승인 필요 작업. `PASS`: 정책 위반 없음. | hook/transcript log가 바뀌거나 agent policy가 바뀌면 재실행한다. |
| MCP server가 broad filesystem root, writable root, credential passthrough를 노출하는가? | `scan-mcp` evidence로 MCP config 권한 surface를 확인한다. | `BLOCK`: broad write/root + credential exposure. `REVIEW`: scope 축소 필요. `PASS`: 제한된 읽기/도구 범위. | MCP config, permission mode, env passthrough 값이 바뀌면 재실행한다. |
| PR diff가 hook-driven agent change로 secrets/PII/dangerous command를 추가했는가? | `scan-diff` evidence와 SARIF artifact를 reviewer 채널로 넘긴다. | `BLOCK`: secret/critical command. `REVIEW`: approval-required operation. `PASS`: 위험 finding 없음. | PR branch, base SHA, policy, fixture가 바뀌면 재실행한다. |
| authorization/session/redirect boundary가 회사 문제에서 쟁점인가? | AgentGuard evidence는 정적 preflight 입력으로 사용하고, runtime OAuth/state/session 판단은 human/security owner에게 넘긴다. | `REVIEW`: runtime auth 설계 확인 필요. `BLOCK`: credential/redirect evidence가 위험한 source artifact에 노출됨. | MCP Authorization 요구사항 또는 회사 IdP/redirect 정책이 바뀌면 재실행한다. |

## Exact fixture-backed commands

Fresh clone 또는 demo machine에서는 먼저 빌드합니다.

```bash
npm ci
npm run build
```

Agent hook/transcript evidence:

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

MCP permission evidence:

```bash
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
```

PR diff + SARIF reviewer artifact evidence:

```bash
mkdir -p .agentguard-demo/agent-hook-event
node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-hook-event/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Optional package/readiness check:

```bash
node dist/index.js doctor --json
```

## Public references: Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| Anthropic Claude Code Hooks — https://docs.anthropic.com/en/docs/claude-code/hooks | Hook events as pre-tool, post-tool, and session-boundary evidence vocabulary. | Do not claim AgentGuard installs, configures, executes, or controls Claude Code Hooks. | Treat hook-style text/log output as source evidence that can be scanned with `scan-log` and routed to approval owners. |
| OpenAI Agents SDK Guardrails — https://openai.github.io/openai-agents-python/guardrails/ | Tripwire framing: suspicious input/output should trigger a decision path rather than disappear in agent self-report. | Do not claim AgentGuard runs OpenAI guardrails or is endorsed by OpenAI. | Translate existing findings into `PASS` / `REVIEW` / `BLOCK` approval decisions with rerun triggers. |
| MCP Authorization — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | Authorization, session, and redirect-boundary questions for MCP-connected workflows. | Do not claim runtime OAuth, state, session binding, or redirect URI validation. | Use `scan-mcp` and transcript evidence as static preflight input for the human/security auth review. |
| GitHub code scanning — https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning | Reviewer-visible SARIF/code-scanning artifact routing. | Do not claim automatic SARIF upload, GitHub approval, or code-scanning replacement. | Generate SARIF artifacts from `scan-diff --sarif --out ...` so reviewers can inspect source-of-record findings. |

## Machine contracts

- CLI commands stay English-compatible: `agentguard scan-log`, `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard doctor`.
- Verdict words stay machine-compatible: `PASS`, `REVIEW`, `BLOCK`.
- Output contracts stay machine-compatible: `JSON`, `SARIF`, `ruleId`, `locations`, `severity`.
- This card does not change scanner behavior, rule IDs, severity, package metadata, GitHub Action runtime, or SARIF schema.

## Non-claim guardrails

- No claim that AgentGuard controls Claude Code Hooks, Cursor hooks, Codex hooks, MCP runtime sessions, OAuth flows, redirect URI validation, or live tool interception.
- No claim that AgentGuard runs OpenAI guardrails or has OpenAI/Anthropic/GitHub/MCP official approval.
- No claim of SOC 2, ISO 27001, certification, customer adoption, production deployment, full platform parity, or replacement for GitHub code scanning, Snyk, OWASP guidance, MCP runtime controls, or Claude Code security controls.
- Hook/log evidence here is static source-of-record evidence for reviewer approval, not a hosted dashboard, runtime authorization service, automatic SARIF upload, or enterprise policy enforcement engine.
