# AX env custody approval route

## 사용 목적

한국어 우선 AX Rollout Guard 데모에서 `env` custody를 30초 안에 설명하기 위한 승인 카드입니다. 기업이 Codex/Cursor/Claude Code/MCP 기반 agent workflow를 배포하기 전에, AgentGuard가 **MCP config의 credential passthrough**, **PR diff의 환경 변수형 secret 추가**, **transcript/log의 위험한 파일·명령 흔적**, **SARIF reviewer artifact**를 source-of-record evidence로 묶어 승인권자가 `BLOCK` / `REVIEW` / `PASS`를 판단하도록 돕습니다.

## 30초 env custody approval flow

1. **Company problem** — agent가 업무 repo, MCP server, transcript/log를 다루며 `GITHUB_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` 같은 환경 변수형 자격증명을 볼 수 있습니다.
2. **Evidence command** — reviewer는 fixture-backed command를 재실행해 `PR diff`, `MCP config`, `transcript/log`, `SARIF`, `Markdown report` 증거를 확인합니다.
3. **Approval decision** — credential passthrough나 broad filesystem root는 `BLOCK`, 승인·수정 조건이 남은 항목은 `REVIEW`, synthetic fixture에서 위험 신호가 제거되면 `PASS` 후보로 설명합니다.
4. **Rerun** — policy/fix 이후 같은 command를 다시 실행해 결과와 artifact hash를 갱신합니다.

## Company problem → env custody surface → evidence command → approval decision

| Company problem | Env custody surface | Exact evidence command | Expected verdict | Approval decision |
|---|---|---|---|---|
| MCP server가 repo root와 developer credential을 동시에 받는지 확인 | `MCP config` env passthrough and broad filesystem root | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `BLOCK` with `mcp.env_credential`, `mcp.broad_filesystem_access`, `secret.github_token` | secret manager reference로 대체하고 filesystem root/write scope를 줄일 때까지 배포 보류 |
| PR이 agent-visible env sample에 secret-like 값을 추가하는지 확인 | `PR diff` env additions | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK` with `secret.openai_key`, `secret.anthropic_key` | `.env.example`에는 placeholder 정책만 남기고 실제 key-shaped 값은 제거 |
| agent transcript가 env/file access 또는 destructive command를 남기는지 확인 | `transcript/log` shell behavior | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `BLOCK` / `REVIEW` with `denied-command` evidence | owner가 명령 목적과 rollback 조건을 확인하기 전까지 운영 실행 금지 |
| reviewer/security channel에 env custody finding을 넘기는지 확인 | `SARIF` reviewer artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/env-custody/agentguard.sarif < examples/risky-pr.diff` | nonzero risky scan plus `.agentguard-demo/env-custody/agentguard.sarif` artifact | SARIF는 reviewer handoff 자료이며 자동 승인 또는 automatic SARIF upload 완료 증거가 아님 |

## Public reference borrow / avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Borrow: agent/tool misuse, excessive permission, credential exposure를 승인권자 언어로 분해한다. | Avoid: AgentGuard가 OWASP의 전체 runtime mitigation suite를 구현했다고 말하지 않는다. | `scan-mcp`, `scan-diff`, `scan-log` evidence를 env custody 승인 조건으로 묶는다. |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | Borrow: authorization, session, redirect boundary를 명확히 분리한다. | Avoid: static pre-rollout scan이 OAuth state/session/redirect URI를 runtime에서 검증한다고 말하지 않는다. | MCP config text에 남은 env passthrough와 broad root를 배포 전 source-of-record evidence로 제시한다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | Borrow: SARIF/code scanning artifact는 reviewer와 security tool이 읽는 handoff format이다. | Avoid: GitHub code scanning을 대체하거나 동등하다고 말하지 않습니다. SARIF 업로드가 자동으로 끝났다고 주장하지 않는다. | `.agentguard-demo/env-custody/agentguard.sarif`를 재현 가능한 artifact 경로로 문서화하되 업로드·승인은 별도 운영 단계로 둔다. |

## Static pre-rollout boundary

이 카드는 **static pre-rollout** evidence route입니다. AgentGuard는 이 흐름에서 MCP server를 실행하지 않고, real customer data를 읽지 않으며, runtime authorization을 구현하지 않습니다. `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`는 입력 텍스트와 synthetic fixtures를 검사해 reviewer가 재실행 가능한 evidence를 만듭니다. OAuth/session/env isolation/network egress enforcement는 별도 제품 범위이며 여기서 구현되었다고 말하지 않습니다.

## English-compatible machine contracts

문서는 한국어 우선이지만 machine contracts는 그대로 유지합니다: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`, rule IDs, JSON, SARIF, API, `ruleId`, `result`, `location`, `artifact`, `BLOCK`, `REVIEW`, `PASS`, `secret.github_token`, `secret.openai_key`, `secret.anthropic_key`, `mcp.broad_filesystem_access`, `mcp.env_credential`, `denied-command`.

## Non-claim guardrails

- 운영 고객·레퍼런스·채택 성과 또는 SOC 2/ISO 27001 같은 인증을 주장하지 않습니다.
- GitHub code scanning, OWASP guidance, MCP Authorization spec을 대체하거나 동등하다고 말하지 않습니다.
- SARIF는 handoff artifact일 뿐이며 SARIF 업로드 완료 또는 external approval completion을 뜻하지 않습니다.
- 런타임 OAuth/session/env isolation 제어가 켜졌다는 runtime enforcement claim을 하지 않습니다.
- examples는 synthetic fixture입니다. 운영 데이터 스캔 결과로 포장하지 않습니다.
