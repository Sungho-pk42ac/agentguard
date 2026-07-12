# AX control-plane CI gate card

## purpose

한국어 우선 카드입니다. 본선에서 회사 문제가 바뀌어도 AgentGuard의 현재 CLI evidence, GitHub CI status, SARIF/report artifact, control-plane report 경계를 묶어 “이 agent rollout을 지금 배포해도 되는가?”를 빠르게 판단하게 합니다.

핵심 원칙: AgentGuard evidence는 source-of-record와 rerunnable command를 제공하지만, production runtime OAuth, session, consent, firewall, feature flag, rollback 실행은 회사 control-plane/platform owner가 별도로 수행합니다.

## control-plane CI gate map

| Company problem signal | AgentGuard surface | Control-plane / CI gate | Exact evidence command / artifact | Approver decision | Rerun / freshness trigger |
|---|---|---|---|---|---|
| PR에 agent가 새 도구·secret-like 값을 추가했다 | PR diff | GitHub CI에서 `scan-diff` report/SARIF를 보존하고 `BLOCK`이면 merge 중지 | `node dist/index.js scan-diff < examples/risky-pr.diff` | Security reviewer가 `BLOCK` finding의 fix/policy 조건을 승인할 때까지 배포 보류 | PR head SHA, policy, fixture/report hash가 바뀌면 재실행 |
| MCP 서버가 넓은 filesystem root 또는 credential env를 요구한다 | MCP config | CI 또는 control-plane intake 전 static preflight로 least privilege 확인 | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Platform owner가 root/env 범위를 줄이거나 exception owner를 지정 | MCP config, server package, auth scope가 바뀌면 재실행 |
| agent transcript가 위험 명령 또는 승인 필요 작업을 포함한다 | transcript/log | 운영자가 `scan-log` Markdown/JSON 결과를 incident/change ticket에 첨부 | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Business owner가 `REVIEW`/`BLOCK`을 fix condition 또는 residual risk로 처리 | prompt, tool policy, transcript source가 바뀌면 재실행 |
| Reviewer가 CI 결과를 GitHub code scanning 또는 artifact로 확인해야 한다 | SARIF/report | SARIF result와 Markdown report를 reviewer handoff artifact로 보존 | `node dist/index.js scan-diff --sarif --out .agentguard-demo/control-plane-ci-gate.sarif < examples/risky-pr.diff` | Reviewer는 `ruleId`, `artifactLocation`, `region.startLine`로 source를 확인 | SARIF schema, CLI version, report path가 바뀌면 재실행 |
| Demo 직전 증거 묶음이 오래됐다 | smoke/evidence freshness | smoke manifest로 PR/MCP/transcript/SARIF 경로가 모두 재현되는지 확인 | `npm run smoke:ax-demo` → `.agentguard-demo/ax-evidence-smoke/manifest.json` | Operator가 manifest와 최신 CI run을 같이 제시 | demo fixture, packageVersion, CLI hash가 바뀌면 재실행 |

## exact evidence commands

Fresh clone 기준으로 먼저 `npm ci && npm run build`를 실행한 뒤 아래 명령을 사용합니다. 위험 fixture는 의도적으로 `BLOCK`/non-zero exit가 날 수 있으므로, 통과 여부는 exit 0 하나가 아니라 verdict/report/SARIF shape로 확인합니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/control-plane-ci-gate.sarif < examples/risky-pr.diff
npm run smoke:ax-demo
```

Source artifacts:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`
- `scripts/ax-demo-smoke.mjs`
- `.agentguard-demo/control-plane-ci-gate.sarif`
- `.agentguard-demo/ax-evidence-smoke/manifest.json`

## public reference rows

| Public reference | Borrow | Avoid | AgentGuard control-plane CI use |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic risk, tool misuse, excessive agency, mitigation/control language | endorsement, certification, broad platform replacement wording | Convert raw findings into `risk → control → approver decision → rerun trigger` rows. |
| MCP Authorization draft — https://modelcontextprotocol.io/specification/draft/basic/authorization | authorization, token/session boundary, client registration, least privilege vocabulary | runtime OAuth/session/redirect/consent validation claims | Explain why MCP config evidence is a pre-rollout static gate, not runtime authorization enforcement. |
| GitHub SARIF support — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF `result`, `ruleId`, `artifactLocation`, `region.startLine`, reviewer artifact language | automatic upload or external approval claims | Route AgentGuard SARIF/report output into reviewer-readable CI evidence without changing machine contracts. |

## machine-contract boundaries

Preserve these English-compatible machine contracts exactly: `PASS`, `REVIEW`, `BLOCK`, `scan-diff`, `scan-mcp`, `scan-log`, `JSON`, `SARIF`, `ruleId`, `artifactLocation`, `region.startLine`, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.

Korean copy may explain business approval, residual risk, and rerun responsibility, but CLI flags, rule IDs, JSON fields, SARIF fields, and verdict values remain English-compatible.

## claim guardrails

- 합성 fixture와 public reference를 근거로 한 rollout rehearsal card입니다. 실제 고객 도입, 보안 인증, 외부기관 검증을 주장하지 않습니다.
- AgentGuard는 현재 증거 생성과 static/source-of-record review를 돕습니다. runtime OAuth, authorization, session, consent, token enforcement는 별도 platform/control-plane 책임입니다.
- SARIF/report command는 artifact를 생성하지만, GitHub 업로드·reviewer 승인·production 배포는 별도 workflow와 사람 승인 절차가 필요합니다.
- Snyk, GitHub, OWASP, MCP 문서는 참고 신호이며 AgentGuard가 이 도구들을 대체하거나 동등하다고 주장하지 않습니다.
