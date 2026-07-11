# AX AI judge evidence manifest

한국어 우선 증거 manifest입니다. 목적은 AX 인재전쟁의 예비 심사 또는 AI preliminary judge가 AgentGuard의 현재 repo 증거를 한 장에서 읽고, 회사 문제 → agent risk surface → exact command → fixture → expected evidence → 사람 조치 순서로 확인하게 하는 것입니다.

이 문서는 source-of-record 색인입니다. 모든 항목은 synthetic fixture에 묶여 있으며, 실제 고객 자료나 운영 credential을 요구하지 않습니다. 설명 문장은 한국어 우선이지만 CLI, rule IDs, JSON, SARIF, API, machine fields는 English-compatible 계약으로 둡니다.

## 사용 목적

- 대상: 제출 자료를 빠르게 훑는 예비 심사자, AI preliminary judge, 또는 사람 reviewer.
- 쓰임: MCP config, PR diff, transcript/log, SARIF reviewer handoff를 현재 repo에서 재실행 가능한 증거로 묶습니다.
- 경계: 공개 reference에서 빌린 것은 문제 framing과 handoff vocabulary입니다. gated portal 세부 기준이나 숨겨진 점수 산식은 이 문서의 근거가 아닙니다.
- 결과: judge는 아래 manifest row를 따라 `BLOCK` / `REVIEW` / `PASS` 언어를 현재 AgentGuard command와 fixture 증거에 연결합니다.

## AI/prelim judge manifest

| Judge row | Surface | Exact command | Fixture | Expected evidence | Judge action |
|---|---|---|---|---|---|
| MCP permission preflight | MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | Expected verdict: `BLOCK` or `REVIEW`; broad filesystem or writable path findings such as `mcp.broad_filesystem_access` and `mcp.filesystem_writable_path`. | 권한 root 축소, writable path 제거, credential passthrough 제거 전에는 rollout을 멈추거나 사람 검토 queue로 보냅니다. |
| PR diff risk preflight | PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` | Expected verdict: `REVIEW` or `BLOCK`; risky diff evidence such as `generic-secret-assignment`. | PR reviewer가 secret-like material, risky shell material, PII evidence를 확인하고 수정 또는 정책 예외 기록을 요구합니다. |
| Transcript policy preflight | transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml` + `examples/agent-transcript.log` | Expected verdict: `REVIEW`; policy-driven command evidence. | 운영자가 denied command, owner, residual risk를 승인 기록에 남기고 재실행 조건을 정합니다. |
| SARIF reviewer handoff | SARIF | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-ai-judge-evidence/agentguard.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff` | Expected artifact: `.agentguard-demo/ax-ai-judge-evidence/agentguard.sarif`; compare with static sample `examples/agentguard.sarif`. | GitHub code scanning에 올릴 수 있는 SARIF-shaped artifact로 reviewer handoff를 준비하되, 자동 업로드나 자동 승인 흐름은 말하지 않습니다. |

## Fixture-backed evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo/ax-ai-judge-evidence`를 실행해 `dist/index.js`와 출력 디렉터리를 준비합니다.

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-ai-judge-evidence/agentguard.sarif < examples/risky-pr.diff
```

npm/global 설치 환경에서 같은 surface를 말할 때의 public CLI contract는 `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`입니다. 이 문서는 command spelling, rule IDs, verdict policy, default severity, JSON field, SARIF field, API machine fields를 바꾸지 않습니다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| AX 인재전쟁 — https://hackathon.jocodingax.ai/ | "기업의 실제 문제", 성과를 증명하고 설득하는 framing. | gated portal 세부 정보, 숨겨진 심사 기준, 최종 점수 예측 표현. | 회사 문제를 synthetic fixture evidence와 사람 승인 조건에 연결합니다. |
| OWASP Agentic AI threats — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, mitigation/control vocabulary. | OWASP assurance, 외부 보증, threat coverage 범위 확대 표현. | MCP/PR/transcript findings를 rollout control, residual risk, reviewer action으로 번역합니다. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, consent, token/tool authorization boundary language. | runtime OAuth, consent UI, session control, MCP server execution을 제공한다고 말하는 표현. | 정적 MCP config preflight evidence로 broad filesystem, writable path, token passthrough 위험을 먼저 분리합니다. |
| GitHub SARIF upload — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF artifact, reviewer handoff, configured workflow vocabulary. | 자동 SARIF upload, 자동 code scanning approval, GitHub product 기능 수행 표현. | `--sarif --out` command로 handoff artifact path를 남기고 사람이 업로드/검토 여부를 결정하게 합니다. |

## Machine-contract boundaries

- no scanner behavior change: 이 문서는 scanner behavior를 바꾸지 않습니다.
- no verdict policy change: `PASS`, `REVIEW`, `BLOCK` 판단 정책을 문서에서 새로 정의하지 않습니다.
- no default severity change: severity/default mapping은 기존 구현을 그대로 따릅니다.
- CLI contract: `agentguard scan-mcp`, `agentguard scan-diff`, `agentguard scan-log`, `node dist/index.js` spelling을 유지합니다.
- rule IDs: `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment` 같은 English-compatible rule IDs를 유지합니다.
- JSON, SARIF, API, machine fields: 사람 설명만 한국어 우선이며 machine fields 이름은 바꾸지 않습니다.
- Fixture boundary: `examples/risky-mcp.json`, `examples/risky-pr.diff`, `examples/agent-policy.yaml`, `examples/agent-transcript.log`, `examples/agentguard.sarif`만 이 manifest의 source-of-record입니다.

## Non-claim guardrails

- 실제 조직, 실사용자, 운영 배포, reference customer를 말하지 않습니다.
- 외부 보안 기준 충족, 외부 기관 보증, 공개 reference의 승인 상태를 말하지 않습니다.
- OWASP, MCP, GitHub, SARIF reference는 설명 언어와 artifact handoff vocabulary의 근거일 뿐입니다.
- AgentGuard가 runtime OAuth, runtime authorization, session control, consent UI, MCP server execution을 수행한다고 말하지 않습니다.
- SARIF command는 artifact를 생성하는 handoff입니다. GitHub 업로드, code scanning 운영, 사람 승인 결정을 자동화한다고 말하지 않습니다.
- 이 문서는 dashboard, SaaS, auth, customer data, package publishing, product rename을 추가하지 않습니다.
