# AX CLI exit semantics evidence card

한국어 우선 AX Rollout Guard CLI exit semantics evidence card입니다. 목적은 심사자와 운영자가 `PASS`, `REVIEW`, `BLOCK` 결과의 exit code를 infrastructure/build failure와 구분하고, risky nonzero exit에서도 SARIF evidence handoff가 보존될 수 있음을 30초 안에 확인하게 하는 것입니다.

CLI commands, rule IDs, verdict values, JSON, SARIF, API, and machine fields stay English-compatible.

## 사용 목적

이 카드는 현재 저장소의 synthetic fixture와 구현된 CLI behavior만 설명합니다. 새로운 scanner behavior, exit-code semantics, rule ID, severity default, SARIF schema를 추가하지 않습니다.

운영자는 먼저 `npm run build`로 local CLI가 준비되었는지 확인하고, 아래 fixture-backed command를 실행합니다. `BLOCK` 때문에 `exit 1`이 나오는 것은 의도된 risky nonzero exit입니다. 빌드 실패, fixture 없음, `dist/index.js` 없음, SARIF file 미생성은 infrastructure/build failure로 분리해서 triage합니다.

## Exit semantics quick table

| Verdict | Observed CLI exit | Judge/operator meaning | Next evidence action |
|---|---|---|---|
| `PASS` | `exit 0` | 현재 fixture 기준 위험 finding이 없습니다. | command, fixture path, timestamp를 approval note에 남깁니다. |
| `REVIEW` | `exit 0` | 사람이 검토할 finding이 있지만 이 command 자체는 실행 성공입니다. | owner가 residual risk와 approval condition을 기록합니다. |
| `BLOCK` | `exit 1` | critical/high-risk finding 때문에 rollout 또는 merge를 멈추라는 의도된 risky nonzero exit입니다. | finding rule IDs와 rerun command를 보존하고 fix/policy 후 같은 command를 다시 실행합니다. |
| Build/setup failure | non-zero before verdict | `PASS`/`REVIEW`/`BLOCK` evidence가 아닙니다. | `npm ci`, `npm run build`, fixture path, shell redirection부터 복구합니다. |
| SARIF handoff with finding | risky scan may be non-zero | SARIF artifact creation과 rollout approval은 별도 판단입니다. | generated `.sarif` file을 reviewer-owned workflow에 넘기고 approval을 자동으로 주장하지 않습니다. |

## Exact fixture-backed commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행합니다. 아래 commands는 저장소 루트에서 그대로 복사해 실행하는 evidence path입니다.

| Evidence | Exact command | Fixture path | Expected verdict/exit |
|---|---|---|---|
| PASS MCP permission fix | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS`, `exit 0` |
| REVIEW transcript policy evidence | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | `REVIEW`, `exit 0` |
| BLOCK MCP least-privilege evidence | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | `BLOCK`, `exit 1` |
| Risky SARIF evidence handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-exit-semantics.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff` | may return `exit 1` while writing `.agentguard-demo/ax-cli-exit-semantics.sarif` |

Operator note wording:

```text
This was an expected risky nonzero exit from AgentGuard finding evidence, not an infrastructure/build failure. The approval decision remains reviewer-owned.
```

## SARIF evidence handoff

SARIF is a machine-readable evidence artifact. AgentGuard writes SARIF fields such as `ruleId`, `artifactLocation.uri`, and `tool.driver.name` so GitHub code scanning or another reviewer workflow can consume the file shape.

이 카드는 SARIF-as-evidence wording만 사용합니다. GitHub upload, alert triage, approval, risk closure는 reviewer-owned workflow입니다. AgentGuard CLI가 automatic upload 또는 automatic approval을 수행한다고 말하지 않습니다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations - https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Borrow: agent tool misuse, excessive agency, mitigation owner vocabulary. | Avoid: OWASP endorsement, complete threat coverage, or external assurance claim. | Map risky tool/config/log evidence to `REVIEW` or `BLOCK` approval-stop language. |
| MCP Security Best Practices - https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices | Borrow: least privilege, authorization boundary, dangerous command and token handling vocabulary. | Avoid: runtime enforcement, OAuth/session control, consent UI, or MCP spec-compliance claim. | Use `agentguard scan-mcp` as static scanner evidence, then route residual risk to a human owner. |
| GitHub SARIF support docs - https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | Borrow: SARIF artifact handoff and code scanning vocabulary. | Avoid: automatic upload, hosted alert ownership, or approval completion claim. | Generate `.agentguard-demo/ax-cli-exit-semantics.sarif` and hand it to the reviewer workflow. |
| Vercel CLI docs - https://vercel.com/docs/cli | Borrow: copy-pasteable CLI readiness and status pattern. | Avoid: vendor parity, hosted deployment workflow, adoption, or platform scope claim. | Keep judge proof to `npm run build` plus exact local AgentGuard commands. |
| Snyk CLI exit-code docs - https://docs.snyk.io/developer-tools/snyk-cli/snyk-cli/debugging-the-snyk-cli | Borrow: explicit CLI exit semantics and failure triage vocabulary. | Avoid: vendor parity, scanner coverage breadth, adoption, or same product scope claim. | Explain AgentGuard `PASS`/`REVIEW`/`BLOCK` exits without changing CLI behavior. |

## Machine-contract boundaries

- `agentguard scan-mcp`, `agentguard scan-log`, `agentguard scan-diff`, and `agentguard doctor` remain English-compatible command contracts.
- `PASS`, `REVIEW`, `BLOCK`, rule IDs, JSON, SARIF, API, and machine fields are not translated or renamed.
- Existing rule IDs such as `secret.github_token` and `mcp.broad_filesystem_access` remain unchanged.
- SARIF fields such as `ruleId`, `artifactLocation.uri`, and `tool.driver.name` remain machine-facing fields, not Korean prose labels.
- Scanner evidence is not runtime authorization, runtime approval, or runtime containment.

## Non-claim guardrails

- No CLI behavior change: this card documents observed behavior only.
- No exit-code semantics change: `PASS`/`REVIEW`/`BLOCK` meanings and exits are not modified here.
- No default severity change: rule severity, verdict thresholds, JSON, and SARIF output stay unchanged.
- No automatic SARIF upload claim: SARIF file creation is separate from GitHub upload and approval.
- No runtime authorization claim: MCP consent, OAuth/session enforcement, and tool-call containment are outside this card.
- No real customer/adoption claim: synthetic fixture evidence is not customer data, rollout adoption, or production proof.
- No external certification: public references are vocabulary anchors, not certification or endorsement.
- No platform parity claim: AgentGuard is not presented as Vercel, Snyk, GitHub code scanning, OWASP, MCP runtime control, or a broad security platform equivalent.
