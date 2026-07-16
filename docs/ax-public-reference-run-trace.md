# AX public reference run trace

## 목적

한국어 우선 AX Rollout Guard 심사 준비에서 매 run의 public reference refresh를 **source-of-record evidence**와 바로 연결하기 위한 1분 trace 카드입니다. 대상권/AX judging에서는 “좋은 보안 키워드를 읽었다”보다 “unknown company problem이 와도 어떤 승인 질문과 어떤 AgentGuard 명령으로 재현할 것인가”가 더 중요합니다.

이 문서는 scanner behavior, CLI flags, rule IDs, PASS/REVIEW/BLOCK verdict semantics, JSON/SARIF schema, package metadata, GitHub Action behavior를 바꾸지 않습니다.

## Public signals checked this run

| Public reference | Borrow | Avoid | How it shapes this slice |
| --- | --- | --- | --- |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | `agent/MCP server/skill scanning`처럼 agent surface를 inventory 단위로 설명하는 방식. | 동일 범위·대체재·외부 도입 증거처럼 들리는 주장. | AgentGuard는 public scanner category와 경쟁한다고 말하기보다 PR diff/MCP/transcript/SARIF를 한 run trace로 묶어 reviewer가 재현하게 한다. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | `least privilege`, `explicit user consent`, token/permission boundary language. | 구현되지 않은 실시간 OAuth/session/consent 제어 주장. | MCP config risk는 static pre-rollout evidence로 제한하고, approval owner가 broad root/env passthrough를 판단하게 한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | `SARIF reviewer handoff` and artifact preservation vocabulary. | GitHub upload가 자동 승인, 보안 보증, triage 완료를 뜻한다는 표현. | SARIF는 reviewer channel artifact이며 approval action과 분리한다. |
| [agent-scan npm registry](https://registry.npmjs.org/agent-scan) | `public registry metadata`로 AI-agent activity scanner category pressure를 확인. | npm metadata를 시장 검증, 성숙도, 인증, 외부 도입 증거로 확대 해석. | AgentGuard는 registry 신호를 source-of-record 명령/fixture evidence로 되돌린다. |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | `agentic threat-to-mitigation`처럼 agent 권한·도구 호출·데이터 노출 위험을 대응 조건으로 연결하는 방식. | OWASP 문구를 구현 완료 보증, 외부 승인, 전체 위협 커버리지 주장으로 확대 해석. | PR diff/MCP/transcript/SARIF evidence를 “위험 → 승인 조건 → rerun” trace로 설명한다. |
| [Anthropic Claude Code Security](https://docs.anthropic.com/en/docs/claude-code/security) | `workspace trust`와 `tool permission review`를 배포 전 agent-workspace 승인 질문으로 바꾸는 언어. | Claude/Anthropic이 AgentGuard를 승인했거나, AgentGuard가 Claude Code 내부 권한 모델을 제어한다는 표현. | unknown company problem에서 Codex/Cursor/Claude Code 도입 전 workspace/file/tool 권한을 먼저 묻는 행을 강화한다. |
| [OpenAI Agents guardrails](https://openai.github.io/openai-agents-python/guardrails/) | `guardrail tripwire`처럼 agent 입력·출력·도구 흐름을 멈추고 사람이 검토하는 checkpoint vocabulary. | hosted runtime guardrail, OpenAI approval, automatic policy enforcement를 구현된 기능처럼 말하는 것. | AgentGuard의 `REVIEW`/`BLOCK`을 runtime 대체물이 아니라 reviewer가 rerun해야 하는 static pre-rollout tripwire로 위치시킨다. |

## Run decision matrix

| Judge question | Source evidence | AgentGuard command | Approval action |
| --- | --- | --- | --- |
| 새 PR diff에 secret-like 값이나 위험 shell rollout clue가 들어왔는가? | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `REVIEW`/`BLOCK` finding을 PR approver와 security reviewer에게 넘기고, 수정 diff나 정책 예외 조건 없이는 배포하지 않는다. |
| MCP server가 너무 넓은 filesystem root, writable path, env token passthrough를 요구하는가? | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | approval owner가 least-privilege root/env boundary를 다시 정하고, explicit user consent가 필요한 동작을 배포 전 조건으로 둔다. |
| agent transcript/log가 승인 없는 shell/file operation 흔적을 남겼는가? | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` + `examples/agent-policy.yaml` | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | workflow owner가 approval-required operation을 확인하고 rerun/fix/policy condition을 기록한다. |
| reviewer가 terminal stdout만 믿지 않고 artifact를 다시 열 수 있는가? | synthetic PR diff + SARIF file | `node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-run-trace.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF artifact를 reviewer handoff로 남기되, GitHub/SARIF가 external approval을 대신한다고 말하지 않는다. |

## Exact evidence commands

Fresh-clone rerun prerequisite:

For a fresh-clone rerun, start with:

```bash
npm ci
npm run build
```

Then run:

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-run-trace.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Expected risky inputs may exit non-zero when the verdict is `REVIEW` or `BLOCK`; the evidence is acceptable only after the reviewer checks the report/artifact shape, source fixture, command, and current build.

## Machine-contract boundary

Preserve the existing English-compatible machine contracts:

- `PASS`, `REVIEW`, `BLOCK`
- `scan-diff`, `scan-mcp`, `scan-log`
- `--policy`, `--sarif`, `--out`
- JSON/SARIF field names and rule IDs
- npm package/action behavior

This card is docs-contract evidence only. It does not add hosted auth, dashboard, live MCP consent control, package publishing, or new scanner detection semantics.

## Non-claim guardrails

- Public references are used as Borrow/Avoid/Action input, not as endorsement.
- Do not claim external security accreditation, conformance, or official approval.
- 실제 운영사 도입 증거가 있다고 말하지 않는다.
- Do not claim AgentGuard replaces public scanners or has identical scope.
- 구현된 것은 static pre-rollout/reviewer handoff evidence이며, OAuth/session/consent를 실행 중에 제어한다고 말하지 않는다.
