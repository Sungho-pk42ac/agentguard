# AX evidence freshness SLA card

## 사용 목적

한국어 우선 운영 카드입니다. AX Rollout Guard 데모에서 `PR diff → MCP config → transcript/log → evidence bundle` 증거가 **언제 stale evidence가 되는지**, 누가 rerun trigger를 눌러야 하는지, 그리고 어떤 artifact가 source of record인지 30초 안에 정리합니다.

이 문서는 심사/본선 현장에서 “이 증거가 지금도 유효한가?”라는 질문에 답하기 위한 freshness SLA입니다. AgentGuard의 CLI 명령은 안정적인 English-compatible contract로 유지합니다. rule IDs, JSON, SARIF, API, machine fields도 같은 계약 범위입니다.

사람이 읽는 승인 문장만 한국어 우선으로 둡니다.

## Freshness SLA matrix

| Evidence surface | Freshness SLA | Source of record | Rerun trigger | Approval owner action |
|---|---:|---|---|---|
| PR diff evidence | 15분 또는 새 commit 즉시 | `node dist/index.js scan-diff < examples/risky-pr.diff` 출력과 PR head SHA | head SHA 변경, reviewer 질문, fixture 수정 | stale이면 rerun 후 `PASS` / `REVIEW` / `BLOCK`를 다시 확인 |
| MCP config evidence | 30분 또는 정책 파일 변경 즉시 | `node dist/index.js scan-mcp < examples/risky-mcp.json` 출력과 policy hash | MCP server/tool/root/env delta, authorization boundary 질문 | broad tool/root/env risk를 승인 조건 또는 차단 조건으로 재분류 |
| Transcript/log evidence | 30분 또는 agent workflow 변경 즉시 | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` 출력 | approval-required operation 추가, denied command/PII/secret 질문 | 운영 담당자가 `REVIEW` 잔여위험과 fix/policy 조건을 기록 |
| SARIF artifact | 15분 또는 artifact hash 불일치 즉시 | `node dist/index.js scan-diff --sarif --out .agentguard-demo/evidence-freshness-sla.sarif < examples/risky-pr.diff` 산출물의 `artifactLocation.uri`, `ruleId`, artifact hash | upload 전, reviewer channel switch, stale/mixed artifact 의심 | GitHub/SARIF reviewer에게 최신 artifact path와 hash를 전달 |
| Smoke manifest | 10분 또는 demo rehearsal 직전 | `npm run smoke:ax-demo`가 생성하는 manifest/report bundle | 발표 직전, fresh clone, Node/package 변경 | source of record manifest 기준으로 승인/재실행/차단을 결정 |

## Exact fixture-backed rerun commands

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 아래 명령을 rerun합니다.

```bash
mkdir -p .agentguard-demo
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/evidence-freshness-sla.sarif < examples/risky-pr.diff
npm run smoke:ax-demo
```

Fixture/source paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`
- `scripts/ax-demo-smoke.mjs`
- `.agentguard-demo/evidence-freshness-sla.sarif` is generated evidence, not committed source.
- Cleanup for rehearsal-only artifacts: `rm -rf .agentguard-demo/` (the directory is ignored by `.gitignore`).

Expected risky inputs may return non-zero when the verdict is `BLOCK`. Treat non-zero as expected only after checking the verdict/report/artifact shape. Build/setup failures, missing fixtures, empty SARIF, stale SHA, mixed artifact, or missing source-of-record manifest are not acceptable evidence.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Use agent/tool misuse, prompt-influenced actions, and continuous control evidence language. | Do not claim OWASP approval, certification, replacement, or platform parity. | Keep PR/MCP/transcript evidence rerunnable and map stale findings to business approval actions. |
| MCP Authorization — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | Use authorization/session boundary language to explain why MCP evidence should be refreshed when tools, roots, or callbacks change. | Do not claim runtime OAuth, session validation, redirect URI validation, or consent enforcement. | Frame `scan-mcp` as static preflight evidence that informs approval owners before rollout. |
| GitHub SARIF upload — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | Borrow reviewer handoff and artifact path/hash discipline for code-scanning style evidence. | Do not claim automatic SARIF upload, automatic triage, or GitHub approval. | Require latest SARIF artifact path/hash before security reviewer or CI handoff. |

## Machine-contract boundaries

- `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, and `agentguard doctor` remain English-compatible CLI contracts.
- `PASS`, `REVIEW`, `BLOCK`, rule IDs, JSON, SARIF, API, machine fields, `ruleId`, `artifactLocation.uri`, and `tool.driver.name` are stable contract fields.
- This card documents freshness SLA and reviewer handoff. It does not change scanner scoring, policy evaluation, exit codes, report schema, or GitHub Action behavior.
- The source of record is the current repo/CI/host artifact plus rerunnable command output, not agent self-report.

## Non-claim guardrails

- no scanner behavior change
- no exit-code semantics change
- no default verdict/severity change
- no automatic SARIF upload
- no runtime authorization claim
- no real customer/adoption claim
- no external certification
- no platform parity claim
