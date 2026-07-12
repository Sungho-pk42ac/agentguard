# AX evidence command failure triage card

한국어 우선 **evidence command failure triage** 카드는 AX Rollout Guard 데모 중 `agentguard` 명령이 non-zero로 끝났을 때, 발표자와 reviewer가 이것을 **정상적인 위험 판정 evidence**인지 **실제 실행 실패**인지 30초 안에 분리하도록 돕는다. 범위는 docs-contract slice다. Scanner behavior, exit-code semantics, CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine fields는 바꾸지 않는다.

## 사용 목적

AX 인재전쟁 본선에서는 회사 문제가 현장에서 주어질 수 있고, 발표 시간에는 command가 한 번이라도 흔들리면 신뢰가 무너진다. 이 카드는 `PASS` / `REVIEW` / `BLOCK` evidence를 source-of-record command와 artifact로 다시 확인하면서도, 위험 fixture가 의도적으로 non-zero를 내는 경우를 숨기지 않는다.

> 핵심 문장: "non-zero 자체가 실패라는 뜻은 아닙니다. 먼저 verdict, rule IDs, redacted evidence, artifact path, fixture freshness를 확인하고, 그 다음 approval owner가 재실행·수정·보류를 결정합니다."

## Failure triage matrix

| Signal during demo | Likely class | Exact evidence command | What to inspect | Approval action |
|---|---|---|---|---|
| 위험 PR diff scan이 non-zero로 끝나지만 `BLOCK` 또는 `REVIEW` finding이 출력된다. | expected risky nonzero | `node dist/index.js scan-diff < examples/risky-pr.diff` | `PASS` / `REVIEW` / `BLOCK` verdict, `rule IDs`, redacted evidence, source fixture path. | security reviewer가 finding을 수정 또는 정책 예외 후보로 분류하고 같은 command로 rerun한다. |
| MCP config scan이 broad filesystem / writable path / credential passthrough를 잡고 non-zero로 끝난다. | expected risky nonzero | `node dist/index.js scan-mcp < examples/risky-mcp.json` | MCP permission finding, static config source, least-privilege remediation note. | permission owner가 MCP root/write/token passthrough를 줄이거나 제한 rollout 조건을 기록한다. |
| transcript/log scan이 approval-required action을 `REVIEW`로 남긴다. | human approval required | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | transcript/log source, policy file, approval-required operation, residual risk owner. | business owner가 approve / limit / defer 중 하나를 기록한다. |
| SARIF handoff command가 non-zero지만 `.sarif` file이 생성된다. | artifact exists, rollout still blocked | `node dist/index.js scan-diff --sarif --out .agentguard-demo/evidence-command-failure-triage.sarif < examples/risky-pr.diff` | `.agentguard-demo/evidence-command-failure-triage.sarif`, `ruleId`, `level`, `locations`, `tool.driver.name`. | CI/reviewer channel에 artifact를 넘기되 automatic SARIF upload 또는 approval 완료로 말하지 않는다. |
| `dist/index.js`가 없거나 command가 module-not-found로 실패한다. | build/setup failure | `npm ci && npm run build` | build log, Node version, package install status. | demo를 멈추고 fresh clone setup부터 복구한다. finding evidence로 카운트하지 않는다. |
| fixture path가 없거나 다른 scenario의 artifact가 섞여 있다. | stale/mixed artifact | `npm run smoke:ax-demo` | `scripts/ax-demo-smoke.mjs`, manifest path, source fixture hash, generated JSON/SARIF artifact directory, same-run evidence directory. | evidence owner가 artifact를 폐기하고 같은 fixture-backed command를 다시 실행한다. |
| reviewer가 응답하지 않거나 stdin diff를 보지 못했다. | reviewer non-response | `node dist/index.js scan-diff < examples/risky-pr.diff` | command receipt, unresolved reviewer question, separately attached reviewer memo, fallback reviewer note. | reviewer timeout을 기록하고 Antigravity/Gemini 또는 human reviewer fallback으로 보낸다. |

## Exact fixture-backed commands

Fresh clone에서는 repository root에서 먼저 `npm ci && npm run build`를 실행한 뒤 아래 명령을 사용한다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/evidence-command-failure-triage.sarif < examples/risky-pr.diff
npm run smoke:ax-demo
```

PowerShell에서 `< file` redirection이 불편하면 `Get-Content examples/risky-pr.diff | node dist/index.js scan-diff`처럼 pipe 형태로 바꾼다. 이 문서는 command spelling과 fixture path를 설명할 뿐, scanner behavior나 exit-code semantics를 바꾸지 않는다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent/tool misuse, excessive permission, credential exposure를 evidence rerun과 approval owner 언어로 분리한다. | OWASP mitigation suite 전체를 구현했거나 외부 검증을 받았다고 말하지 않는다. | risky nonzero를 숨기지 않고 `BLOCK`/`REVIEW` source-of-record command로 설명한다. |
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | MCP authorization, permission boundary, confused-deputy style risk를 static config triage 언어로 빌린다. | runtime OAuth, session validation, redirect URI validation을 AgentGuard가 수행한다고 주장하지 않는다. | `scan-mcp` evidence를 permission owner와 least-privilege rerun condition에 연결한다. |
| GitHub SARIF support for code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF result, rule, location, tool metadata를 reviewer handoff artifact 언어로 빌린다. | automatic SARIF upload, GitHub code scanning replacement, or platform parity claim을 하지 않는다. | SARIF file creation과 rollout approval을 분리하고 artifact path를 rerun 대상으로 둔다. |
| Snyk agent-scan — https://github.com/snyk/agent-scan | public AI-agent/MCP security scanner category framing을 참고한다. | market adoption, certification, feature parity claim을 하지 않는다. | AgentGuard의 차별점은 한국어 enterprise approval triage와 PR/MCP/transcript/SARIF fixture-backed evidence로 좁힌다. |
| Tencent AI-Infra-Guard — https://github.com/Tencent/AI-Infra-Guard | AI infrastructure risk를 operational queue와 owner language로 풀어내는 기대치를 참고한다. | full-stack red-team platform 또는 production platform parity를 주장하지 않는다. | demo failure를 운영 triage queue로 변환하는 문서 evidence만 추가한다. |
| splx agentic-radar — https://github.com/splx-ai/agentic-radar | agentic workflow scanner라는 category naming을 참고한다. | external endorsement or replacement claim을 하지 않는다. | AgentGuard command failure를 source fixture, verdict, reviewer artifact, approval owner로 라우팅한다. |

## Machine-contract boundaries

- CLI commands remain English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `agentguard doctor`.
- Verdict values remain machine-facing: `PASS`, `REVIEW`, `BLOCK`.
- `rule IDs`, `JSON`, `SARIF`, `API`, `machine fields`, `ruleId`, `artifactLocation.uri`, and `tool.driver.name` are not translated or renamed.
- This card has no scanner behavior change, no exit-code semantics change, no default verdict/severity change, no package publishing change, no hosted auth/dashboard behavior change.

## Non-claim guardrails

- no automatic SARIF upload: this card can generate a SARIF file, but upload and code-scanning triage remain workflow-owned steps.
- no runtime authorization claim: static MCP/transcript evidence does not prove OAuth, session, consent, redirect URI, or runtime sandbox enforcement.
- no real customer/adoption claim: examples are synthetic fixtures only.
- no external certification: OWASP, MCP, GitHub, Snyk, Tencent, and splx-ai references are borrow/avoid/action inputs, not endorsements.
- no platform parity claim: AgentGuard is not presented as a replacement for GitHub code scanning, Snyk, Tencent AI-Infra-Guard, splx agentic-radar, or a full AI red-team platform.
- no secret exposure: reports should keep credential evidence redacted and fixture-only.
