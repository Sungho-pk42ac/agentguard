# AX SARIF reviewer loop card

한국어 우선 운영 설명으로 AX Rollout Guard 심사자가 30초 안에 company problem, AgentGuard evidence command, reviewer handoff, approval condition을 한 장에서 볼 수 있게 만든다.
CLI commands, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## 사용 목적

한국 커머스 VOC agent rollout에서 PR diff, MCP config, agent transcript/log가 배포 전에 사람 reviewer에게 올라가야 하는지 판단한다. 이 카드는 AgentGuard가 현재 제공하는 SARIF output과 Markdown/terminal evidence를 reviewer loop로 설명한다.

AgentGuard는 MCP 런타임 authorization, GitHub native integration, hosted SaaS dashboard를 대신 제공한다고 주장하지 않는다. 현재 범위는 fixture-backed command로 위험 신호를 만들고, reviewer가 `PASS / REVIEW / BLOCK` verdict와 approval condition을 확인하는 것이다. 이 카드는 배포 전 정적 PR/config/log evidence에 대한 point-in-time check이며, 런타임 중 동적으로 발생하는 권한 오용을 실시간 통제한다고 주장하지 않는다.

## 30초 reviewer loop

1. company problem: 상담 자동화 agent가 VOC, 주문, 내부 도구에 접근하면서 비밀 값, 넓은 filesystem 권한, 위험한 shell 동작이 PR과 로그에 남을 수 있다.
2. evidence command: 아래 fixture-backed commands로 PR diff, MCP config, agent transcript/log를 스캔한다.
3. reviewer handoff: GitHub code scanning upload workflow의 alert review 흐름에 맞춰 SARIF를 전달한다. Markdown/terminal report는 한국어 우선으로 reviewer에게 붙인다.
4. approval condition: `BLOCK`은 배포 중지, `REVIEW`는 담당자가 잔여 위험을 승인하거나 정책/코드 수정, `PASS`는 현재 evidence 기준으로 다음 rollout gate 진행이다.

## Company problem → evidence command → approval condition

| Company problem | Evidence command | Expected reviewer signal | Approval condition |
|---|---|---|---|
| PR diff에 agent-visible token 또는 위험한 shell 변경이 들어간다. | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF alert와 Markdown finding이 PR diff 위험을 reviewer에게 보여준다. | `BLOCK`이면 secret removal 또는 risky command 제거 후 재스캔, `REVIEW`이면 reviewer가 residual risk를 남긴다. |
| MCP config가 broad filesystem access 또는 credential passthrough를 노출한다. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `mcp.broad_filesystem_access` 같은 rule IDs가 MCP config 위험을 분리한다. | writable/broad root를 줄이고 필요한 MCP server/tool만 남긴 뒤 `PASS` 또는 명시적 `REVIEW` approval을 받는다. |
| agent transcript가 민감 경로 접근 또는 승인 필요 작업을 남긴다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | policy 기반 finding이 transcript/log의 승인 필요 작업을 표시한다. | `agentguard scan-log` 결과가 담당자 approval condition과 함께 기록되고, 미승인 작업은 rollback 또는 재실행한다. |

## SARIF reviewer handoff checklist

- Fresh clone에서 `node dist/index.js ...` 명령을 재현하려면 먼저 `npm ci && npm run build`를 실행한다. npm/global 설치 후에는 같은 subcommands를 `agentguard ...` CLI로 실행할 수 있다.
- `agentguard scan-diff --sarif --out agentguard.sarif`로 만든 SARIF file을 PR workflow artifact로 보존한다.
- CI에서 risky finding 때문에 scan step이 non-zero로 종료되면 SARIF upload step이 건너뛰어질 수 있다. reviewer에게 alert를 보여주는 workflow에서는 `continue-on-error: true` 또는 별도 artifact/upload step 분리를 명시해 SARIF 파일 보존을 우선한다.
- GitHub code scanning upload step을 쓰는 경우 GitHub가 요구하는 SARIF 2.1.0 subset과 alert display 흐름에 맞춰 reviewer가 alert를 본다.
- 같은 run에서 한국어 우선 Markdown/terminal report를 PR comment 또는 artifact로 남겨 `reviewer`, `approval condition`, residual risk를 사람이 읽게 한다.
- `agentguard scan-mcp`, `agentguard scan-log`, `agentguard scan-diff`, rule IDs, JSON, SARIF, API fields stay English-compatible.
- 대표 machine contracts: `secret.github_token`, `mcp.broad_filesystem_access`.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| MCP security best practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | confused-deputy, authorization, user-consent framing for why broad agent/tool access needs explicit review. | Do not claim AgentGuard enforces MCP runtime authorization, OAuth state, consent UI, or session controls. | Surface MCP config risk through `agentguard scan-mcp` and require a human approval condition before rollout. |
| GitHub SARIF code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF upload workflow and developer-reviewer alert framing. | Do not claim native GitHub app integration beyond current SARIF output and documented workflow. | Emit SARIF from `agentguard scan-diff --sarif --out agentguard.sarif` and hand it to reviewer-owned code scanning workflow. |
| Snyk agent-scan — https://github.com/snyk/agent-scan | AI-agent, MCP, agent-skill scanner category framing for public positioning. | Do not claim feature equality, customer adoption, or that AgentGuard covers every agent-security surface. | Position AgentGuard as a small Korean-first AX Rollout Guard slice using current fixture-backed PR diff, MCP config, and transcript/log checks. |

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished, or adoption claim.
- No external audit badge, standards badge, or formal assurance claim.
- No statement that AgentGuard is a substitute for Snyk, GitHub code scanning, MCP authorization, SAST, or a broad AI security suite.
- No product rename and no change to CLI commands, rule IDs, JSON, SARIF, API, or machine fields.
- Synthetic fixtures remain synthetic: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.
