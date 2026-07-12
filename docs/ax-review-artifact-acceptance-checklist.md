# AX review artifact acceptance checklist

한국어 우선 reviewer artifact acceptance checklist입니다. 목적은 AX Rollout Guard 데모나 PR review에서 생성된 Markdown/JSON/SARIF evidence bundle을 사람이 `accept`, `request rerun`, 또는 `block`으로 판정할 때 agent self-report가 아니라 rerunnable command와 artifact를 기준으로 삼게 하는 것입니다.

이 문서는 현재 저장소의 synthetic fixture와 existing CLI output만 다룹니다. CLI commands, rule IDs, JSON, SARIF, verdict values, API/machine fields는 English-compatible 계약으로 유지합니다.

## 사용 목적

- 회사 문제가 PR diff, MCP config, transcript/log, 또는 SARIF reviewer channel 중 어디로 들어오든 같은 acceptance 기준을 적용한다.
- Reviewer가 artifact 이름만 믿지 않고 source fixture, command, expected verdict, rerun trigger를 함께 확인한다.
- `PASS` / `REVIEW` / `BLOCK`을 한국어 승인 문장으로 설명하되 machine contract 자체는 번역하거나 rename하지 않는다.
- Artifact가 오래됐거나 source-of-record가 불분명하면 승인하지 않고 request rerun으로 돌린다.

## acceptance decision table

| Review surface | Source evidence | Exact evidence command / artifact | Acceptance decision | Rerun / block trigger |
|---|---|---|---|---|
| PR diff risk | `examples/risky-pr.diff` | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK` finding이 있으면 rollout/merge 중단, 제거 후 같은 command로 재검증 | target SHA, PR diff, scanner version, or ruleId가 바뀌면 rerun |
| MCP config risk | `examples/risky-mcp.json` | `node dist/index.js scan-mcp < examples/risky-mcp.json` | broad root, writable path, credential passthrough가 남으면 `BLOCK`; least-privilege 축소 후 승인 검토 | MCP server, args, env, root path, permission boundary가 바뀌면 rerun |
| Agent transcript/log approval | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | denied or approval-required action은 `REVIEW`; owner가 residual risk나 policy exception을 기록해야 accept | policy YAML, transcript source, command allow/deny 조건이 바뀌면 rerun |
| SARIF reviewer artifact | `examples/risky-pr.diff` | `node dist/index.js scan-diff --sarif --out .agentguard-demo/review-artifact-acceptance/agentguard.sarif < examples/risky-pr.diff` | SARIF `ruleId`, `artifactLocation`, `region.startLine`이 Markdown/JSON finding과 같은 evidence를 가리키면 accept candidate | SARIF file이 없거나 다른 SHA/diff에서 생성됐거나 upload channel만 있고 raw command evidence가 없으면 request rerun |

## exact fixture-backed commands

Fresh clone에서는 repository root에서 `npm ci && npm run build` 후 아래 명령을 실행합니다. 위험 fixture는 의도적으로 `BLOCK` 또는 `REVIEW`로 끝날 수 있으므로, reviewer는 exit code만 보지 말고 verdict, rule IDs, redacted evidence, artifact path를 함께 확인합니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/review-artifact-acceptance/agentguard.sarif < examples/risky-pr.diff
```

Referenced local paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`
- `.agentguard-demo/review-artifact-acceptance/agentguard.sarif` (generated, ignored local evidence)

## reviewer acceptance checklist

- [ ] Source artifact path and exact command are recorded together.
- [ ] `PASS` / `REVIEW` / `BLOCK` came from AgentGuard output, not from a chat summary.
- [ ] SARIF, JSON, and Markdown evidence point to the same source input and expected reviewer question.
- [ ] `ruleId`, `artifactLocation`, and `region.startLine` are preserved for machine-readable reviewer handoff.
- [ ] `scan-diff`, `scan-mcp`, `scan-log`, `--policy`, `--sarif`, and `--out` command contracts are not translated or renamed.
- [ ] Stale evidence, missing source fixture, missing SARIF file, or mismatched SHA means request rerun rather than accept.
- [ ] `REVIEW` requires an approval owner and residual-risk note; `BLOCK` requires fix/policy change and rerun before rollout.

## public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| GitHub Actions workflow artifacts — https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow | Artifact upload/download as a practical reviewer handoff surface. | Do not claim artifacts are permanent, legal retention, or evidence without rerunnable commands. | Pair every artifact path with an exact fixture-backed `node dist/index.js ...` command and rerun trigger. |
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF file handoff, `ruleId`, location, and reviewer channel framing. | Do not claim AgentGuard automatically uploads SARIF or is a GitHub-native code scanning platform. | Generate SARIF with `scan-diff --sarif --out` and let reviewer-owned workflow decide upload/approval. |
| MCP security best practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Least privilege, user consent, audit/logging, token and permission boundary language. | Do not claim runtime OAuth/session enforcement or consent UI behavior from a static config scan. | Use `scan-mcp` evidence to ask whether MCP root/env/tool permissions are acceptable before rollout. |
| OWASP AI Agent Security Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html | Human approval, auditability, tool-use control, and excessive-agency framing. | Do not claim complete agent-security mitigation or external assurance. | Route PR/MCP/transcript findings to owner decision, rerun condition, and `PASS` / `REVIEW` / `BLOCK` acceptance. |

## machine-contract boundaries

Machine-facing contracts stay English-compatible: `PASS`, `REVIEW`, `BLOCK`, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `scan-diff`, `scan-mcp`, `scan-log`, `JSON`, `SARIF`, `ruleId`, `artifactLocation`, `region.startLine`, `--policy`, `--sarif`, and `--out`.

## claim guardrails

- No customer adoption claim: 실제 고객사, 운영 도입, real customer adoption, production rollout proof를 말하지 않는다.
- No certification claim: SOC 2, ISO 27001, official certification, formal assurance, or external verification을 말하지 않는다.
- No platform parity claim: GitHub code scanning, Snyk, OWASP, MCP runtime authorization, or broad AI security suite와 동등하거나 대체한다고 말하지 않는다.
- No runtime-auth claim: static evidence card가 OAuth, session, token, consent, or authorization enforcement를 수행한다고 말하지 않는다.
- No automatic SARIF upload claim: AgentGuard CLI가 GitHub에 자동 SARIF upload를 수행한다고 말하지 않는다.
- No legal retention-engine claim: 이 checklist는 reviewer workflow와 rerun 기준이며 법무 보존, eDiscovery, hosted archival, or retention SaaS를 제공하지 않는다.
