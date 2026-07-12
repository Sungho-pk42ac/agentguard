# AX agentic tool-use approval queue

한국어 우선 카드입니다. 본선에서 회사 문제가 바뀌어도, AgentGuard evidence를 `agent/tool action → source artifact → approval owner → decision → rerun trigger` 큐로 바꿔 심사위원과 실무 승인자가 같은 화면을 보게 하는 목적입니다.

## purpose

AX Rollout Guard는 agent가 PR diff, MCP config, transcript/log, workspace artifact를 통해 어떤 작업을 하려는지 먼저 증거화합니다. 이 카드는 그 증거를 `PASS` / `REVIEW` / `BLOCK` 승인 큐로 낮춰 표현합니다. AgentGuard는 static pre-rollout scanner입니다. MCP server를 실행하지 않고, runtime authorization, OAuth/session validation, consent UI, live tool sandbox, hosted approval dashboard, GitHub SARIF upload workflow를 구현했다고 주장하지 않습니다.

## approval queue map

| Agent/tool action surface | Source evidence | Exact evidence command / artifact | Approval owner | Queue decision | Rerun trigger |
| --- | --- | --- | --- | --- | --- |
| PR diff가 secret-like token 또는 위험한 shell change를 포함 | `examples/risky-pr.diff` | `node dist/index.js scan-diff < examples/risky-pr.diff` | PR owner + security reviewer | `BLOCK`이면 merge 전 token 제거/fixture 교체, `REVIEW`이면 business owner가 residual risk 확인 | PR diff가 바뀌거나 policy가 바뀌면 같은 명령 재실행 |
| MCP config가 broad filesystem root 또는 writable path를 요청 | `examples/risky-mcp.json` | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Agent platform owner + security reviewer | `BLOCK`이면 root/path 축소, `REVIEW`이면 least-privilege 예외 사유 기록 | MCP server config, tool permission, env passthrough가 바뀌면 재실행 |
| agent transcript/log가 approval-required operation이나 denied command를 노출 | `examples/agent-transcript.log` + `examples/agent-policy.yaml` | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Workflow owner + incident/security reviewer | `REVIEW`이면 승인자·시간 제한·수정 조건을 남기고, `BLOCK`이면 workflow 중단/정책 수정 | transcript, policy, denied command list가 바뀌면 재실행 |
| Reviewer가 GitHub/code-scanning style artifact를 요구 | `examples/risky-pr.diff` | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentic-tool-use-approval-queue.sarif < examples/risky-pr.diff` | CI owner + security reviewer | SARIF file을 reviewer handoff artifact로 보존; upload/triage/approval은 별도 owner workflow | scanner version, PR diff, SARIF upload workflow가 바뀌면 artifact 재생성 |
| 30초 데모에서 PR/MCP/transcript/SARIF 묶음 재현성이 필요 | `scripts/ax-demo-smoke.mjs` | `npm run smoke:ax-demo` → `.agentguard-demo/ax-evidence-smoke/manifest.json` | Demo operator + judge-facing reviewer | `PASS`/`REVIEW`/`BLOCK` evidence bundle이 같은 run에서 생성됐는지 확인 | package build, fixture, smoke script, demo command가 바뀌면 재실행 |

## exact evidence commands

Fresh clone or clean demo terminal prerequisite:

```bash
npm ci && npm run build
```

Reviewer-facing queue commands:

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentic-tool-use-approval-queue.sarif < examples/risky-pr.diff
npm run smoke:ax-demo
```

Expected artifact paths:

- `.agentguard-demo/agentic-tool-use-approval-queue.sarif`
- `.agentguard-demo/ax-evidence-smoke/manifest.json`

Risky fixtures may intentionally produce non-zero scanner exits when findings are `BLOCK`-level. Treat that as evidence only after checking the verdict shape and artifact path, not as a shell failure to hide.

## public reference rows

| Public reference | Borrow | Avoid | AgentGuard approval-queue use |
| --- | --- | --- | --- |
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent/tool misuse, excessive agency, human-control and mitigation language | OWASP coverage, certification, endorsement, or full runtime mitigation claim | 각 finding을 owner decision, mitigation condition, and rerun evidence로 낮춰 승인 큐에 넣는다. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | least privilege, user consent, tool authorization, token/permission boundary language | runtime OAuth/session/consent enforcement, live MCP server control, MCP conformance claim | `scan-mcp` evidence를 static pre-rollout proof로 두고, residual runtime authorization risk는 platform owner에게 남긴다. |
| GitHub SARIF support for code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF `ruleId`, `artifactLocation`, `region.startLine`, reviewer-visible code-scanning handoff vocabulary | automatic SARIF upload, triage completion, GitHub product replacement, external approval claim | `--sarif --out` artifact를 CI/security reviewer가 보존·업로드할 수 있는 source-of-record file로 만든다. |

## machine-contract boundaries

Keep these contracts English-compatible so npm, CI, JSON, SARIF, and downstream scanners remain stable:

- Verdicts: `PASS`, `REVIEW`, `BLOCK`
- Commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- CLI surfaces: `scan-diff`, `scan-mcp`, `scan-log`, `--sarif`, `--out`, `--policy`
- Artifact formats: `JSON`, `SARIF`, Markdown report
- SARIF fields: `ruleId`, `artifactLocation`, `region.startLine`
- Example source files: `examples/risky-pr.diff`, `examples/risky-mcp.json`, `examples/agent-transcript.log`, `examples/agent-policy.yaml`

한국어 문서는 business approval language를 설명하지만, 위 machine contracts를 한국어 이름으로 바꾸지 않습니다.

## claim guardrails

- 말할 수 있는 것: AgentGuard는 synthetic fixture와 local command로 agentic tool-use risk를 재현하고, reviewer가 승인/차단/재실행할 수 있는 evidence queue를 만든다.
- 말하지 않는 것: 실제 고객 도입, 외부 인증, OWASP/GitHub/MCP 공식 검증, Snyk/CodeQL/GitHub code scanning 대체, runtime OAuth/session/authorization/consent/token enforcement, live MCP server sandbox, automatic SARIF upload, automatic approval.
- 회사 데이터 경계: 이 카드는 repository의 synthetic examples를 사용한다. real customer data, private transcript, production token, live workspace export는 포함하지 않는다.
