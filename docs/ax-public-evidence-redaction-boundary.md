# AX public evidence redaction boundary

AX Rollout Guard의 공개/기업 제출 증거는 **source-of-record를 남기되 민감정보를 다시 유출하지 않는 것**이 목표입니다. 이 카드는 PR diff, MCP config, agent transcript/log, SARIF/Markdown report를 심사위원·보안 승인자에게 넘길 때 무엇을 공유하고 무엇을 가려야 하는지 정합니다.

## 대상권 포지셔닝

- 회사 문제를 받으면 먼저 `어떤 agent/tool workflow가 어떤 데이터를 읽고/실행하고/내보내는가`를 적습니다.
- AgentGuard는 static evidence를 재현 가능한 명령으로 검사해 `PASS` / `REVIEW` / `BLOCK` verdict와 redacted evidence를 제공합니다.
- 공개 제출물에는 synthetic fixture와 redacted output만 넣고, 실제 고객 자료·실제 secrets·개인정보 원문은 넣지 않습니다.
- 이 문서는 OAuth/session/redirect URI 실행 시점 통제, SARIF 업로드 자동 승인, 운영 채택 사례, 공식 인증을 주장하지 않습니다.

## Evidence redaction / release table

| Evidence surface | Exact command / artifact | Release rule | Approver action | Boundary |
|---|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | diff 원문은 synthetic fixture만 공유하고, secret-like evidence는 AgentGuard redaction 결과로만 보여줍니다. | `BLOCK`이면 PR merge 보류, 토큰 회수/fixture 교체 후 재스캔합니다. | AgentGuard는 PR diff를 정적으로 검사합니다. 실제 GitHub 권한 회수나 secret rotation은 별도 운영 절차입니다. |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | broad root, writable path, env passthrough 신호는 공유하되 실제 local path/user/token 값은 demo fixture 또는 redacted 값만 사용합니다. | `BLOCK`/`REVIEW`에 대해 MCP server root 축소, writable path 제거, env allowlist 적용 여부를 승인합니다. | MCP Authorization `state`, redirect URI, token/session 검증은 runtime auth 영역입니다. 이 카드는 static config evidence boundary만 다룹니다. |
| Transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | agent command, denied operation, approval-required action은 남기되 사용자명·내부 host·고객 텍스트·raw credential은 redacted report로만 전달합니다. | 위험 command는 human approval required로 분류하고 policy/fix 조건을 적은 뒤 재실행 증거를 요구합니다. | transcript/log는 사후 증거입니다. AgentGuard가 모든 runtime tool call을 실시간 차단한다고 주장하지 않습니다. |
| SARIF handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-evidence-redaction-boundary/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/` 같은 임시/ignored 경로에 SARIF를 생성하고, 공개 handoff 전 `artifactLocation.uri`, `ruleId`, redacted `message.text`를 확인합니다. | reviewer는 SARIF/Markdown/JSON artifact가 같은 source fixture에서 재생성되는지 확인하고 승인/재실행/차단을 결정합니다. | GitHub code scanning/SARIF upload는 reviewer channel입니다. SARIF 업로드가 외부 승인이나 자동 triage 완료를 의미하지 않습니다. |

## Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent가 민감 데이터와 도구 권한을 다룰 때 mitigation과 evidence가 필요하다는 언어 | 전체 agent 보안 플랫폼, 고객 도입, 공식 검증처럼 들리는 표현 | PR/MCP/transcript/SARIF 증거마다 redaction rule과 human approval action을 붙입니다. |
| Model Context Protocol Authorization — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | `state`, redirect URI, token/session boundary처럼 승인자가 확인해야 하는 auth 개념 | runtime OAuth/state/redirect/session enforcement를 구현했다고 말하기 | MCP config evidence는 static preflight로 한정하고 runtime auth는 별도 owner가 확인해야 한다고 적습니다. |
| GitHub SARIF upload — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF를 code scanning/reviewer handoff artifact로 쓰는 흐름 | SARIF upload가 외부 승인, 자동 조치, 완전한 보안 triage라고 말하기 | SARIF 생성 명령과 artifact review action을 분리해 source-of-record와 approval을 구분합니다. |

## Fixture-backed evidence commands

Fresh clone 기준:

```bash
npm ci
npm run build
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-evidence-redaction-boundary/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Risky fixture commands may exit non-zero when verdict is `BLOCK`; that is acceptable for demo proof after confirming the report/SARIF artifact shape. Machine-facing terms stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `PASS`, `REVIEW`, `BLOCK`, `JSON`, `SARIF`, `ruleId`, `artifactLocation.uri`, `tool.driver.name`, `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`.

## Public handoff checklist

1. Source fixture path exists and is synthetic.
2. Report/SARIF was generated from the same command shown in the doc.
3. Raw secrets, customer text, private hostnames, usernames, tokens, cookies, and OAuth artifacts are absent or redacted.
4. Reviewer can rerun the command locally from a fresh clone.
5. `PASS` / `REVIEW` / `BLOCK` meaning is preserved and not translated into a new machine contract.
6. Approval sentence says who decides next action; it does not say AgentGuard automatically approves, uploads, remediates, or enforces runtime authorization.

## Non-claim guardrails

- No real customer adoption claim.
- No certification or official endorsement claim.
- No parity claim against OWASP, MCP, GitHub code scanning, Snyk, or other scanners.
- No runtime authorization/session/OAuth enforcement claim.
- No automatic SARIF upload, automatic external approval, automatic remediation, or complete security platform claim.
