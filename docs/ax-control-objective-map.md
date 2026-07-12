# AX control objective map

한국어 우선 control-objective map입니다. 목적은 AX 인재전쟁 현장에서 아직 모르는 회사 문제를 받았을 때, AgentGuard evidence를 “어떤 통제를 증명하는가”로 빠르게 번역하는 것입니다. 이 문서는 scanner behavior, CLI commands, rule IDs, JSON/SARIF field names, package publishing, runtime authorization, or verdict policy를 바꾸지 않습니다.

## purpose

현장 질문은 보통 “이 agent를 업무에 넣어도 되는가?”입니다. AgentGuard 답변은 단순 취약점 목록이 아니라 다음 순서여야 합니다.

1. 회사 문제가 어떤 agent/tool workflow를 요구하는지 식별한다.
2. workflow를 PR diff, MCP config, transcript/log, report/SARIF, smoke evidence surface로 나눈다.
3. 각 surface를 control objective와 연결한다.
4. `PASS` / `REVIEW` / `BLOCK` evidence를 exact command와 artifact로 재실행한다.
5. approver가 fix, policy exception, rollout stop, rerun trigger를 기록한다.

## control objective map

| Company problem signal | AgentGuard surface | Control objective | Exact evidence command / artifact | Approver decision | Rerun / freshness trigger |
|---|---|---|---|---|---|
| Agent가 PR에서 secret-like value, risky shell, PII-like text를 추가한다. | PR diff | Agent-written code change가 rollout 전에 secret/PII/tool-risk review를 통과해야 한다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | PR owner와 security owner가 `BLOCK` finding을 제거하거나 narrow policy exception을 기록한다. | PR diff, rule ID, policy file, or reviewer owner가 바뀌면 같은 command를 재실행한다. |
| MCP server config가 filesystem root, writable path, env token passthrough를 노출한다. | MCP config | Tool permission은 least privilege와 authorization boundary를 넘지 않아야 한다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | MCP/tool owner가 root path와 env passthrough를 줄이거나 residual risk를 `REVIEW`로 승인한다. | MCP config, server command, env descriptor, path scope, or business owner가 바뀌면 재실행한다. |
| Agent transcript/log에 승인 없는 export, destructive command, broad tool action이 남는다. | transcript/log | Agent action은 사람 승인과 rollback context 없이 자동 실행으로 넘어가면 안 된다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | agent operator와 business owner가 denied-command finding을 제거, 승인 메모 작성, or rollout stop 중 하나를 결정한다. | transcript source, policy YAML, approval owner, or command allow/deny 조건이 바뀌면 재실행한다. |
| Reviewer가 PR/CI에서 evidence를 파일로 받아야 한다. | SARIF/report handoff | Findings는 reviewer artifact로 전달되어 `ruleId`, location, result를 따라갈 수 있어야 한다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/control-objective-map.sarif < examples/risky-pr.diff` and `.agentguard-demo/control-objective-map.sarif` | CI/release owner가 SARIF or Markdown artifact를 reviewer-owned handoff로 보존하고 approval note를 연결한다. | SARIF schema expectation, output path, PR diff, or code-scanning workflow가 바뀌면 artifact를 다시 생성한다. |
| Demo operator가 여러 surface를 한 번에 재현해야 한다. | smoke/evidence freshness | Evidence bundle은 agent self-report가 아니라 같은 build에서 재생된 source-of-record manifest여야 한다. | `npm run smoke:ax-demo`, `scripts/ax-demo-smoke.mjs`, and `.agentguard-demo/ax-evidence-smoke/manifest.json` | demo operator가 manifest, JSON/SARIF artifacts, source fixture hash가 같은 run에서 왔는지 확인한다. | build output, fixture, policy, smoke script, or evidence directory가 바뀌면 smoke manifest를 fresh하지 않다고 보고 재실행한다. |

## fixture-backed evidence commands

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/control-objective-map.sarif < examples/risky-pr.diff
npm run smoke:ax-demo
```

These commands are intentionally local and fixture-backed. Risky fixture exits can be non-zero when the expected verdict is `BLOCK` or `REVIEW`; the operator must inspect the verdict, rule IDs, and generated artifact instead of treating any non-zero risky scan as infrastructure failure.

## public reference rows

| Public reference | Borrow | Avoid | AgentGuard control-objective use |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | agentic risk, tool misuse, excessive agency, mitigation/control vocabulary | OWASP certification, full threat-model coverage, external assurance, or verified-by-OWASP language | Translate findings into stop, review, fix, residual-risk owner, and rerun controls. |
| [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) | authorization, least privilege, token/session boundary, human approval vocabulary | runtime OAuth/session enforcement, redirect validation, consent UI implementation, or MCP conformance claim | Explain MCP config scanning as static preflight evidence before a human approver accepts tool permissions. |
| [GitHub SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | SARIF result, `ruleId`, location, reviewer artifact, and code-scanning handoff vocabulary | automatic upload, GitHub-native ownership, code-scanning replacement, or parity claim | Frame `.sarif` output as reviewer-owned handoff evidence that can be archived or uploaded by the repo owner. |

## machine-contract boundaries

- Human-facing Korean text may explain business risk, control objective, approver decision, and rerun trigger.
- Machine-facing strings stay English-compatible: `PASS`, `REVIEW`, `BLOCK`, `scan-diff`, `scan-mcp`, `scan-log`, `JSON`, `SARIF`, `ruleId`, `artifactLocation`, `region.startLine`.
- `agentguard scan-diff`, `agentguard scan-mcp`, and `agentguard scan-log` remain CLI command names; command spelling stays stable for automation.
- `.agentguard-demo/control-objective-map.sarif` is an ignored local demo artifact path, not a committed source-of-record file.

## claim guardrails

- No customer logo, production rollout story, or external assurance is asserted.
- OWASP, Snyk, GitHub code scanning, MCP Authorization, SARIF tooling, and enterprise policy approval remain separate references or owner workflows.
- OAuth, redirect URI, consent UI, session, and token controls remain outside this static preflight evidence card.
- This map only describes current repo evidence and fixture-backed commands that a reviewer can rerun.
