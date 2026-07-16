# AX workspace trust approval checklist

## Purpose

한국어 우선 AX Rollout Guard 체크리스트입니다. 목적은 unknown company problem이 들어왔을 때 security reviewer가 **workspace trust**, tool permission, MCP least-privilege, transcript approval evidence를 30초 안에 확인하고 `PASS` / `REVIEW` / `BLOCK` handoff를 결정하게 하는 것입니다.

이 문서는 scanner behavior, CLI flags, rule IDs, verdict policy, JSON/SARIF schema, package publishing, GitHub Action behavior를 바꾸지 않습니다. AgentGuard는 현재 정적 pre-rollout evidence와 source-of-record artifact를 제공하며, runtime sandbox/OAuth/session/consent/MCP enforcement를 제공한다고 말하지 않습니다.

## Public reference signals

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | agentic AI의 tool misuse, excessive agency, sensitive data exposure risk vocabulary | OWASP endorsement, certification, or complete coverage claim | PR diff, MCP config, transcript/log evidence를 workspace trust approval 질문으로 라우팅한다. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | least privilege, explicit user consent, token/tool boundary language | runtime MCP OAuth/session/consent enforcement 또는 MCP conformance claim | `scan-mcp` 결과를 MCP root/env/tool permission review 입력으로 제한한다. |
| [GitHub code scanning overview](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning) | code scanning과 SARIF artifact가 reviewer handoff에 쓰이는 흐름 | GitHub upload, code scanning, or SARIF artifact가 approval/certification을 뜻한다는 표현 | SARIF artifact를 reviewer가 다시 열 수 있는 source-of-record evidence로 남긴다. |
| [Anthropic Claude Code security](https://docs.anthropic.com/en/docs/claude-code/security) | workspace trust와 tool permission review를 분리하는 framing | Anthropic approval, hosted sandbox guarantee, or vendor-verified safety claim | transcript/log와 MCP config를 사람이 승인해야 하는 tool permission review 질문으로 변환한다. |

## Workspace trust approval checklist

| Workspace trust question | Evidence command | Approval decision | Rerun trigger |
| --- | --- | --- | --- |
| agent-generated PR diff에 secret-like value 또는 dangerous command가 들어왔는가? | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | finding이 있으면 reviewer는 `REVIEW`/`BLOCK` source-of-record JSON을 PR approver와 security owner에게 전달한다. | PR diff, policy, CLI build, or rule output이 바뀌면 재실행한다. |
| MCP server/tool config가 broad root, writable path, env token passthrough 같은 least privilege 위반을 요구하는가? | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | security owner가 MCP root/env boundary를 좁히거나 explicit user consent와 제한 rollout 조건을 기록하기 전까지 승인하지 않는다. | MCP config, server package, env mapping, or approval owner가 바뀌면 재실행한다. |
| agent transcript/log에 workspace trust를 깨는 approval-required shell/file operation이 있는가? | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | policy owner가 denied-command 또는 approval-required operation을 재현하고 fix/policy condition을 남기면 `REVIEW`로 넘긴다. | transcript, policy, command allow/deny list, or reviewer owner가 바뀌면 재실행한다. |
| reviewer가 terminal self-report 대신 SARIF artifact를 다시 열 수 있는가? | `node dist/index.js scan-diff --sarif --out .agentguard-demo/workspace-trust-approval.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF artifact는 reviewer handoff evidence일 뿐 approval이 아니다. reviewer가 artifact path, rule IDs, source fixture, current build SHA를 확인한다. | SARIF path, fixture, build output, or PR SHA가 바뀌면 artifact를 다시 생성한다. |

## Exact fixture-backed evidence commands

Fresh clone prerequisite:

```bash
npm ci
npm run build
```

Then run from the repository root:

```bash
node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/workspace-trust-approval.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Expected risky fixtures may exit non-zero when the verdict is `REVIEW` or `BLOCK`. Treat non-zero as acceptable only after checking the verdict/report/artifact shape, exact command, source fixture, and current build SHA.

## Machine-contract boundary

Keep these English-compatible machine contracts unchanged:

- `PASS`, `REVIEW`, `BLOCK`
- `scan-diff`, `scan-mcp`, `scan-log`
- `--json`, `--sarif`, `--out`, `--policy`
- JSON/SARIF fields and rule IDs
- npm package, CLI, and GitHub Action behavior

Korean text is only the human-facing workspace trust, tool permission review, approval owner, and source-of-record explanation layer.

## Non-claim guardrails

- Public references are framing inputs only; they are not endorsement, approval, certification, or conformance evidence.
- Do not claim customer adoption, real customer rollout proof, hosted dashboard operation, or external audit status.
- Do not claim AgentGuard replaces Snyk, GitHub code scanning, Claude Code security controls, OWASP guidance, or MCP runtime security controls.
- Do not claim runtime OAuth/session/consent/sandbox/MCP enforcement; this checklist covers static pre-rollout evidence and reviewer handoff only.
- Do not claim Anthropic approval, OpenAI approval, GitHub approval, OWASP approval, or vendor-verified safety.
