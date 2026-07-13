# AX agent tool onboarding readiness

## 목적

한국어 우선 **agent/tool onboarding readiness** 카드는 기업이 Codex, Claude Code, Cursor, Gemini, MCP server 같은 새 AI agent/tool을 업무에 넣기 전에, AgentGuard의 기존 evidence command로 rollout 승인 가능성을 5분 안에 확인하도록 돕는다. 범위는 docs-contract slice다. Scanner behavior, CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine fields는 바꾸지 않는다.

AX 인재전쟁 본선에서는 회사 문제가 현장에서 바뀔 수 있다. 이 카드는 특정 업종 시나리오에 과적합하지 않고, "새 agent/tool이 무엇을 읽고 실행하고 내보내며 PR에 남기는가"를 source-of-record command와 reviewer handoff로 정리한다.

> 핵심 문장: "새 agent/tool은 설치 자체가 승인이 아닙니다. `doctor` readiness, MCP config, transcript/log, PR diff, SARIF handoff evidence를 같은 commit/build 기준으로 확인한 뒤 `PASS` / `REVIEW` / `BLOCK` 승인 결정을 남깁니다."

## Onboarding readiness route

| Onboarding checkpoint | AgentGuard evidence | Approval decision | Rerun trigger |
|---|---|---|---|
| 새 agent/tool을 설치했거나 CI에서 처음 실행한다. | `agentguard doctor` / `node dist/index.js doctor --json` | `PASS`: 로컬 예제·패키지·scanner 준비 상태가 설명 가능하다. `REVIEW`: missing example/build artifact가 있으면 먼저 재현한다. | packageVersion, install method, repo checkout, CI image가 바뀌면 재실행한다. |
| MCP server 또는 connector가 broad filesystem, writable path, credential passthrough를 요구한다. | `agentguard scan-mcp` / `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK`/`REVIEW`: root/path/env 권한을 줄이거나 approval owner가 residual risk를 기록한다. | MCP command, root/path, env token passthrough, policy가 바뀌면 재실행한다. |
| agent run transcript/log에 승인 없는 shell, export, 삭제, 민감 경로 접근이 보인다. | `agentguard scan-log` / `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW`/`BLOCK`: 업무 owner가 실행 목적, rollback, 재실행 조건을 확인한다. | prompt, tool policy, transcript/log source, approval-required operation list가 바뀌면 재실행한다. |
| agent가 만든 PR diff를 reviewer에게 넘긴다. | `agentguard scan-diff --sarif` / `node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-tool-onboarding/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF/Markdown은 reviewer handoff artifact다. `BLOCK`이면 merge/rollout은 중지하고 수정 diff를 같은 command로 다시 확인한다. | PR head SHA, source diff, SARIF workflow, reviewer channel, artifact path가 바뀌면 재실행한다. |

## Exact fixture-backed commands

Fresh clone에서는 repository root에서 `npm ci && npm run build` 후 아래 명령을 실행한다. 위험 fixture는 의도적으로 `BLOCK` 또는 `REVIEW`를 만들 수 있으며, exit code만 보지 말고 verdict, ruleId, redacted evidence, artifact path를 함께 확인한다.

```bash
node dist/index.js doctor --json
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-tool-onboarding/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

| Command | Source fixture / artifact | Expected reviewer question |
|---|---|---|
| `node dist/index.js doctor --json` | local package/build/examples readiness | 이 agent/tool onboarding demo를 같은 build에서 재현할 수 있는가? |
| `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP permission이 least privilege인가, 아니면 `mcp.broad_filesystem_access` / `mcp.filesystem_writable_path` 수정을 요구해야 하는가? |
| `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `denied-command` 또는 approval-required operation이 업무 승인 없이 실행됐는가? |
| `node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-tool-onboarding/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `.agentguard-demo/agent-tool-onboarding/pr-diff.sarif` | PR reviewer가 `ruleId`, `locations`, severity를 보고 merge stop/fix/rerun을 결정할 수 있는가? |

## Public references: Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent/tool misuse, excessive permission, credential exposure를 onboarding 승인 질문으로 바꾼다. | OWASP coverage, external assurance, certification, runtime firewall, complete AI security platform claim. | 새 agent/tool의 PR diff, MCP config, transcript/log evidence를 approval decision과 rerun trigger에 묶는다. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, token/credential boundary, user consent, authorization framing을 MCP config review 언어로 빌린다. | MCP conformance, OAuth/session enforcement, consent UI, runtime authorization implementation claim. | `scan-mcp` evidence에서 broad root, writable path, credential passthrough를 rollout 전 수정 또는 owner approval 조건으로 둔다. |
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF file을 reviewer/channel handoff artifact로 다루는 vocabulary를 빌린다. | automatic SARIF upload, GitHub triage 완료, approval 완료, CodeQL/GitHub code scanning parity claim. | `scan-diff --sarif --out ...` command와 artifact path를 남기되 upload/triage/승인은 workflow와 owner가 별도로 결정한다고 쓴다. |
| Snyk CLI scan and maintain docs — https://docs.snyk.io/developer-tools/snyk-cli/scan-and-maintain-projects-using-the-cli | CLI-first onboarding, scan, maintain loop의 제품 polish를 빌린다. | Snyk replacement, Snyk parity, third-party scanner equivalence, hosted account/security platform claim. | `doctor -> scan-mcp -> scan-log -> scan-diff/SARIF` 순서로 AgentGuard의 local/offline readiness evidence를 보여준다. |

## Machine contracts

- Human-facing Markdown은 한국어 우선이지만 machine-facing contracts는 English-compatible로 유지한다.
- CLI commands: `agentguard doctor`, `agentguard scan-mcp`, `agentguard scan-log`, `agentguard scan-diff`.
- Flags and outputs: `--json`, `--policy`, `--sarif`, `--out`, `JSON`, `SARIF`, `ruleId`, `locations`.
- Verdict values: `PASS`, `REVIEW`, `BLOCK`.
- Rule examples: `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `denied-command`.
- This card has no scanner behavior change, no CLI/rule/severity/default policy change, no package publishing change, no hosted auth/dashboard/runtime enforcement, and no automatic SARIF upload claim.

## Non-claim guardrails

- 실제 고객사 도입, production case study, active users, enterprise clients를 주장하지 않는다.
- SOC 2, ISO 27001, 공식 인증, OWASP/MCP/GitHub/Snyk 검증 완료, official endorsement를 주장하지 않는다.
- Snyk, GitHub code scanning, CodeQL, OWASP, MCP, public scanner와 parity, replacement, equivalence, full compatibility를 주장하지 않는다.
- Runtime OAuth, session enforcement, consent UI, tool interception, live guardrail enforcement를 구현했다고 말하지 않는다.
- SARIF/Markdown artifact는 reviewer handoff evidence이며, upload/triage/approval execution 자체는 configured workflow와 사람 owner의 책임이다.
