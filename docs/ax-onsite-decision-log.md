# AX onsite decision log

한국어 우선 decision log card입니다. AX 본선 6시간 현장에서 unknown company problem을 받았을 때 **company problem -> decision -> evidence command -> verdict -> approver/action -> rerun trigger**를 한 줄 receipt로 남기기 위한 문서입니다. 이 카드는 현재 저장소의 synthetic fixture만 사용하며 scanner behavior, runtime enforcement, CLI commands, rule IDs, JSON, SARIF, API, `PASS`/`REVIEW`/`BLOCK` verdict contract를 바꾸지 않습니다.

## 사용 목적

회사 문제를 해결하는 동안 팀은 "왜 `BLOCK`인지", "누가 `REVIEW`를 승인할지", "무엇을 고친 뒤 다시 돌릴지"를 빠르게 기록해야 합니다. 이 카드의 목적은 구현 판단과 의사결정 근거를 숨기지 않고, AgentGuard의 fixture-backed evidence command와 승인자 결정을 같은 로그에 묶는 것입니다.

범위는 문서와 테스트뿐입니다. MCP authorization, OAuth/session control, GitHub native app은 구현 범위가 아닙니다. Dashboard, SaaS, auth, customer data workflow도 이 카드의 범위 밖입니다.

## Onsite decision log

| Company problem | Decision | Evidence command | Verdict | Approver/action | Rerun trigger |
|---|---|---|---|---|---|
| 상담/VOC agent PR diff에 secret-like 값 또는 위험한 shell 변경이 들어간다. | PR merge 전에 security reviewer evidence로 막는다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK` or `REVIEW` | 승인자: security reviewer. 조치: secret-like 값과 risky command 제거 또는 residual risk 기록. | diff 수정 후 같은 `scan-diff` command를 재실행한다. |
| MCP server가 broad filesystem root, writable path, credential-like environment passthrough를 가진다. | 운영 연결 전에 MCP 권한 축소 결정을 남긴다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `BLOCK` | 승인자: agent owner + security reviewer. 조치: root 축소, writable 제거, token passthrough 제거. | MCP config 수정 후 `scan-mcp`를 재실행한다. |
| agent transcript/log에 승인 없는 shell behavior가 보인다. | 바로 배포하지 않고 사람 승인 조건으로 낮춘다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `REVIEW` | 승인자: workflow owner. 조치: 승인된 command 범위와 rollback owner를 기록한다. | policy 또는 transcript 재현 로그가 바뀌면 `scan-log --policy`를 재실행한다. |
| 권한 축소 후 같은 업무 흐름을 다시 보여줘야 한다. | before/after evidence로 `PASS` 후보를 만든다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS` | 승인자: rollout owner. 조치: 제한된 fixture root와 남은 residual risk를 receipt에 남긴다. | MCP root, env passthrough, tool list가 바뀌면 재실행한다. |
| PR diff 수정 후 위험 입력이 제거됐는지 보여줘야 한다. | fixed diff evidence를 decision log에 붙인다. | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `PASS` | 승인자: PR reviewer. 조치: fixed diff 기준으로 merge 가능 여부를 결정한다. | diff가 다시 바뀌거나 새 generated code가 들어오면 재실행한다. |
| CI/security reviewer가 machine-readable artifact를 요구한다. | SARIF handoff를 만들되 GitHub 제품 역할을 대체한다고 말하지 않는다. | `mkdir -p .agentguard-demo && node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | SARIF with `BLOCK`/`REVIEW` finding | 승인자: security reviewer. 조치: SARIF artifact path와 Markdown note를 함께 보존한다. | source diff, rule output, SARIF upload workflow가 바뀌면 재실행한다. |

## Fixture-backed evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 저장소 루트에서 아래 exact command를 실행합니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff
mkdir -p .agentguard-demo && node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

Fixture paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`
- `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`
- `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff`

## Verdict and approver actions

| Verdict | 현장 의미 | approver/action |
|---|---|---|
| `BLOCK` | 출시, merge, MCP 연결, demo claim을 멈춘다. | 승인자는 fix owner를 지정하고 risky diff/config/log를 수정한 뒤 같은 evidence command를 다시 실행하게 한다. |
| `REVIEW` | 사람 검토와 residual risk 기록 없이는 다음 gate로 넘기지 않는다. | 승인자는 business owner, security reviewer, workflow owner 중 한 명을 적고 승인 문장 또는 보류 사유를 남긴다. |
| `PASS` | 현재 synthetic fixture evidence 기준으로 다음 demo 또는 rollout gate 후보가 된다. | 승인자는 같은 command, fixture path, artifact path, 남은 한계를 decision log에 남긴다. |

대표 rule IDs는 `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment`처럼 English-compatible 값을 유지합니다.

## Rerun triggers

- company problem이 바뀌어 PR diff, MCP config, transcript/log surface가 달라진다.
- fixture path 또는 실제 대상 입력이 바뀐다.
- `BLOCK`/`REVIEW` 조치 후 fixed evidence를 보여줘야 한다.
- SARIF artifact path, GitHub Actions upload step, Markdown report handoff가 바뀐다.
- 승인자가 residual risk를 수용하지 않거나 owner/action이 비어 있다.

## Public reference borrow/avoid/action rows

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| AX 인재전쟁 - https://hackathon.jocodingax.ai/ | REAL PROBLEM, REAL JUDGE, REAL OUTPUT framing을 빌려 회사 문제를 command, verdict, 승인자 action으로 낮춘다. | gated scoring detail, 본선 문제 내용, 채용 결과, 운영 실적을 안다고 말하지 않는다. | 6시간 onsite decision마다 company problem, evidence command, verdict, approver/action, rerun trigger를 남긴다. |
| OWASP Agentic AI threats and mitigations - https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | OWASP Agentic AI threats and mitigations의 tool misuse, excessive agency, mitigation/control vocabulary를 빌린다. | OWASP endorsement, complete threat coverage, external assurance를 주장하지 않는다. | PR diff, MCP config, transcript/log evidence를 risk와 mitigation decision으로 연결한다. |
| MCP Authorization - https://modelcontextprotocol.io/specification/draft/basic/authorization | authorization server discovery, least-privilege scope, token/resource boundary language를 빌린다. | AgentGuard가 runtime authorization, OAuth/session control, complete MCP spec coverage를 구현한다고 말하지 않는다. | MCP fixture evidence에서 broad filesystem access, writable path, token passthrough를 approver decision으로 남긴다. |
| GitHub SARIF upload - https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | GitHub SARIF upload 흐름의 third-party SARIF artifact와 reviewer handoff framing을 빌린다. | GitHub native app, hosted code scanning product, automatic triage replacement를 주장하지 않는다. | `scan-diff --sarif --out .agentguard-demo/agentguard.sarif` artifact path를 decision log에 붙인다. |

## Machine-contract boundaries

- CLI commands stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`.
- rule IDs stay English-compatible: `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment`.
- JSON, SARIF, API, machine fields, GitHub code scanning fields, shell paths, package metadata, command flags stay English-compatible.
- Verdict values stay `PASS`, `REVIEW`, `BLOCK`.
- This document does not change scanner behavior, default severity, policy evaluation, runtime enforcement, product name, CLI names, rule names, or output schema.

## Non-claim guardrails

- No customer claim: synthetic fixtures only, no real customer data, no private transcript, no real credentials.
- No adoption claim: this card is an onsite decision log template, not evidence of deployment history.
- No formal assurance claim: no external audit, formal assurance, or standards badge claim.
- No gated-scoring claim: public references frame the demo; they do not reveal hidden judge scoring.
- No runtime enforcement claim: MCP/OAuth authorization, session binding, token validation, consent UI, dashboard, SaaS, auth, and customer data workflows remain out of scope.
- No parity claim: GitHub, OWASP, MCP, and SARIF references provide vocabulary and handoff patterns, not product equivalence.
