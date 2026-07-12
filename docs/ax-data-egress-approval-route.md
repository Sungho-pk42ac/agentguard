# AX data egress approval route

## 사용 목적

이 카드는 본선에서 회사 문제가 아직 확정되지 않았을 때도 “AI agent가 고객/업무 데이터를 읽고 외부로 내보내려는 흐름을 어떻게 승인·차단할 것인가?”를 30초 안에 설명하기 위한 한국어 우선 handoff입니다. AgentGuard는 synthetic fixture를 대상으로 `PR diff → MCP config → transcript/log → SARIF/Markdown artifact`를 재실행 가능한 증거로 묶고, 실무 승인자는 `PASS` / `REVIEW` / `BLOCK` verdict를 기준으로 배포 조건을 정합니다.

## 30초 data egress approval flow

1. 회사 문제를 데이터 반출 표면으로 바꿉니다: “agent가 VOC/예약/감사 데이터에 접근하고 export, upload, curl, write 작업을 요청한다.”
2. PR diff, MCP config, transcript/log를 같은 정책 관점으로 스캔합니다.
3. `BLOCK`이면 배포 중지, `REVIEW`이면 승인 조건·마스킹·read-only 범위를 기록, `PASS`이면 동일 명령으로 재검증 후 진행합니다.
4. Markdown report와 SARIF artifact를 reviewer/source-of-record로 남깁니다.

## Company problem → egress surface → evidence command → approval decision

| Company problem | Egress surface | Exact evidence command | Expected verdict | Approval decision |
|---|---|---|---|---|
| 고객 VOC agent가 PR에서 token/PII-like 값을 추가 | PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` | secret/PII-like evidence를 제거하고 redaction이 유지된 report로 재실행 전까지 배포 중지 |
| MCP filesystem server가 넓은 root/read-write 권한으로 VOC export 파일을 열 수 있음 | MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK` 또는 `REVIEW` | root 범위·write 권한·env passthrough를 줄이고 승인자가 read-only 경계 확인 |
| agent transcript/log에 export, shell, approval-required operation이 남음 | transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` 또는 `BLOCK` | 운영자가 명령 목적, masking 여부, 재실행 필요성을 판단하고 policy 조건을 기록 |
| reviewer가 GitHub/code-scanning handoff artifact를 요구 | SARIF | `node dist/index.js scan-diff --sarif --out .agentguard-demo/data-egress/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF artifact with findings | `.agentguard-demo/data-egress/agentguard.sarif`를 업로드/공유 가능한 evidence로 보존하되 자동 승인으로 간주하지 않음 |

## Public reference borrow / avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent tool misuse, excessive permission, data exposure threat framing | OWASP 외부 보증처럼 말하지 않기 | egress/export risk를 PR/MCP/transcript 증거와 human approval 조건으로 연결 |
| https://modelcontextprotocol.io/specification/draft/basic/authorization | authorization, trusted redirect, session boundary language | runtime OAuth, authorization, session enforcement 구현 주장 금지 | static pre-rollout evidence에서 MCP 권한과 transcript 행동을 검토 대상으로 표시 |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF를 reviewer handoff artifact로 사용하는 패턴 | automatic SARIF upload 또는 외부 승인 완료 주장 금지 | `--sarif --out` 명령으로 재생성 가능한 artifact path를 문서화 |
| https://github.com/snyk/agent-scan | AI agent/MCP/security scanner라는 public product category | Snyk/agent-scan replacement, parity, 외부 보증 claim 금지 | 한국어 business approval route와 `scan-diff`/`scan-mcp`/`scan-log` 결합을 차별점으로 설명 |

## Static pre-rollout boundary

AgentGuard의 이 카드는 static pre-rollout 증거 카드입니다. `scan-diff`, `scan-mcp`, `scan-log`는 PR diff, MCP config, transcript/log, workspace files 같은 입력을 읽어 finding과 artifact를 만들지만, runtime authorization을 구현하지 않습니다. MCP server를 대신 실행하거나 OAuth callback, session binding, trusted redirect URI를 강제하지 않습니다. 실제 회사 데이터가 아니라 repository의 synthetic fixture로 evidence flow를 재현합니다.

## English-compatible machine contracts

사람이 읽는 설명은 한국어 우선이지만 machine-facing contract는 바꾸지 않습니다.

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`
- Verdicts and fields: `BLOCK`, `REVIEW`, `PASS`, JSON, SARIF, API, rule IDs, `ruleId`, `result`, `location`, `artifact`
- Example rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`, `denied-command`, `approval-required`

## Non-claim guardrails

- 운영 조직의 실제 채택 사례, 준수 보증, Snyk/GitHub/Tencent/OWASP 외부 보증을 주장하지 않습니다.
- `Snyk agent-scan`, GitHub code scanning, Tencent AI-Infra-Guard를 대체하거나 동등하다고 말하지 않습니다.
- SARIF artifact 생성은 reviewer handoff evidence이며 automatic SARIF upload, automatic approval, runtime blocking을 뜻하지 않습니다.
- 이 문서는 real customer data를 스캔했다는 증거가 아니라 synthetic fixture로 재실행 가능한 demo/approval route를 보여줍니다.
