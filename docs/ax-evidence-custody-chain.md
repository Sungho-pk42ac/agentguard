# AX evidence custody chain

한국어 우선 설명으로 AX Rollout Guard 심사자와 enterprise reviewer가 AgentGuard evidence를 "말"이 아니라 추적 가능한 custody chain으로 확인하게 한다. 범위는 현재 repo의 synthetic fixture, exact command, artifact path/hash or report handoff, reviewer/approver, rerun/freshness condition을 한 줄로 묶는 것이다. Scanner behavior, CLI commands, rule IDs, JSON, SARIF, API, machine contracts는 바꾸지 않는다.

## 사용 목적

AgentGuard output을 승인 근거로 쓰려면 finding 자체보다 custody가 먼저 보여야 한다. 누가 어떤 source evidence를 어떤 command로 확인했고, 어느 artifact에 남겼으며, 언제 다시 실행해야 하는지 보여주면 심사자는 "재현 가능한 증거인가?"를 빠르게 판단할 수 있다.

이 문서는 public reference language를 빌리되 AgentGuard가 runtime firewall, 외부 인증 도구, GitHub 보안 제품 대체물, Snyk agent-scan과 같은 범위의 제품이라고 주장하지 않는다. AgentGuard라는 제품명, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, rule IDs, JSON, SARIF fields는 English-compatible machine contracts로 유지한다.

## Custody chain format

각 evidence row는 아래 여섯 필드를 채운다.

| Field | 작성 기준 |
|---|---|
| Company problem | 회사가 rollout 전에 판단해야 하는 실제 운영 질문을 적는다. |
| Source evidence | repo, CI, host에 남아 reviewer가 읽을 수 있는 원본 evidence path를 적는다. |
| Exact AgentGuard command | 저장소 루트에서 재실행할 command를 그대로 적는다. |
| Artifact path/hash or report handoff | Markdown report, SARIF file, PR comment, approval note, artifact hash 위치를 적는다. |
| Reviewer/approver | security reviewer, app owner, compliance reviewer처럼 최종 판단자를 적는다. |
| Rerun/freshness condition | 어떤 변경이나 시간 경과 때 다시 실행해야 하는지 적는다. |

## Company problem → source evidence → command → artifact → approval

| Company problem | Source evidence | Exact AgentGuard command | Artifact path/hash or report handoff | Reviewer/approver | Rerun/freshness condition |
|---|---|---|---|---|---|
| PR diff가 secret, PII, risky shell material을 새로 넣어도 merge 가능한가? | `examples/risky-pr.diff` synthetic PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | Markdown stdout report handoff; CI에서는 PR comment 또는 saved report artifact와 artifact hash를 기록 | Security reviewer + PR approver | diff가 바뀌거나 policy/rule version이 바뀌면 rerun; 같은 commit SHA evidence만 fresh |
| Agent MCP config가 broad filesystem, writable path, credential passthrough를 허용하는가? | `examples/risky-mcp.json` synthetic MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Markdown stdout report handoff; 운영에서는 MCP config artifact path와 artifact hash를 함께 기록 | Agent platform owner + security reviewer | MCP server, root path, env passthrough, approval policy가 바뀌면 rerun |
| Agent transcript/log가 승인 없는 shell behavior를 남겼는가? | `examples/agent-transcript.log` + `examples/agent-policy.yaml` synthetic transcript/log and policy | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Markdown stdout report handoff; incident note에는 transcript/log path, policy path, report handoff를 묶음 | Incident reviewer + workflow owner | transcript/log, policy file, approval-required operation list가 바뀌면 rerun |
| GitHub code scanning 또는 security reviewer에게 machine-readable artifact를 넘길 수 있는가? | `examples/risky-pr.diff` synthetic PR diff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | `.agentguard-demo/agentguard.sarif` SARIF artifact path; artifact hash와 GitHub code-scanning handoff condition을 기록 | Security reviewer + CI owner | diff, SARIF-producing command, upload workflow configuration, artifact hash가 바뀌면 rerun |

## Fixture-backed commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

Fixture notes:

- `examples/risky-pr.diff` is synthetic PR diff evidence.
- `examples/risky-mcp.json` is synthetic MCP config evidence.
- `examples/agent-policy.yaml` and `examples/agent-transcript.log` are synthetic policy and transcript/log evidence.
- `.agentguard-demo/agentguard.sarif` is a local generated SARIF artifact path, not a committed claim of upload.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | Custody-chain action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agentic-risk framing around tool/action control, sensitive data, and mitigation evidence. | Avoid: saying AgentGuard covers every agentic AI threat or works as a runtime firewall. | Connect PR diff, MCP config, and transcript/log evidence to a pre-rollout control boundary plus reviewer approval condition. |
| [GitHub SARIF support](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Borrow: SARIF result/rule/location artifact vocabulary for developer and security-review handoff. | Avoid: saying GitHub upload happens automatically unless a workflow is configured. | Name `.agentguard-demo/agentguard.sarif`, artifact hash, and reviewer handoff condition without changing CLI or SARIF fields. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Borrow: public agent/AI security category language around inventory, provenance, and security evidence. | Avoid: parity, market adoption, external trust badge, or same-scope enterprise scanner claim. | Keep the AgentGuard chain narrow: source-of-record path, command reproducibility, reviewer owner, freshness/rerun condition. |

## Machine-contract guardrails

- CLI commands stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- rule IDs, verdict values, JSON, SARIF, API fields, file paths, and machine contracts stay stable for automation.
- Human-facing explanation is Korean-first; automation-facing fields remain stable.
- No scanner behavior changes, no severity/blocking policy changes, no package publishing change, no SaaS/auth/dashboard/runtime integration claim.
- No real customer data, credentials, fake logos, fake trust badges, named production deployment, or adoption claim.
- Public references support framing only. They are not external assurance, replacement, parity, or proof of production use.
