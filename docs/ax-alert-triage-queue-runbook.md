# AX alert triage queue runbook

한국어 우선 docs card로 보안/승인 담당자가 `finding → alert queue → owner decision → rerun evidence`를 한 장에서 확인하게 한다.
CLI commands, rule IDs, JSON, SARIF, and machine fields stay English-compatible.

## 사용 목적

커머스 VOC agent rollout에서 PR diff, MCP config, agent transcript/log finding이 나오면 alert queue owner가 먼저 triage하고, decision owner가 배포 중지/조건부 승인/통과를 결정한다. 이 runbook은 현재 AgentGuard fixture-backed command만 사용해 reviewer handoff, expected verdict, rerun trigger를 연결한다.

AgentGuard는 live token flow, GitHub account workflow, hosted dashboard, SaaS workflow, customer data processing, or product rename을 약속하지 않는다. 현재 범위는 synthetic fixture를 스캔해 사람이 읽는 alert queue와 재실행 증거를 만드는 것이다.

## Alert queue triage card

| Finding source | Alert queue owner | Exact AgentGuard command | Expected verdict | Decision owner | Rerun trigger |
|---|---|---|---|---|---|
| PR diff에서 secret-like assignment 또는 위험한 shell/export 변경이 보인다. | release owner | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` | business owner + security reviewer | secret-like diff 제거 또는 risky command 제거 후 같은 `agentguard scan-diff` evidence를 다시 붙인다. |
| MCP config가 broad filesystem root, writable path, credential passthrough를 노출한다. | security reviewer | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `REVIEW` 또는 `BLOCK` | platform/security owner | filesystem root를 업무 디렉터리로 줄이고 write 권한과 token passthrough를 제거한 뒤 같은 `agentguard scan-mcp` evidence를 재실행한다. |
| transcript/log에 승인 없는 export, 삭제성 shell, 대량 작업 흔적이 남는다. | local operator | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` | business decision owner | 정책에 승인 필요 작업을 반영하거나 로그 원인을 수정한 뒤 같은 `agentguard scan-log` evidence를 재실행한다. |

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한다. npm/global 설치 후에는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다. 위 명령은 Bash/Zsh 기준 stdin redirection 예시다. PowerShell에서는 `Get-Content examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff | node dist/index.js scan-diff`처럼 pipe 형태로 실행한다.

## Command execution boundary

- `scan-diff`, `scan-mcp`, `scan-log`는 현재 source artifact를 읽는 static pre-rollout evidence command다.
- `scan-mcp`는 MCP config 파일의 broad filesystem, writable path, credential passthrough risk를 확인하지만 runtime token scope, 동적 filesystem 변화, MCP server-side authorization, consent UI, session state를 검증하지 않는다.
- Production rollout에서는 local operator self-report만 source of record로 쓰지 말고, PR/CI runner, stored SARIF/Markdown artifact, rerunnable command, reviewer sign-off를 함께 보존한다.

## Decision owner handoff

- `BLOCK`: rollout을 멈추고 finding 원인을 수정한다. alert queue owner는 fixture path, command, exit result, reviewer handoff artifact를 남긴다.
- `REVIEW`: decision owner가 잔여 위험, 업무 영향, 허용 조건, rerun date를 문장으로 남긴 뒤 gate 진행 여부를 정한다.
- `PASS`: 현재 evidence 기준으로 차단 finding이 없거나 줄어든 상태다. 다음 gate로 이동하되 source artifact와 command를 보존한다.

Decision owner가 읽는 질문은 세 가지다.

1. 이 finding이 커머스 VOC 업무에서 고객/VOC/주문 처리에 어떤 영향을 주는가?
2. 어떤 owner가 수정, 예외 승인, rollback 중 하나를 결정하는가?
3. 어떤 rerun trigger와 command가 같은 source artifact에서 새 evidence를 만든다는 것을 보장하는가?

## Rerun evidence trigger

| Trigger | Required evidence | Reviewer handoff |
|---|---|---|
| PR diff 수정 | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`와 같은 source artifact에 대해 `agentguard scan-diff`를 재실행한다. | Markdown/terminal report 또는 SARIF artifact를 PR reviewer에게 붙인다. |
| MCP permission 축소 | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`과 같은 MCP config shape에서 `agentguard scan-mcp`를 재실행한다. | `mcp.broad_filesystem_access` 같은 rule IDs가 사라졌는지 security reviewer가 확인한다. |
| 정책/로그 조치 | `examples/agent-policy.yaml`과 `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` 조합으로 `agentguard scan-log`를 재실행한다. | business decision owner가 `REVIEW` approval memo 또는 `PASS` gate 진행 문장을 남긴다. |

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| MCP Authorization 2025-06-18 — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | authorization/resource boundary, token handling, audience validation, owner/error vocabulary. | Do not claim AgentGuard performs runtime OAuth flow, token issuance, consent UI, or audience validation. | Route MCP config finding to owner questions and rerun evidence through `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`. |
| GitHub Code scanning with CodeQL — https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql | code scanning alert queue, reviewer triage, and SARIF/code-scanning handoff language. | Do not claim GitHub account workflow ownership or upload workflow completion. | Explain local `scan-diff` output as reviewer handoff evidence and preserve SARIF/Markdown as artifacts when available. |
| Snyk `agent-scan` — https://github.com/snyk/agent-scan | AI agent and MCP scanner category language. | Do not claim feature equality or customer adoption. | Keep AgentGuard positioning to Korean-first rollout approval evidence over PR diff, MCP config, transcript/log, and SARIF. |
| Tencent `AI-Infra-Guard` — https://github.com/Tencent/AI-Infra-Guard | public AI infra and MCP risk taxonomy language. | Do not claim broad AI red-team suite coverage. | Map taxonomy terms to current deterministic fixture commands only. |
| splx-ai `agentic-radar` — https://github.com/splx-ai/agentic-radar | agentic workflow scanner freshness framing. | Do not claim runtime workflow discovery or attack simulation. | Use current fixture-backed evidence to show point-in-time rollout approval status. |

## Machine-contract boundaries

- `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` stay English-compatible.
- CLI command names, rule IDs, JSON, SARIF, and machine fields stay unchanged.
- Representative rule IDs: `mcp.broad_filesystem_access`, `generic-secret-assignment`.
- Synthetic inputs remain synthetic fixtures: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished, adoption, or external assurance claim.
- No external audit, standards badge, or formal assurance claim.
- No statement that AgentGuard replaces GitHub code scanning, CodeQL, Snyk, Tencent AI-Infra-Guard, splx-ai agentic-radar, SAST, MCP authorization, or a broad AI security suite.
- No hosted dashboard, SaaS workflow, account auth flow, runtime monitoring, attack simulation, package publishing, severity policy, or scanner behavior change.
- No product rename and no change to CLI commands, rule IDs, JSON, SARIF, API, or machine fields.
