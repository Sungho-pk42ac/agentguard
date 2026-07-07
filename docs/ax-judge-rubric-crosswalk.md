# AX judge rubric crosswalk

한국어 우선 설명으로 AX judging lens를 현재 AgentGuard evidence에 연결한다. CLI, rule IDs, JSON, SARIF, API, machine fields stay English-compatible.

## 사용 목적

심사자가 "좋은 agent rollout 보안 증거인가?"를 볼 때 쓰는 렌즈를 공개 reference와 현재 repo fixture-backed command에 맞춘다. 이 문서는 외부 도구나 기준과의 product equivalence를 주장하지 않는다. 지금 있는 PR diff, MCP config, transcript/log, SARIF evidence로 어디까지 판단할 수 있는지만 좁혀 보여준다.

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 아래 `node dist/index.js ...` commands를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-log`, `agentguard scan-mcp`, `agentguard scan-diff`로 실행할 수 있다.

## AX judging lens → AgentGuard evidence

| AX judging lens | AgentGuard evidence | Exact command or artifact | Judge-safe reading |
|---|---|---|---|
| 현업 문제 적합성 | Commerce VOC agent rollout fixture가 PR diff, MCP config, transcript/log risk를 한 업무 흐름으로 묶는다. | `examples/enterprise-scenarios/commerce-voc-agent/` | "현업 승인자가 rollout 전에 봐야 하는 evidence bundle입니다." |
| agent/tool surface | Agent가 읽고 실행할 수 있는 diff, MCP filesystem/env 권한, transcript/log 행동을 분리해 보여준다. | `scan-diff`, `scan-mcp`, `scan-log` | "앱 코드 SAST가 아니라 agent/tool 운영 surface의 rollout gate입니다." |
| 반복 가능한 evidence | Synthetic fixture와 exact command가 같은 입력에서 같은 verdict와 artifact를 만든다. | `BLOCK`, `REVIEW`, `PASS`, `agentguard.sarif` | "심사장에서도 같은 command로 evidence를 다시 만들 수 있습니다." |
| approval decision | Finding을 업무 승인 조건으로 바꾼다: 차단, 리뷰, 수정 후 통과. | Markdown report, SARIF, reviewer handoff | "security finding을 현업 승인 문장으로 넘깁니다." |

## Fixture-backed evidence commands

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Referenced paths:

- `examples/agent-policy.yaml` — minimal demo policy for repeatable fixture evidence; production teams should adapt policy rules to their own approval boundary.
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `agentguard.sarif` is already ignored in `.gitignore` so local SARIF smoke output does not pollute commits.

## Public reference borrow/avoid map

| Public reference | Borrow | Avoid | AgentGuard evidence routing |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent autonomy, tool misuse, sensitive data exposure, mitigation vocabulary. | Coverage or assurance wording beyond the current fixtures. | `scan-log` explains transcript/log behavior and policy-sensitive agent action evidence. |
| OpenAI new tools for building agents — https://openai.com/index/new-tools-for-building-agents/ | Agent building blocks, tools, tracing/observability vocabulary, and computer-use/file-search/web-search framing. | Runtime control, platform integration, or hosted agent claim. | `scan-log` and `scan-mcp` show what a local rollout reviewer can inspect before agent/tool use. |
| GitHub code scanning docs — https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning | SARIF/code scanning reviewer artifact flow. | Native GitHub product equivalence or security-suite claim. | `scan-diff --sarif --out agentguard.sarif` produces a reviewer-facing SARIF artifact from fixture input. |
| Tencent AI-Infra-Guard — https://github.com/Tencent/AI-Infra-Guard | Broad public signal that AI infrastructure risk spans agents, skills, MCP, and infra. | Same-scope or same-platform wording. | AgentGuard keeps this slice narrow: local agent/tool config, diff, transcript/log evidence. |
| splx-ai agentic-radar — https://github.com/splx-ai/agentic-radar | Public signal that agentic workflow scanning is a recognizable category. | Same-feature or same-market-position wording. | AgentGuard demonstrates Korean-first rollout evidence rather than a full agentic workflow scanner. |

## Machine-contract boundary

Korean-first docs may translate explanation, operating context, and approval wording. Machine-facing terms remain English-compatible:

- CLI commands: `agentguard scan-log`, `agentguard scan-mcp`, `agentguard scan-diff`
- Rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`
- Verdicts and artifacts: `PASS`, `REVIEW`, `BLOCK`, `SARIF`, `JSON`, `agentguard.sarif`
- API and machine fields stay stable for CI/CD, GitHub code scanning, and reviewer automation.

## Non-claim guardrails

- No fake adoption claim: do not imply real customer deployment, buyer logo, or completed rollout.
- No certification claim: do not imply outside audit, badge, formal assurance, or standards sign-off.
- No replacement claim: do not say AgentGuard substitutes for OWASP guidance, OpenAI agent tooling, GitHub code scanning, Tencent AI-Infra-Guard, splx-ai agentic-radar, SAST, or runtime authorization.
- No parity claim: do not describe this docs slice as same-scope with larger AI security platforms or hosted agent-workflow scanners.
- No scanner behavior, severity policy, package release, real data, dashboard, or SaaS change is introduced by this crosswalk.
