# AX third-party agent scanner due diligence card

## 목적

AX Rollout Guard는 제3자 AI-agent/MCP 보안 스캐너를 **대체**한다고 말하지 않습니다. 이 카드는 기업 심사위원이 “이미 Snyk agent-scan, AI-Infra-Guard, agentic-radar 같은 third-party scanner가 있는데 왜 AgentGuard가 필요한가?”라고 물을 때, AgentGuard가 어떤 **source-of-record evidence**를 추가로 만들고 어떤 승인 결정을 돕는지 30초 안에 설명하기 위한 한국어 우선 due-diligence 카드입니다.

핵심 답변은 다음 한 문장입니다.

> 공개 agent/MCP scanner는 탐지 범주를 넓혀 주고, AgentGuard는 한국 기업의 PR diff / MCP config / transcript/log / SARIF artifact를 같은 fixture-backed command로 재현해 `PASS` / `REVIEW` / `BLOCK` 승인 조건으로 묶습니다.

## Fresh public scanner signals checked this run

| Public signal | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | `agent/MCP server/skill scanning`처럼 agent surface를 명확히 분리하는 설명 | Snyk 도구와 같은 범위·역할·운영 실적을 가진다고 주장하지 않기 | PR diff, MCP config, transcript/log를 각각 AgentGuard evidence command로 재현해 rollout approval에 붙입니다. |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | AI infra guardrail, MCP scan, skill scan처럼 ecosystem risk를 넓게 보는 관점 | AgentGuard가 광범위한 AI 보안 제품군이라고 말하지 않기 | AgentGuard 범위를 local rollout approval gate와 static scanner evidence로 제한합니다. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | agentic workflow scanner vocabulary와 tool permission 질문 | 실행 중 identity/session 통제를 보장한다고 말하지 않기 | runtime 제어가 아니라 source artifact와 reviewer handoff 중심의 due-diligence 질문으로 변환합니다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF artifact를 reviewer/channel handoff로 남기는 방식 | 자동 업로드, 자동 승인, 외부 보안팀 승인 완료를 주장하지 않기 | `scan-diff --sarif --out ...` 결과를 사람이 검토할 evidence packet으로 보존합니다. |

## 30-second judge answer

1. **이미 있는 scanner를 부정하지 않습니다.** AgentGuard는 public scanner ecosystem을 참고하지만, 그들과 같은 범위나 역할이라고 주장하지 않습니다.
2. **회사 문제가 들어오면 네 개 evidence surface로 쪼갭니다.** PR diff, MCP config, transcript/log, SARIF artifact가 각각 어떤 rollout risk를 보여주는지 `PASS` / `REVIEW` / `BLOCK`으로 설명합니다.
3. **승인 가능한 한국어 리포트로 묶습니다.** 보안 finding을 business approver가 이해할 수 있는 수정 조건, policy 조건, residual risk로 바꿉니다.
4. **재현 가능한 명령을 남깁니다.** 심사위원이나 보안 리뷰어가 같은 fixture-backed command를 다시 실행해 source-of-record evidence를 확인할 수 있습니다.

## Due-diligence decision route

| Company question | Evidence surface | Exact command | Expected decision |
|---|---|---|---|
| “이 PR이 agent-visible secret이나 위험 command를 추가했나?” | PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK`이면 merge 중단, secret 제거 또는 policy/fix 후 rerun |
| “MCP server 설정이 filesystem root나 token passthrough를 열었나?” | MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK`/`REVIEW`이면 scope 축소, env 제거, 승인 owner 지정 |
| “에이전트 실행 로그가 승인 필요한 operation을 수행했나?” | transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | denied-command나 approval-required operation이면 business/security owner review |
| “보안 리뷰 채널에 넘길 artifact가 있나?” | SARIF artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/third-party-scanner-due-diligence.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF file을 reviewer handoff에 첨부하고 hash/freshness를 rerun 조건으로 사용 |
| “전체 demo evidence가 한 번에 재현되나?” | smoke manifest | `npm run smoke:ax-demo` (`scripts/ax-demo-smoke.mjs`) | manifest의 `schemaVersion`, `gitCommitSha`, `sourceSha256`, `artifactSha256`, `verdict`로 evidence freshness 확인 |

## Machine contracts

이 카드는 사람용 한국어 설명을 추가하지만 다음 machine-facing 계약은 바꾸지 않습니다.

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `agentguard doctor`
- Flags: `--policy`, `--sarif`, `--out`, `--json`, `--lang en`
- Verdicts: `PASS`, `REVIEW`, `BLOCK`
- rule IDs: `generic-secret-assignment`, `denied-command`, `mcp-filesystem-wide-root`, `mcp-env-token`
- JSON / SARIF fields: `schemaVersion`, `gitCommitSha`, `sourceSha256`, `artifactSha256`, `ruleId`, `locations`
- Public docs are due-diligence guidance only; scanner behavior, SARIF schema, package metadata, and CI integration stay unchanged.

## Non-claim guardrails

- No deployed-customer proof claim.
- No external audit badge, public-source endorsement, or formal assurance claim.
- No scanner equivalence or drop-in alternative claim.
- No broad red-team suite claim.
- No live identity/session control claim.
- No automatic SARIF upload, automatic approval, or external reviewer approval claim.

## Operator handoff

When a company-specific final problem arrives, use this card as the question template:

1. Which surface is in scope: PR diff, MCP config, transcript/log, workspace files, SARIF artifact, or smoke manifest?
2. Which fixture-backed command will become the company-specific proof command?
3. Which approver owns `REVIEW` findings and which condition turns them into `PASS`?
4. Which public scanner signal is being borrowed, and what unsupported claim must be avoided?
5. Which artifact path or hash proves the evidence is fresh enough to hand off?
