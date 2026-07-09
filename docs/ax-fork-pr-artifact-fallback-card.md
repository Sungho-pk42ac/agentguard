# AX fork PR artifact fallback card

한국어 우선 evidence card입니다. 목적은 external/fork PR에서 write-token channel이 막혀도 AgentGuard evidence를 reviewer가 볼 수 있게 남기는 것입니다. 이 문서는 scanner behavior, CLI commands, rule IDs, JSON/SARIF fields, package metadata, GitHub Action runtime behavior를 바꾸지 않고, 현재 repo fixture와 rerunnable command만 설명합니다.

## Fork PR boundary

Fork PR에서는 보안 경계 때문에 PR comment 쓰기나 GitHub code scanning SARIF upload가 제한될 수 있습니다. 그때도 evidence가 사라지면 안 됩니다.

기준은 짧습니다: **artifact-only fallback is the source of record for fork PR evidence when write-token channels are unavailable.**

| Fork PR condition | Source of record | Reviewer action |
|---|---|---|
| PR comment write-token이 없거나 untrusted fork라서 comment가 생성되지 않는다. | job summary, Markdown report artifact, JSON artifact, SARIF artifact | reviewer는 artifact-only fallback을 열고 같은 command를 재실행해 PR diff evidence를 확인한다. |
| SARIF upload 권한이나 code scanning channel이 gated 또는 unavailable이다. | generated SARIF file plus Markdown/JSON report artifact | reviewer는 SARIF upload 성공 여부가 아니라 저장된 SARIF artifact와 rerunnable command를 확인한다. |
| MCP config 또는 transcript/log evidence가 PR comment에 붙지 않는다. | saved MCP/log input artifact, Markdown/JSON output, job summary | reviewer는 artifact path, command, verdict를 approval note에 붙인다. |

PR comment and SARIF upload are gated or unavailable on some fork PRs; artifact-only fallback, job summary, Markdown, JSON, and SARIF are the source of record for fork PRs.

## Fixture-backed evidence commands

아래 명령은 현재 저장소의 synthetic fixture만 사용합니다. Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 저장소 루트에서 그대로 재현합니다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있습니다.

| Surface | Exact command | Fixture path | Fork PR artifact fallback |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` | Markdown stdout/report artifact and job summary row |
| MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | Markdown/JSON artifact attached to the fork PR run |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | transcript/log report artifact plus policy path |
| SARIF artifact generation | `node dist/index.js scan-diff --sarif --out .agentguard-demo/fork-pr/agentguard.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff` | `.agentguard-demo/fork-pr/agentguard.sarif` saved as reviewer artifact when upload is gated |

## Reviewer handoff wording

Use this wording in a job summary or reviewer note:

```text
Fork PR write-token channels may be unavailable. AgentGuard source of record is the saved Markdown/JSON/SARIF artifact plus the rerunnable command in this job summary. Review PR diff, MCP config, and transcript/log evidence from the artifact bundle before rollout approval.
```

Keep machine-facing strings English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `BLOCK`, `REVIEW`, `PASS`, rule IDs, JSON fields, SARIF fields, and artifact paths.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agent autonomy, tool misuse, excessive agency, and mitigation wording for rollout-risk evidence. | Avoid: OWASP endorsement, external assurance, or complete threat coverage claim. | AgentGuard action: frame fork PR evidence as PR diff, MCP config, and transcript/log rollout-risk artifacts. |
| [MCP security best practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | Borrow: least privilege, user consent, token boundary, and security-boundary language. | Avoid: runtime MCP enforcement, OAuth/session control, or consent UI implementation claim. | AgentGuard action: preserve MCP config evidence as artifact fallback when PR write-token channels are unavailable. |
| [GitHub SARIF support docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Borrow: SARIF rule/result/location artifact vocabulary for reviewer handoff. | Avoid: automatic GitHub code scanning availability claim on every fork PR. | AgentGuard action: generate SARIF locally with `scan-diff --sarif --out` and save the file as a fork PR artifact when upload is gated. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: upload-channel and workflow artifact framing. | Avoid: recommending elevated fork checkout or assuming upload permissions. | AgentGuard action: document artifact-only fallback as the source of record if upload is blocked. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Borrow: public category signal that agent activity and security scanning is a recognized space. | Avoid: parity, replacement, market adoption, or same-scope platform claim. | AgentGuard action: differentiate as Korean-first PR diff, MCP config, transcript/log, and SARIF rollout evidence. |

## Non-claim guardrails

- No `pull_request_target` unsafe checkout recommendation.
- No scanner behavior change.
- No CLI command, rule ID, JSON field, or SARIF field change.
- No GitHub Action runtime behavior change.
- No default severity, blocking, or rollout policy change.
- No real customer data, real credential, adoption, certification, hosted dashboard, SaaS, auth, or broad runtime-monitoring claim.
- No claim that PR comment or SARIF upload always works on fork PRs; artifact-only fallback/job summary/Markdown/JSON/SARIF is the source of record when write-token channels are unavailable.
