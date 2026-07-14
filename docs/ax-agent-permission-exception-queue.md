# AX agent permission exception queue

## 목적

한국어 우선 **permission exception queue** 카드는 기업이 Codex, Claude Code, Cursor, MCP server 같은 agent/tool을 업무에 넣을 때 “이 tool permission 예외를 누가, 어떤 증거로 승인하나?”를 30초 안에 설명하기 위한 AX Rollout Guard handoff입니다. 범위는 docs-contract slice입니다. Scanner behavior, CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine fields는 바꾸지 않습니다.

AX 본선의 회사 문제는 현장에서 바뀔 수 있으므로, 이 카드는 특정 업종에 고정하지 않습니다. 대신 새 agent/tool이 요구하는 읽기·쓰기·실행·export 권한을 기존 AgentGuard source-of-record evidence command에 연결하고, approval owner와 rerun trigger를 남깁니다.

> 핵심 문장: “agent permission mode는 편의 설정이 아니라 운영 예외입니다. 예외를 허용하려면 `doctor`, MCP config, transcript/log, PR diff, SARIF evidence를 같은 build 기준으로 확인하고 `PASS` / `REVIEW` / `BLOCK` 결정을 남깁니다.”

## Permission exception route

| Permission exception | AgentGuard evidence | Approval owner/decision | Rerun trigger |
|---|---|---|---|
| 새 agent/tool이 처음 설치되거나 CI runner에서 처음 실행된다. | `agentguard doctor` / `node dist/index.js doctor --json` | Platform owner가 package/build/example readiness를 확인한다. `REVIEW`이면 missing build artifact나 packageVersion mismatch를 먼저 재현한다. | Node version, packageVersion, install source, runner image, repo checkout이 바뀌면 재실행한다. |
| MCP server가 broad filesystem root, writable path, env token passthrough를 요구한다. | `agentguard scan-mcp` / `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | AgentOps/security owner가 least privilege로 줄일지, residual risk를 `REVIEW` exception으로 둘지 결정한다. `mcp.broad_filesystem_access` / `mcp.filesystem_writable_path`가 있으면 기본은 rollout stop입니다. | MCP command, root/path, writable directory, env allowlist, token handling이 바뀌면 재실행한다. |
| agent transcript/log에 승인 없는 shell, export, 삭제, 배포, 민감 경로 접근이 보인다. | `agentguard scan-log` / `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | 업무 owner가 목적·rollback·재실행 조건을 기록한다. `denied-command` 또는 approval-required action이면 `BLOCK` 또는 named-owner `REVIEW`가 필요하다. | prompt, system instruction, tool policy, transcript/log source, approval-required operation list가 바뀌면 재실행한다. |
| agent가 만든 PR diff를 merge하기 전에 permission exception evidence를 reviewer에게 넘긴다. | `agentguard scan-diff --sarif` / `node dist/index.js scan-diff --sarif --out .agentguard-demo/permission-exception/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | PR reviewer/security owner가 `ruleId`, `locations`, severity, redacted evidence를 보고 merge stop/fix/rerun을 결정한다. | PR head SHA, source diff, SARIF workflow, reviewer channel, artifact path가 바뀌면 재실행한다. |

## Exact fixture-backed commands

Fresh clone에서는 repository root에서 `npm ci && npm run build` 후 아래 명령을 실행합니다. 위험 fixture는 의도적으로 `BLOCK` 또는 `REVIEW`를 만들 수 있으므로 exit code만 보지 말고 verdict, ruleId, redacted evidence, artifact path를 함께 확인합니다.

```bash
node dist/index.js doctor --json
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/permission-exception/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

| Command | Source fixture / artifact | Permission question |
|---|---|---|
| `node dist/index.js doctor --json` | local package/build/examples readiness | 이 agent/tool permission queue를 같은 build에서 재현할 수 있는가? |
| `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP filesystem/env permission이 least privilege인가, 아니면 root/path/env 축소가 필요한가? |
| `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | 실행된 tool action이 정책상 승인 가능한가, 아니면 업무 owner 예외 승인이나 rollback이 필요한가? |
| `node dist/index.js scan-diff --sarif --out .agentguard-demo/permission-exception/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `.agentguard-demo/permission-exception/pr-diff.sarif` | PR reviewer가 `ruleId`, `locations`, severity를 보고 permission exception을 merge 전에 판단할 수 있는가? |

## Public references: Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, excessive agency, tool misuse, credential exposure를 permission exception 질문으로 바꾼다. | OWASP coverage, external assurance, certification, complete platform claim. | PR diff, MCP config, transcript/log evidence를 stop/review/pass decision과 rerun trigger에 묶는다. |
| MCP Authorization — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | authorization boundary, resource owner, client/server responsibility language를 MCP rollout 질문으로 빌린다. | runtime OAuth, redirect URI validation, state/session binding, authorization server role claim. | 현재 static evidence는 `scan-mcp`와 `scan-log`로 permission exception을 드러내고, runtime auth는 별도 owner 질문으로 남긴다. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, user consent, audit/logging, token boundary 언어를 권한 축소 조건으로 빌린다. | MCP conformance, consent UI implementation, live policy enforcement claim. | broad root, writable path, credential passthrough를 rollout 전 수정 또는 named-owner approval 조건으로 둔다. |
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF file, `ruleId`, location, reviewer channel handoff vocabulary를 빌린다. | automatic upload, GitHub triage 완료, approval 완료, CodeQL/GitHub code scanning parity claim. | `scan-diff --sarif --out ...` artifact를 permission exception review packet으로 남기되 upload/triage/승인은 workflow owner가 결정한다고 쓴다. |
| Anthropic Claude Code Security — https://docs.anthropic.com/en/docs/claude-code/security | least privilege, managed permissions, explicit approval mindset을 agent permission mode 설명에 빌린다. | AgentGuard가 Claude Code settings, enterprise policy, runtime permission enforcement를 관리한다고 말하지 않는다. | Codex/Claude Code/Cursor/MCP 권한 예외를 AgentGuard evidence command와 human approval owner에 연결한다. |

## Machine contracts

- Human-facing Markdown은 한국어 우선이지만 machine-facing contracts는 English-compatible로 유지한다.
- CLI commands: `agentguard doctor`, `agentguard scan-mcp`, `agentguard scan-log`, `agentguard scan-diff`.
- Flags and outputs: `--json`, `--policy`, `--sarif`, `--out`, `JSON`, `SARIF`, `ruleId`, `locations`.
- Verdict values: `PASS`, `REVIEW`, `BLOCK`.
- Rule examples: `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `denied-command`.
- This card has no scanner behavior change, no CLI/rule/severity/default policy change, no package publishing change, no hosted auth/dashboard/runtime enforcement, no runtime permission enforcement, and no automatic SARIF upload claim.

## Non-claim guardrails

- 실제 고객사 도입, production case study, active users, enterprise clients를 주장하지 않는다.
- SOC 2, ISO 27001, 공식 인증, OWASP/MCP/GitHub/Anthropic/Claude Code 검증 완료, official endorsement를 주장하지 않는다.
- Claude Code, Cursor, Codex, MCP, GitHub code scanning, CodeQL와 parity, replacement, equivalence, full compatibility를 주장하지 않는다.
- Runtime OAuth, session enforcement, consent UI, tool interception, permission enforcement, live guardrail enforcement를 구현했다고 말하지 않는다.
- SARIF/Markdown artifact는 reviewer handoff evidence이며, upload/triage/approval execution 자체는 configured workflow와 사람 owner의 책임이다.
