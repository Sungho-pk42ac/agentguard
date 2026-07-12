# AX agent runner sandbox boundary

한국어 우선 운영 카드입니다. AX Rollout Guard 심사자가 "AI agent runner가 shell, MCP tool, PR diff, transcript/log를 만났을 때 어디서 멈추고 누가 승인하는가?"를 30초 안에 확인하게 합니다. 이 문서는 static pre-run evidence를 다루며 AgentGuard scanner behavior, CLI commands, rule IDs, JSON, SARIF, API, machine fields는 바꾸지 않습니다.

## 사용 목적

AgentGuard는 기업이 Codex, Cursor, Claude Code, MCP 기반 agent runner를 업무 흐름에 넣기 전에 source artifact와 exact command로 위험 신호를 보여주는 approval gate입니다. 목적은 runtime sandbox를 대신 구현하는 것이 아니라, 실행 전에 reviewer가 "이 runner surface를 허용할 수 있는가"를 판단할 수 있는 증거를 고정하는 것입니다.

- `BLOCK`: runner 실행 또는 rollout을 멈추고 수정한 뒤 같은 command를 재실행합니다.
- `REVIEW`: human approval, residual risk owner, expiry/rerun trigger를 기록하기 전까지 자동 진행하지 않습니다.
- `PASS`: 같은 fixture/source 범위에서 현재 검사 기준상 blocker가 없다는 뜻입니다. 운영 승인, 외부 검증, runtime enforcement가 아닙니다.

## 30초 agent runner sandbox boundary flow

1. 회사 문제가 들어오면 agent runner가 읽거나 실행할 surface를 `PR diff`, `MCP config`, `transcript/log`, `SARIF` handoff로 나눕니다.
2. reviewer는 아래 exact evidence command를 fresh clone/build 뒤 재실행합니다.
3. `BLOCK` 또는 `REVIEW`가 나오면 sandbox/approval decision에 owner, 권한 축소 조건, rerun trigger를 남깁니다.
4. runner가 실제 shell/MCP/browser 작업을 수행하기 전, permission narrowing 또는 policy exception 승인 여부를 결정합니다.
5. SARIF artifact는 reviewer/security tooling handoff입니다. automatic SARIF upload나 business approval completion을 뜻하지 않습니다.

## Company problem → runner surface → evidence command → sandbox/approval decision

| Company problem | Runner surface | Exact evidence command | Expected verdict | Sandbox/approval decision |
|---|---|---|---|---|
| Agent가 PR에 secret-like material이나 risky shell snippet을 넣은 뒤 merge하려 한다. | PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK` | runner가 생성한 diff는 merge 전에 멈춘다. reviewer는 secret removal, scoped fixture replacement, same-command rerun을 요구한다. |
| MCP server config가 broad filesystem root, writable path, token passthrough를 runner에 열어준다. | MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `BLOCK` | MCP/tool owner가 least privilege root와 credential passthrough 제거를 승인 조건으로 둔다. |
| transcript/log에 destructive or approval-required command가 남는다. | transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `REVIEW` | operator가 명령 목적, rollback path, policy exception expiry를 남기기 전까지 runner 실행을 자동 진행하지 않는다. |
| security reviewer가 machine-readable artifact를 요구한다. | SARIF | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-runner-sandbox/agentguard.sarif < examples/risky-pr.diff` | `BLOCK` | `.agentguard-demo/agent-runner-sandbox/agentguard.sarif`를 reviewer-owned handoff로 저장한다. upload workflow와 approval decision은 별도 owner가 맡는다. |

## Public reference borrow / avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | least privilege, consent, confused deputy, SSRF, token handling language for explaining why runner tool permissions need a boundary. | MCP conformance, runtime authorization, runtime sandbox, consent UI, OAuth/session enforcement claim. | `scan-mcp` evidence를 static pre-run approval question으로 만들고 `mcp.broad_filesystem_access` / `mcp.env_credential` findings를 권한 축소 조건에 연결합니다. |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent tool misuse, excessive agency, mitigation, control vocabulary. | OWASP endorsement, complete threat coverage, certification, or external verification claim. | PR diff and transcript/log findings를 human approval checkpoint와 stop/rerun decision으로 설명합니다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF and code scanning artifact handoff vocabulary. | automatic SARIF upload, GitHub approval, alert triage completion, or GitHub code scanning replacement claim. | `scan-diff --sarif --out` command를 reviewer/security tooling handoff path로 문서화하고 upload owner는 별도로 둡니다. |

## Static pre-run boundary

This card is a static pre-run boundary. AgentGuard는 현재 source artifact를 읽고 scanner/report evidence를 생성합니다. AgentGuard는 runtime sandbox를 제공하지 않습니다. AgentGuard는 OAuth/session enforcement를 제공하지 않습니다. AgentGuard는 consent UI를 제공하지 않습니다. AgentGuard는 automatic SARIF upload를 제공하지 않습니다. AgentGuard는 customer-adoption evidence를 제공하지 않습니다. AgentGuard는 external certification을 제공하지 않습니다.

따라서 runner 운영 문장은 이렇게 제한합니다: "AgentGuard evidence가 runner 실행 전에 멈출 이유와 승인 조건을 제시한다." 이렇게 말하지 않습니다: "AgentGuard가 shell sandbox, MCP OAuth, session binding, consent prompt, GitHub upload, external approval을 자동 수행한다."

## English-compatible machine contracts

Human-facing Markdown can be Korean-first, but machine contracts remain English-compatible:

- CLI surfaces: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- Built CLI evidence commands: `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`.
- Rule IDs and findings include `mcp.broad_filesystem_access`, `mcp.env_credential`, `denied-command`.
- Machine output formats and field names stay stable: JSON, SARIF, API, `ruleId`, `result`, `location`, `artifact`.
- Verdict values stay English: `BLOCK`, `REVIEW`, `PASS`.

## Non-claim guardrails

- AgentGuard가 MCP, OWASP, GitHub code scanning을 대체하거나 동등하다고 말하지 않습니다.
- AgentGuard가 runtime sandbox, runtime authorization, OAuth/session enforcement, consent UI, runtime command blocking을 제공한다고 말하지 않습니다.
- SARIF artifact 생성은 reviewer handoff evidence이며 automatic SARIF upload, alert triage completion, business approval completion이 아닙니다.
- 운영 채택 사례, 운영 고객 데이터 스캔, SOC 2/ISO 27001, external certification, vendor-scale parity를 주장하지 않습니다.
- 이 문서는 synthetic fixture와 local command evidence를 runner approval question으로 묶는 docs-contract slice입니다.
