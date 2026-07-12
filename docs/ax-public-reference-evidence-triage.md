# AX public-reference evidence triage card

한국어 우선 카드입니다. AX Rollout Guard가 공개 reference를 그대로 베끼는 것이 아니라, 심사위원 질문을 **현재 AgentGuard가 재현 가능한 evidence command**로 바꾸는 방법을 정리합니다. CLI commands, verdicts, rule IDs, JSON/SARIF fields는 English-compatible machine contract로 유지합니다.

## purpose

본선 회사 문제가 공개되기 전에도 운영자는 공개 agent-security / MCP / SARIF reference를 세 가지 질문으로 압축할 수 있어야 합니다.

1. 이 agent가 무엇을 읽고 실행하고 외부로 내보낼 수 있는가?
2. 그 위험을 PR diff, MCP config, transcript/log, SARIF artifact 중 어느 증거로 재현할 수 있는가?
3. `PASS` / `REVIEW` / `BLOCK` 중 어떤 승인 결정을 내리고, 어떤 조건으로 다시 실행할 것인가?

## public reference triage map

| Public reference signal | Borrow | Avoid | AgentGuard evidence triage |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent/tool misuse, excessive agency, sensitive data exposure를 심사위원 질문으로 바꾼다. | OWASP가 AgentGuard를 검증했다거나 동일한 coverage를 제공한다는 표현. | PR diff와 transcript/log에서 secret, denied command, approval-required operation을 찾아 `BLOCK` 또는 `REVIEW` evidence로 제시한다. |
| MCP Authorization specification — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | authorization, state/session boundary, least-privilege 질문을 MCP config preflight로 연결한다. | AgentGuard가 runtime OAuth, session, consent, token enforcement를 수행한다는 표현. | MCP config의 broad filesystem root, writable path, credential passthrough를 검사하고 human approval 조건을 남긴다. |
| GitHub SARIF upload/code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF를 reviewer가 추적할 수 있는 artifact handoff로 설명한다. | SARIF가 자동 업로드되거나 외부 승인을 자동 처리한다는 표현. | `ruleId`, `artifactLocation`, `region.startLine` 기반의 SARIF artifact를 evidence bundle에 포함한다. |

## exact evidence commands

아래 명령은 fresh clone에서 `npm ci && npm run build` 후 실행하는 operator-facing 증거입니다. 위험 입력은 synthetic fixture이며 실제 고객 데이터나 실제 credential을 포함하지 않습니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-evidence-triage.sarif < examples/risky-pr.diff
```

Fixture paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`
- `.agentguard-demo/public-reference-evidence-triage.sarif` is a generated local artifact path, not a checked-in fixture.

## reviewer question script

| Judge/reviewer question | Evidence command | Expected decision language |
|---|---|---|
| PR diff에 새 secret 또는 위험 shell behavior가 추가됐는가? | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK`이면 배포 전 제거/수정; `REVIEW`이면 담당자가 residual risk를 승인한다. |
| MCP server가 너무 넓은 filesystem 권한이나 credential passthrough를 갖는가? | `node dist/index.js scan-mcp < examples/risky-mcp.json` | broad root/writable/token passthrough는 rollout 전에 권한 축소 또는 예외 승인 필요. |
| Agent transcript가 정책상 승인 필요한 command를 시도했는가? | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | 사람이 실행 의도와 business owner approval을 확인하기 전까지 자동 진행하지 않는다. |
| 결과를 reviewer artifact로 남길 수 있는가? | `node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-evidence-triage.sarif < examples/risky-pr.diff` | SARIF `ruleId` / `artifactLocation` / `region.startLine`로 source-of-record를 남긴다. |

## machine-contract boundaries

- Verdict words stay English: `PASS`, `REVIEW`, `BLOCK`.
- CLI surfaces stay English: `scan-diff`, `scan-mcp`, `scan-log`.
- Machine outputs stay parseable: `JSON`, `SARIF`, `ruleId`, `artifactLocation`, `region.startLine`.
- Korean copy explains operator intent only; it does not rename commands, rule IDs, SARIF fields, or JSON fields.

## claim guardrails

- No real customer adoption, customer logo, or customer reference is implied by this card.
- No SOC 2, ISO 27001, certification, official endorsement, or third-party approval is implied.
- No parity or replacement claim is made against OWASP, MCP Authorization, GitHub SARIF, Snyk, or any security platform.
- No runtime OAuth/session/consent/token enforcement is claimed; this is static evidence plus human approval workflow language.
- No automatic SARIF upload is claimed; the documented SARIF path is a local artifact handoff.
