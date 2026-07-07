# AX reviewer channel routing card

한국어 우선 routing card로 AX Rollout Guard 심사자와 회사 reviewer가 어느 stakeholder가 어떤 artifact를 검토하는지 30초 안에 확인하게 한다.
CLI commands, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## 30초 reviewer channel map

1. 회사 문제: commerce VOC agent rollout에서 PR diff, MCP config, agent transcript/log가 배포 전 reviewer handoff로 올라가야 한다.
2. channel 선택: Markdown은 business/security reviewer가 읽고, SARIF/GitHub code scanning은 code reviewer가 alert로 본다. PR/CI artifact는 release owner가 보존하고, terminal/local operator review는 현장 operator가 즉시 재현한다. security approver memo는 최종 승인자가 residual risk를 문장으로 남긴다.
3. evidence source: 아래 명령은 모두 synthetic fixture-backed command이며 scanner behavior, CLI name, rule ID, machine field를 바꾸지 않는다.
4. approval reading: `BLOCK`은 rollout 중지 또는 수정 후 재스캔, `REVIEW`는 security approver가 잔여 위험 승인, `PASS`는 현재 evidence 기준으로 다음 gate 진행이다.

## Channel routing table

| Reviewer channel | Primary stakeholder | Artifact to review | Exact fixture-backed command | Approval sentence |
|---|---|---|---|---|
| Markdown | business owner + security reviewer | 한국어 우선 Markdown/terminal report for PR diff risk | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | "`BLOCK`이면 secret-like diff 또는 risky shell change를 제거하고 재스캔한다." |
| SARIF/GitHub code scanning | code reviewer in PR | SARIF rule/result/location artifact for GitHub code scanning upload | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | "`BLOCK` alert는 PR merge stop 신호이며, `agentguard.sarif`는 reviewer artifact로 보존한다." |
| PR/CI artifact | release owner | CI log plus generated `agentguard.sarif` or Markdown report | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | "CI에서 finding 때문에 nonzero가 나와도 artifact upload step은 보존 대상으로 분리한다." |
| terminal/local operator review | local operator | MCP config terminal verdict before rollout | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | "`REVIEW` 또는 `BLOCK`이면 broad filesystem root, writable path, credential passthrough를 줄인다." |
| security approver memo | security approver | transcript/log policy finding and residual-risk memo | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | "`REVIEW`는 approver memo에 허용 조건, owner, rerun date를 남긴 뒤 gate 진행 여부를 정한다." |

## Fixture-backed command contract

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한다. npm/global 설치 후에는 같은 subcommands를 `agentguard ...` CLI로 실행할 수 있다.

- PR diff Markdown: `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- PR diff SARIF/GitHub code scanning: `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- MCP local operator review: `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- Transcript security approver memo: `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`

Fixture inputs are synthetic and existing repo files: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.

## Public reference borrow/avoid/action rows

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| GitHub SARIF/code scanning upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF file upload, code scanning alert, PR reviewer artifact flow. | Do not say AgentGuard replaces GitHub security products or provides native GitHub account workflows. | Route PR diff findings through `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` and keep Markdown as reviewer-readable context. |
| Agentshield-style GitHub Action/App packaging — https://github.com/affaan-m/agentshield | CLI, GitHub Action/App packaging vocabulary for explaining delivery channels. | Do not say AgentGuard has a GitHub App or equivalent hosted integration. Current proof is CLI, CI command, and SARIF artifact. | Name the current reviewer channels as CLI/CI/SARIF and avoid app-level claims until a real integration exists. |
| Tencent `AI-Infra-Guard` — https://github.com/Tencent/AI-Infra-Guard | Broad AI infra, agent, MCP risk taxonomy language. | Do not claim full-stack red-team suite coverage or Tencent feature equality. | Narrow taxonomy language into current AgentGuard surfaces: PR diff, MCP config, transcript/log. |
| splx-ai `agentic-radar` — https://github.com/splx-ai/agentic-radar | Agentic workflow scanner category language. | Do not claim runtime monitoring, attack simulation, or coverage beyond deterministic fixtures. | Tie workflow risk to reproducible commands backed by current synthetic fixture files. |

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished, or external assurance claim.
- No statement that AgentGuard replaces GitHub code scanning, Agentshield, Tencent AI-Infra-Guard, splx-ai agentic-radar, SAST, MCP authorization, or a broad AI security suite.
- No GitHub App, dashboard, auth, SaaS, runtime monitoring, or attack simulation claim.
- No product rename and no change to CLI commands, rule IDs, JSON, SARIF, API, or machine fields.
- Synthetic fixtures remain synthetic: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.
