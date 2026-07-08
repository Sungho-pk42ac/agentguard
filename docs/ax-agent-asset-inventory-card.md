# AX agent asset inventory card

한국어 우선 운영 문서로 회사 문제가 어떤 agent asset inventory로 내려가고, 그 inventory를 어떤 AgentGuard command로 확인하며, 누가 어떤 조건으로 승인하는지 한 장에서 정리한다.
CLI commands, rule IDs, `ruleId`, JSON, SARIF, API, and machine fields stay English-compatible.

범위는 합성 fixture를 쓰는 문서 계약이다. CLI behavior, scanner rules, dashboard/auth/SaaS, name은 바꾸지 않는다.

## 사용 목적

Agent rollout 전에 현업, 보안, 운영 담당자가 "무엇이 agent asset인가"를 같은 표로 읽게 한다.
여기서 asset은 운영 데이터 자체가 아니라 PR diff, MCP config, transcript/log처럼 배포 전에 증거로 제출할 수 있는 agent-facing artifact다.

Fresh clone에서는 `npm ci && npm run build` 후 아래 `node dist/index.js ...` commands를 그대로 실행한다.
npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

## Company problem → Agent asset inventory → command → approval condition

| Company problem | Agent asset inventory | Exact AgentGuard command | Expected verdict | Approval owner/condition |
|---|---|---|---|---|
| PR diff에 agent-visible token, risky shell, unsafe rollout code가 들어갈 수 있다. | PR diff: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`; key machine field: `ruleId`. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` for secret-like or dangerous command findings; `PASS` only after risky lines are removed and the same command is rerun. | Release owner stops merge on `BLOCK`; security reviewer may record a narrow `REVIEW` condition only when the residual risk is named. |
| MCP config가 broad filesystem access 또는 credential passthrough를 agent tool surface로 노출한다. | MCP config: `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`; output contracts: JSON and rule IDs. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK` or `REVIEW` for broad tool permission and credential exposure; `PASS` after least-privilege config rerun. | Security owner approves only with reduced paths/tools or a written exception condition tied to the finding. |
| Agent transcript/log가 승인되지 않은 shell behavior나 policy-sensitive action을 남긴다. | Agent transcript/log plus policy: `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, `examples/agent-policy.yaml`; reviewer artifacts may include Markdown, JSON, or SARIF depending on command options. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` when policy-sensitive action needs human approval; `BLOCK` if local policy treats the action as stop-ship; `PASS` after rerun shows no finding. | Business owner approves only the business action; security owner records residual risk; operations owner reruns the same fixture-backed command. |

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, data exposure, and mitigation vocabulary for explaining why agent-facing assets need inventory. | Do not claim OWASP coverage, formal assurance, or a complete threat program. | Map PR diff and transcript/log assets to `agentguard scan-diff` and `agentguard scan-log` evidence, then require a human owner for `BLOCK` or `REVIEW`. |
| MCP security best practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | least privilege, authorization framing, token handling, and user-consent vocabulary for MCP config review. | Do not claim AgentGuard enforces MCP runtime authorization, OAuth/session controls, consent UI, or server behavior. | Treat MCP config as an asset inventory row and route it through `agentguard scan-mcp` before rollout approval. |
| Tencent AI-Infra-Guard — https://github.com/Tencent/AI-Infra-Guard | AI infra and agent/MCP surface inventory framing for explaining why assets should be listed before rollout. | Do not claim vendor-scale inventory, customer adoption, broad suite scope, or that AgentGuard substitutes for another scanner. | Keep the AgentGuard slice to fixture-backed PR diff, MCP config, and transcript/log checks with explicit approval owner/condition. |

## Evidence handling notes

- Keep command spelling and machine contracts unchanged: `node dist/index.js`, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `ruleId`, rule IDs, JSON, SARIF, API.
- Store evidence by input class: PR diff, MCP config, transcript/log, and policy file. Do not rename command output fields for presentation.
- A risky fixture can exit nonzero and still produce useful reviewer evidence. The approval owner decides from the `PASS / REVIEW / BLOCK` verdict and the documented condition.
- Bash/Zsh examples use `<` stdin redirection. PowerShell operators can use `Get-Content <fixture> -Raw | node dist/index.js <subcommand>` with the same fixture paths.
- Synthetic fixture paths are the only inputs documented here: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished, or adoption claim.
- No external audit badge, standards badge, or formal assurance claim.
- No statement that AgentGuard replaces OWASP guidance, MCP authorization, GitHub code scanning, SAST, or a broad AI security suite.
- No product rename and no change to CLI commands, rule IDs, `ruleId`, JSON, SARIF, API, or machine fields.
- This card adds no CLI behavior, no new scanner rule, no dashboard/auth/SaaS surface, and no private data upload flow.
