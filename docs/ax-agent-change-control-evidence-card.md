# AX agent change-control evidence card

한국어 우선 변경관리 카드입니다. 기업이 AI agent 변경을 업무 배포 전에 승인, 보류, 차단할 때 `change request -> AgentGuard evidence -> approver decision -> rollback/rerun` 흐름을 한 장으로 남깁니다.

범위는 현재 저장소의 합성 fixture와 구현된 CLI evidence입니다. 새 scanner behavior, default severity, blocking policy, SaaS/dashboard/auth, runtime MCP/OAuth control을 추가하거나 주장하지 않습니다.

## 목적

대상권/AX 심사 대응에서 "AI agent가 무엇을 바꿨고, 배포 전에 누가 무엇을 보고 승인했는가"를 설명합니다. AgentGuard는 PR diff, MCP config, transcript/log, SARIF/Markdown artifact를 정적 pre-rollout evidence로 묶고, 담당자가 승인 조건과 rollback/rerun 조건을 남기게 합니다.

## 변경관리 증거 카드

| change request | AgentGuard evidence | approver decision | rollback/rerun |
|---|---|---|---|
| Agent가 만든 PR diff에 secret-like 값이나 위험한 shell 변경이 들어간다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK`이면 배포 차단, `REVIEW`이면 security owner가 제거 조건과 잔여 위험을 승인한다. | secret-like 값과 destructive command를 제거한 뒤 같은 `agentguard scan-diff` surface를 재실행한다. |
| Agent가 사용할 MCP config가 broad filesystem access, writable root, credential passthrough를 넓힌다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `BLOCK`이면 연결 차단, `REVIEW`이면 tool owner가 최소 권한 범위와 token boundary를 승인한다. | root scope, writable path, env passthrough를 줄이고 같은 `agentguard scan-mcp` evidence를 다시 만든다. |
| Agent transcript/log에 승인 없는 민감 파일 접근, 강제 push, 삭제성 명령이 남는다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `REVIEW`이면 business owner가 작업 필요성, rollback owner, 재실행 조건을 기록한다. | 정책 위반 action을 중단하거나 policy approval을 기록한 뒤 같은 `agentguard scan-log` command로 재검증한다. |

## Fixture-backed evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build`로 `dist/` artifact를 만듭니다. npm/global 설치 후에는 같은 subcommands를 `agentguard ...` CLI로 실행할 수 있습니다.

### PR diff

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
```

Expected verdict: `BLOCK` 또는 `REVIEW`. 이 evidence는 PR diff에 보이는 `secret.openai_api_key` 같은 rule IDs와 risky command material을 reviewer-visible Markdown/terminal finding으로 만든다.

### MCP config

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
```

Expected verdict: `BLOCK` 또는 `REVIEW`. 이 evidence는 `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, credential-like env passthrough를 rollout 전 tool authorization boundary 질문으로 바꾼다.

### Transcript/log

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

Expected verdict: `BLOCK` 또는 `REVIEW`. 이 evidence는 `agent.policy.denied_command`와 policy-required action을 담당자 승인 또는 보류 조건으로 남긴다.

### SARIF reviewer artifact

```bash
node dist/index.js scan-diff --sarif --out .agentguard-change-control/agentguard.sarif < examples/risky-pr.diff
```

`examples/agentguard.sarif`는 sample SARIF shape입니다. GitHub code scanning upload workflow에 올릴 수 있는 reviewer-visible channel로 설명하되, AgentGuard의 현재 범위는 SARIF/Markdown artifact 생성과 reviewer handoff 설명입니다. Markdown report와 SARIF는 같은 finding을 다른 reviewer channel에 전달하는 artifact입니다. `--out .agentguard-change-control/agentguard.sarif`는 로컬 파일 쓰기이며 parent directory는 CLI가 생성합니다. 이 fixture smoke는 외부 서비스로 secret-like sample을 전송하지 않습니다.

## 승인/보류/차단 decision table

| Verdict | 업무 결정 | 남겨야 할 증거 |
|---|---|---|
| `BLOCK` | 차단. 업무 배포, MCP 연결, PR merge를 진행하지 않는다. | 차단 finding, 제거할 조건, rollback owner, rerun command. |
| `REVIEW` | 보류 또는 조건부 승인. 담당자가 residual risk와 보완 조건을 명시해야 한다. | approver, 승인 범위, 만료일 또는 재검토 조건, 같은 command rerun 계획. |
| `PASS` | 현재 fixture/surface 기준 진행 후보. 운영 approval workflow를 대신하지 않는다. | 실행 command, timestamp, artifact path, 남은 runtime evidence gap. |

## Rollback and rerun

1. `BLOCK`이면 변경을 rollback하고 같은 evidence command를 다시 실행할 때까지 배포하지 않는다.
2. `REVIEW`이면 approver decision에 보완 조건, residual risk owner, rollback owner를 기록한다.
3. 수정 후에는 처음과 같은 command, 같은 fixture/surface에서 rerun evidence를 남긴다.
4. SARIF/Markdown/terminal output은 reviewer가 볼 artifact로 보존한다.

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Borrow: agent autonomy, tool misuse, excessive agency, mitigation/control vocabulary. | Avoid: OWASP certification, full agent threat coverage, feature parity claim. | AgentGuard action: findings를 mitigation/approval decision으로 낮춰 PR diff와 transcript/log evidence에 연결한다. |
| MCP Security Best Practices: https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Borrow: least privilege, user consent, token/tool authorization boundary framing. | Avoid: runtime OAuth, MCP authorization, consent UI control claim. | AgentGuard action: `scan-mcp` static config evidence와 `scan-log` policy evidence로 pre-rollout approval question을 만든다. |
| GitHub SARIF/code scanning upload: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | Borrow: reviewer-visible security finding channel and artifact upload vocabulary. | Avoid: GitHub Advanced Security parity, native GitHub app, hosted dashboard claim. | AgentGuard action: SARIF/Markdown/terminal evidence를 PR reviewer handoff artifact로 라우팅한다. |

## Machine-contract boundaries

- Machine-facing strings stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, rule IDs, JSON, SARIF, API, machine fields.
- CLI names, command arguments, verdict strings, JSON/SARIF field names, and rule IDs stay stable and English-compatible for presentation.
- Representative rule IDs in this card include `secret.openai_api_key`, `mcp.broad_filesystem_access`, and `agent.policy.denied_command`.
- This card explains static pre-rollout evidence only. Runtime token scope, SaaS permission state, MCP server-side authorization, and production approval workflow need separate owner evidence.

## Non-claim guardrails

- No customer logo, named buyer, rollout-finished, adoption, or reference-customer claim.
- No audit-standard badge, formal assurance, or external validation claim.
- External references are framing sources only, not AgentGuard trust marks.
- No claim that AgentGuard provides runtime OAuth/MCP authorization control or displaces GitHub Advanced Security/code scanning.
- No broad red-team platform, dashboard, SaaS, auth, or runtime monitoring claim.
