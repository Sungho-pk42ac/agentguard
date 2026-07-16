# AX security reviewer question bank

## Purpose

한국어 우선 AX Rollout Guard 데모에서 security reviewer가 “이 agent/tool rollout을 지금 승인해도 되는가?”를 물었을 때 바로 펼치는 질문 은행입니다. unknown company problem이 들어와도 PR diff, MCP config, transcript/log, SARIF artifact를 같은 source-of-record evidence 흐름으로 재실행하게 만드는 것이 목적입니다.

이 문서는 scanner behavior, CLI flags, rule IDs, PASS/REVIEW/BLOCK verdict semantics, JSON/SARIF schema, package publishing, GitHub Action behavior를 바꾸지 않습니다.

## Public reference signals

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | agent/MCP/skill surface inventory를 먼저 보여 주는 방식 | Snyk와 parity, replacement, 동일 범위, 외부 도입 증거처럼 들리는 표현 | AgentGuard는 PR diff, MCP config, transcript/log, SARIF artifact를 한 reviewer evidence queue로 묶는다. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | least privilege, explicit user consent, tool access boundary language | runtime MCP enforcement, OAuth/session/consent control을 구현한 것처럼 말하기 | `scan-mcp` 결과를 security owner의 permission review 입력으로 제한한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF reviewer handoff, rerunnable artifact vocabulary | GitHub upload가 approval, certification, or triage completion을 뜻한다는 표현 | SARIF는 reviewer가 다시 열어 볼 source-of-record artifact로만 설명한다. |
| [Anthropic Claude Code security](https://docs.anthropic.com/en/docs/claude-code/security) | workspace trust와 tool permission review를 분리하는 framing | Anthropic approval, runtime sandbox guarantee, hosted trust proof처럼 말하기 | transcript/log와 MCP config를 사람의 tool permission review 질문으로 바꾼다. |

## Reviewer question bank

| Security reviewer question | Evidence command | Expected handoff | Decision owner |
| --- | --- | --- | --- |
| 새 PR diff가 agent-generated change로 들어왔을 때 secret-like value나 dangerous command가 섞였는가? | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | JSON report의 `REVIEW`/`BLOCK` finding을 PR approver와 security owner에게 전달한다. | business owner + security owner |
| MCP server/tool config가 broad root, writable path, env token passthrough 같은 least privilege 위반을 요구하는가? | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | permission 축소, explicit user consent 조건, 제한 rollout 조건을 security owner가 기록한다. | security owner |
| agent transcript/log에 workspace trust를 깨는 승인 필요 shell/file operation 흔적이 있는가? | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | policy owner가 approval-required operation을 재현하고 fix/policy condition 또는 residual risk를 남긴다. | policy owner + pilot owner |
| reviewer가 terminal stdout만 믿지 않고 artifact를 다시 열 수 있는가? | `node dist/index.js scan-diff --sarif --out .agentguard-demo/security-reviewer-question-bank.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF reviewer handoff artifact를 남기고, approval action은 별도 owner decision으로 분리한다. | evidence owner + reviewer |

## Exact fixture-backed evidence commands

Fresh clone prerequisite:

```bash
npm ci
npm run build
```

Then run the evidence commands from the repository root:

```bash
node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/security-reviewer-question-bank.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Expected risky fixtures may exit non-zero when the verdict is `REVIEW` or `BLOCK`. A non-zero exit is acceptable evidence only when the reviewer also checks the command, source fixture, report/artifact shape, and current build SHA.

## Machine-contract boundary

Keep these English-compatible machine contracts unchanged:

- `PASS`, `REVIEW`, `BLOCK`
- `scan-diff`, `scan-mcp`, `scan-log`
- `--json`, `--sarif`, `--out`, `--policy`
- JSON/SARIF fields and rule IDs
- npm package, CLI, and GitHub Action behavior

Korean text is only the human-facing reviewer/owner explanation layer.

## Non-claim guardrails

- Public references are framing inputs only; they are not endorsement, approval, or certification.
- Do not claim customer adoption, real customer rollout proof, or external audit status.
- Do not claim AgentGuard replaces Snyk, GitHub code scanning, Claude Code security controls, or MCP runtime security controls.
- Do not claim runtime OAuth/session/consent/MCP enforcement; this card covers static pre-rollout evidence and reviewer handoff only.
- Do not claim Anthropic approval, OpenAI approval, GitHub approval, or vendor-verified safety.
