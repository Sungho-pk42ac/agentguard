# AX agent skill inventory evidence card

## 사용 목적

이 문서는 AX Rollout Guard를 **한국어 우선**으로 설명할 때, 회사가 Codex/Cursor/Claude Code/MCP 기반 agent를 업무에 넣기 전에 `skill/tool inventory`를 어떻게 증거화하고 승인 결정으로 넘길지 30초 안에 보여 주는 카드입니다.

핵심 메시지는 “스캐너가 위험을 찾았다”가 아니라 “agent가 읽고, 실행하고, 내보낼 수 있는 skill/tool 표면을 PR diff / MCP config / transcript/log / SARIF artifact로 나눠서 reviewer가 `PASS` / `REVIEW` / `BLOCK` 결정을 내릴 수 있게 한다”입니다.

## 30초 skill/tool inventory flow

1. 회사 문제를 agent workflow로 바꿉니다: 어떤 파일을 읽고, 어떤 도구를 실행하고, 어떤 외부 산출물을 내보내는가?
2. 입력 표면을 분리합니다: `PR diff`, `MCP config`, `transcript/log`, `SARIF`, `Markdown report`.
3. 아래 exact command를 같은 fixture로 재실행해 `BLOCK` / `REVIEW` / `PASS` evidence를 만듭니다.
4. reviewer는 evidence artifact와 residual risk를 보고 승인 결정을 남깁니다. `BLOCK`이면 rollout 중지, `REVIEW`면 제한 조건/owner를 남긴 뒤 재실행, `PASS`면 현재 범위 안에서만 승인합니다.

## Company problem → skill/tool surface → evidence command → approval decision

| Company problem | Skill/tool surface | Exact evidence command | Expected verdict | Approval decision |
|---|---|---|---|---|
| 커머스 VOC agent가 PR에서 토큰이나 고객 메모를 읽을 수 있는가? | PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` or `REVIEW` with `secret.github_token` style rule IDs | security reviewer가 secret 제거 또는 fixture/policy 수정 전 rollout을 승인하지 않습니다. |
| VOC automation이 broad filesystem MCP server를 통해 과도한 파일 접근을 얻는가? | MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK` or `REVIEW` with `mcp.broad_filesystem_access` | agent platform owner가 root/write permission을 축소하고 같은 command를 다시 실행합니다. |
| Agent transcript가 승인 없는 export/delete shell command를 실행하려 하는가? | transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `BLOCK` or `REVIEW` with `denied-command` / `approval-required` | business owner가 허용 작업인지 확인하고, 승인 없이는 실행하지 않습니다. |
| CI reviewer에게 artifact를 넘겨야 하는가? | SARIF + Markdown report | `node dist/index.js scan-diff --sarif --out .agentguard-demo/skill-inventory/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF artifact containing `ruleId`, `result`, `location`, `artifact` | GitHub code scanning / reviewer handoff용 evidence만 생성합니다. 자동 승인이나 자동 업로드를 주장하지 않습니다. |

> Fresh-clone note: `node dist/index.js ...` commands require `npm ci && npm run build` first. Installed-package examples may use `agentguard scan-diff`, `agentguard scan-mcp`, and `agentguard scan-log` with the same fixture paths.

## Public reference borrow / avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Agent/tool misuse, excessive permission, and mitigation framing. | Complete OWASP coverage or external assurance claim. | Map each risky skill/tool surface to a rerunnable command and owner decision. |
| MCP Authorization — https://modelcontextprotocol.io/specification/draft/basic/authorization | Authorization, session, redirect, and state-boundary vocabulary. | Runtime OAuth, token scope, redirect URI, or session enforcement claim. | Treat MCP evidence as static config proof and residual-risk handoff for the platform owner. |
| GitHub SARIF upload/code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF artifact as reviewer-readable handoff. | Claiming automatic upload, automatic approval, or GitHub product replacement. | Generate a SARIF file path that a human/CI workflow can preserve as evidence. |
| Snyk agent-scan — https://github.com/snyk/agent-scan | Public signal that agent/MCP/skill scanning is a real security category. | Snyk same-breadth or platform-width claim. | Position AgentGuard narrowly as local Korean-first rollout evidence over current fixtures. |
| Tencent AI-Infra-Guard — https://github.com/Tencent/AI-Infra-Guard | Public signal that agent, skills, MCP, infra, and red-team surfaces are converging. | Full AI security platform or red-team scope claim. | Keep this slice focused on PR diff + MCP config + transcript/log evidence and approval routing. |

## Static pre-rollout boundary

- This card is **static pre-rollout** evidence: it reads text fixtures and generated artifacts before deployment.
- AgentGuard는 runtime authorization을 구현하지 않습니다. OAuth redirect validation, session binding, live SaaS permission, runtime token scope, production telemetry, and live MCP server enforcement are residual risks for the owning platform/team.
- The card does not start untrusted MCP servers, execute production commands, or connect to customer systems.
- `PASS` means the scanned fixture/policy scope has no blocking finding under current rules; it is not a blanket business approval.
- `REVIEW` means a human owner must decide whether to allow, narrow, or rerun the workflow.
- `BLOCK` means rollout should stop until the source artifact is fixed and the same command is rerun.

## English-compatible machine contracts

Keep machine-facing contracts English-compatible so CI, SARIF, API consumers, and package users do not break:

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`
- Verdicts: `PASS`, `REVIEW`, `BLOCK`
- rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`, `denied-command`, `approval-required`
- JSON / SARIF / API machine fields: `ruleId`, `result`, `location`, `artifact`

Human Markdown can be Korean-first, but CLI verbs, rule IDs, JSON keys, SARIF keys, and API fields remain stable.

## Non-claim guardrails

- Do not present deployed-customer proof, audit badge status, standards attestation, or third-party verification.
- Do not present AgentGuard as a substitute for Snyk, Tencent AI-Infra-Guard, GitHub code scanning, or a full security platform.
- Do not present live OAuth/session/authorization controls as implemented.
- Do not claim automatic SARIF upload or automatic approval; the command produces local evidence that a workflow or reviewer can preserve.
- Do not claim coverage beyond the current fixture-backed PR diff, MCP config, transcript/log, Markdown report, JSON, and SARIF surfaces.
