# AX demo failure mode register

## 사용 목적

이 문서는 대상권 발표에서 라이브 데모가 happy path만 보인다는 인상을 줄이지 않기 위한 한국어 우선 failure-mode register입니다. 목표는 AgentGuard를 **AX Rollout Guard presentation layer**로 설명하면서도 현재 구현된 CLI evidence 이상을 말하지 않는 것입니다.

모든 입력은 저장소 안의 합성 fixture입니다. 이 문서는 scanner behavior, verdict policy, SARIF/JSON machine contract를 바꾸지 않고, 심사위원이 실패 상황을 물었을 때 바로 보여줄 command, expected verdict, mitigation, judge-defense sentence를 묶습니다.

## Failure-mode register

| Demo failure mode | AgentGuard surface | Exact fixture-backed command | Expected verdict | Mitigation | Judge-defense sentence |
| --- | --- | --- | --- | --- | --- |
| 라이브 데모 중 PR diff가 VOC token-like 값을 새로 추가한다. | PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` 또는 policy/rule 조합에 따른 `REVIEW` | source에서 synthetic secret/PII를 제거하고 secret manager 또는 승인 workflow로 이동한다. | "AgentGuard는 PR diff에서 agent-visible secret exposure를 evidence로 남기고, 수정/정책 조건 전에는 rollout을 멈추게 설명합니다." |
| 커머스 VOC MCP config가 home/root와 writable path를 agent에게 연다. | MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK` 또는 `REVIEW` | filesystem root를 업무 fixture 범위로 줄이고 read-only path와 credential passthrough 제거를 승인 조건으로 둔다. | "AgentGuard는 MCP 실행을 대신 통제한다고 말하지 않고, excessive scope를 사람이 승인할 수 있는 evidence로 바꿉니다." |
| agent transcript/log에 승인 없는 export, 삭제성 command, sensitive path 접근이 남는다. | agent transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` 또는 policy hit에 따른 `BLOCK` | `approval-required` operation을 정책에 명시하고, export/delete/credential access는 human gate 뒤로 보낸다. | "이 로그는 agent 자기보고가 아니라 transcript evidence이며, approval-required action을 사람 승인 문장으로 연결합니다." |
| Before/after demo에서 risky MCP만 보이고 수정 후 PASS 근거가 약하다. | MCP config | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `BLOCK` | risky config의 broad root, writable path, credential-like env passthrough를 설명한다. | "Before는 AgentGuard가 위험을 만드는 장면이고, After 명령으로 수정/정책이 같은 surface에서 검증됩니다." |
| 수정 fixture가 실제로 좁아졌는지 질문받는다. | MCP config | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS` | read-only fixture path, no credential passthrough, scoped command로 좁힌다. | "PASS는 운영 도입 실적이 아니라 현재 synthetic fixture가 narrower MCP config임을 보여주는 CLI evidence입니다." |
| PR before/after story가 marketing copy처럼 들린다. | PR diff | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `REVIEW` 또는 `BLOCK` | risky diff의 token-like literal, PII-like email, risky shell material을 제거 대상으로 설명한다. | "심사자는 diff command 하나로 문제 입력을 볼 수 있고, AgentGuard finding을 수정 조건으로 접을 수 있습니다." |
| 수정된 PR diff가 왜 통과되는지 방어해야 한다. | PR diff | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `PASS` | credential-like 값과 담당자 식별자를 제거하고 fixture scope와 human approval flag만 남긴다. | "PASS는 broad capability claim이 아니라 같은 fixture family에서 risky material이 빠졌다는 judge-visible evidence입니다." |
| GitHub/CI handoff를 묻지만 native integration을 과장하면 안 된다. | SARIF | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF artifact 생성, finding severity에 따라 reviewer handoff | SARIF file을 PR/CI artifact로 넘기고, upload workflow는 별도 GitHub 설정으로 둔다. | "AgentGuard는 SARIF를 내보내는 CLI evidence를 제공하며, GitHub 보안 기능과 같은 범위를 주장하지 않습니다." |

## Exact smoke commands

먼저 `npm run build`를 실행한 뒤 아래 `node dist/index.js ...` 명령을 사용합니다. CI의 docs-contract test는 build 전에도 재현되도록 같은 입력을 `node --import tsx src/index.ts ...` 경로로 함께 검증합니다.

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log

node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff

mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
rm -rf .agentguard-demo
```

## Judge-defense sentences

- "이 문서는 라이브 데모 실패를 숨기지 않고 PR diff, MCP config, agent transcript/log, SARIF evidence로 나눠서 대응합니다."
- "대상권 발표에서는 AgentGuard가 agent governance를 혼자 해결한다고 말하지 않고, 현재 CLI가 보여주는 failure evidence와 human gate를 보여줍니다."
- "AgentGuard의 강점은 한국어 승인 문장과 English-compatible CLI/SARIF evidence를 같이 보여주는 것입니다."
- "수정/정책 이후 `PASS`는 fixture-backed command가 확인한 현재 입력의 결과이며, 운영 채택이나 외부 보증을 뜻하지 않습니다."

## Public references

| Reference | Borrow | Avoid | AgentGuard framing |
| --- | --- | --- | --- |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent risk, failure taxonomy, mitigation framing | 단일 CLI가 agent governance를 모두 해결한다는 표현 | failure mode를 sensitive data exposure, tool misuse, excessive agency evidence로 설명한다. |
| https://github.com/snyk/agent-scan | AI-agent, MCP, security-scanner category language | feature parity, vendor-scale coverage, replacement framing | AgentGuard는 Korean-first PR diff + MCP config + transcript/log evidence demo로 차별화한다. |
| https://docs.anthropic.com/en/docs/claude-code/security | permission boundary, approval boundary, human gate wording | private/credentialed workflow access나 vendor endorsement 암시 | approval-required operation과 사람이 승인해야 하는 rollout gate를 설명한다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF artifact handoff, reviewer/CI evidence routing | native GitHub product replacement 또는 uploaded result 보장 | 현재 구현된 `scan-diff --sarif --out` artifact를 reviewer handoff evidence로 보여준다. |

## 하지 않는 주장 / Non-claims

- 운영 채택, 외부 보증, 표준 인증, 고객 reference를 주장하지 않습니다.
- GitHub, Snyk, Anthropic, OWASP의 승인이나 검증을 받았다고 말하지 않습니다.
- 기존 보안 제품군을 대체한다고 말하지 않습니다.
- MCP server runtime permission을 AgentGuard가 직접 집행한다고 말하지 않습니다.
- dashboard, hosted SaaS, auth, customer upload, private workflow access를 이 slice의 기능으로 말하지 않습니다.
