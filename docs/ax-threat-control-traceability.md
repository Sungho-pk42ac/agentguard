# AX threat-control traceability card

이 문서는 AX Rollout Guard를 심사자와 enterprise reviewer에게 설명할 때 public threat language를 현재 AgentGuard evidence로 추적하는 한국어 우선 카드입니다. 목표는 **threat → control → evidence** 흐름을 한 장으로 보여 주는 것이며, scanner behavior, CLI commands, rule IDs, JSON, SARIF, API, machine fields는 바꾸지 않습니다.

## 왜 이 카드가 필요한가

대상권 심사에서는 "AI agent가 위험하다"는 일반론보다, 공개 reference가 말하는 위험을 어떤 운영 통제로 낮추고 어떤 fixture-backed command로 증명하는지가 중요합니다. 이 카드는 AgentGuard가 agent self-report나 포괄적 보안 플랫폼이 아니라, PR diff / MCP config / transcript/log / SARIF evidence를 통해 배포 전 승인 질문을 만드는 도구임을 보여 줍니다.

## Borrow / Avoid / AgentGuard action

| Public signal | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | agent/tool misuse, excessive agency, mitigation/control vocabulary | OWASP endorsement, 전체 coverage, 외부 보증, 공식 보증 표현 | PR diff와 transcript/log evidence를 `BLOCK`/`REVIEW` finding, 수정 조건, approver action으로 낮춘다. |
| [MCP Authorization draft](https://modelcontextprotocol.io/specification/draft/basic/authorization) | authorization boundary, issuer/state/PKCE 같은 신뢰 경계 언어 | runtime OAuth validation, MCP conformance, consent UI 구현 claim | `scan-mcp` 정적 config evidence로 broad root, writable path, credential passthrough를 rollout 전 승인 질문으로 만든다. |
| [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) | least privilege, consent, token handling, confused deputy framing | MCP 서버 실행 통제, 실시간 MCP enforcement, 세션 정책 엔진 claim | MCP config와 transcript/log evidence에 permission owner, residual risk, rerun trigger를 붙인다. |
| [GitHub SARIF upload](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF file, code scanning, reviewer-visible artifact handoff vocabulary | automatic upload, triage 완료, GitHub-native approval, security-events workflow ownership claim | `scan-diff --sarif --out` 산출물을 reviewer-owned handoff artifact로 생성하고 upload/approval은 별도 owner 조건으로 둔다. |

## Threat → control → evidence matrix

| Company rollout question | Public threat/control language | AgentGuard surface | Exact evidence command | Approval condition |
|---|---|---|---|---|
| PR diff가 secret, PII, risky shell material을 새로 넣어도 merge 가능한가? | OWASP agent/tool misuse + sensitive data exposure를 control evidence로 낮춘다. | PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `secret.github_token` 같은 rule IDs가 `BLOCK`이면 merge 전 secret 제거와 rerun evidence가 필요하다. |
| MCP config가 agent에게 과도한 filesystem/root/write 권한을 주는가? | MCP least privilege + authorization boundary 질문으로 바꾼다. | MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `mcp.broad_filesystem_access` 또는 `mcp.filesystem_writable_path` finding은 root/path 축소, read-only 전환, credential passthrough 제거 조건으로 처리한다. |
| Agent transcript/log가 승인 없는 shell behavior를 남겼는가? | tool misuse/excessive agency를 실제 operator action evidence로 묶는다. | transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | approval-required operation은 workflow owner가 승인 근거를 남기거나 policy/fix 후 rerun한다. |
| Security reviewer에게 같은 PR finding을 machine-readable artifact로 넘길 수 있는가? | GitHub SARIF rule/result/location handoff vocabulary를 빌린다. | SARIF | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-threat-control-traceability.sarif < examples/risky-pr.diff` | SARIF artifact path와 source diff를 기록하고, upload/triage/approval은 CI owner 또는 security reviewer가 별도로 결정한다. |

## Fixture-backed evidence commands

아래 commands는 fresh clone에서 `npm ci && npm run build` 후 실행하는 POSIX shell 기준입니다. PowerShell에서는 stdin redirection(`<`) 대신 `Get-Content -Raw -Encoding utf8 <fixture> | node dist/index.js <subcommand>` 형태를 사용합니다. `.agentguard-demo/`는 ignored local handoff artifact 경로이며 repo에 커밋하지 않습니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-threat-control-traceability.sarif < examples/risky-pr.diff
```

Fixture paths used by this card:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`

## Machine-contract boundary

- Human Markdown and judge-facing explanation can be Korean-first.
- CLI names remain English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- Verdict values remain `PASS`, `REVIEW`, `BLOCK`.
- Scanner `rule IDs` remain stable, including `secret.github_token`, `mcp.broad_filesystem_access`, and `mcp.filesystem_writable_path`.
- JSON and SARIF machine fields remain unchanged, including SARIF `ruleId` and `artifactLocation.uri`.

## Non-claim guardrails

- AgentGuard does not claim OWASP, MCP, or GitHub endorsement.
- AgentGuard does not claim full AI security platform coverage.
- AgentGuard does not claim runtime MCP enforcement, runtime OAuth validation, or consent UI control.
- AgentGuard does not claim real customer adoption, certification, or competitor parity.
- SARIF/report artifacts are reviewer handoff evidence; upload, triage, and approval remain workflow-owner responsibilities.
