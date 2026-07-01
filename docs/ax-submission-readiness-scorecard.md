# AX submission readiness scorecard

이 문서는 AX Rollout Guard를 예선 심사자가 빠르게 판단하도록 만든 한국어 우선 readiness scorecard입니다. 목적은 현재 AgentGuard repo에 이미 있는 evidence, exact command or file, status, remaining gap, judge-safe phrasing을 한 장에서 분리해 보여주는 것입니다.

범위는 deterministic rollout gate입니다. public signals는 설명 방식의 근거로만 쓰고, unknown/gated facts는 모른다고 표시합니다.

## 심사 readiness scorecard

| Dimension | 현재 repo evidence | exact command or file | status | remaining gap | judge-safe phrasing |
|---|---|---|---|---|---|
| 현업 문제 적합성 | 커머스 VOC 에이전트 fixture가 PR diff, MCP config, transcript/log를 한 업무 흐름으로 묶는다. | `docs/ax-prelim-submission-pack.md`, `examples/enterprise-scenarios/commerce-voc-agent/README.md` | Evidence-ready | 실제 회사 문제와 데이터는 아직 unknown/gated facts이다. | "현재 제출은 synthetic commerce VOC fixture로 현업 배포 승인 판단 흐름을 보여줍니다." |
| 스캔 surface 명확성 | AgentGuard가 현재 보여주는 surface는 PR diff, MCP config, agent transcript/log, SARIF output이다. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Evidence-ready | dashboard, SaaS auth, runtime monitoring은 범위 밖이다. | "AgentGuard는 현재 구현된 CLI surface에서 deterministic rollout gate evidence를 만듭니다." |
| 반복 가능한 증거 | 위험 fixture와 before/after fixture가 같은 command로 재실행 가능하다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | Evidence-ready | 심사 환경에서 npm install/build 시간은 별도 운영 준비가 필요하다. | "저장소 fixture만으로 같은 BLOCK/REVIEW/PASS 판단 흐름을 재현할 수 있습니다." |
| 판정/승인 조건 | `BLOCK`, `REVIEW`, `PASS`와 수정 조건을 문서와 fixture가 연결한다. | `docs/ax-judge-evidence-index.md`, `docs/ax-before-after-rollout-demo.md` | Evidence-ready | 회사별 승인 책임자, SLA, 예외 승인 절차는 현장 입력이 필요하다. | "판정은 운영 배포 결정을 돕는 gate이며, 최종 승인은 팀 정책에 따릅니다." |
| 심사자 안전 문구 | non-claims 문서들이 real adoption, certification, platform coverage 과장을 금지한다. | `docs/ax-rule-compliance-checklist.md`, `docs/ax-rollout-references.md` | Evidence-ready | 최종 대회 규칙이나 비공개 portal scoring은 확인하지 않는다. | "공개 reference는 framing 근거이며, 외부 인증이나 vendor-scale coverage를 주장하지 않습니다." |
| 산출물 전달력 | Markdown report, SARIF, README docs list가 reviewer artifact 경로를 제공한다. | `docs/github-action.md`, `README.md`, `README.en.md` | Evidence-ready | hosted demo URL이나 실시간 dashboard는 이번 slice 범위 밖이다. | "심사자는 CLI output, Markdown/SARIF artifact, docs 링크로 현재 범위를 확인할 수 있습니다." |

## Fixture-backed smoke commands

저장소 루트에서 실행합니다. 아래 명령은 현재 repo에 존재하는 fixture path만 사용하며 CLI behavior를 바꾸지 않습니다.

```bash
npm run build
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
```

Fixture paths used by the commands:

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`
- `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json`
- `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`

## Public reference guardrails

| Reference | Borrow | Avoid | Non-claim |
|---|---|---|---|
| AX 인재전쟁 landing page: https://hackathon.jocodingax.ai/ | company-facing, result-first demo framing | gated portal detail이나 scoring rule을 아는 것처럼 말하지 않는다. | AgentGuard가 공식 AX 평가 기준을 충족한다고 말하지 않는다. |
| Snyk agent-scan: https://github.com/snyk/agent-scan | agent/MCP/skills scan-surface framing | vendor-scale scanner coverage를 주장하지 않는다. | Snyk와 같은 범위, 채택, 보증을 주장하지 않는다. |
| Tencent AI-Infra-Guard: https://github.com/Tencent/AI-Infra-Guard | AI infra/red-team risk-inventory language | full AI infra platform처럼 설명하지 않는다. | Tencent 프로젝트와 동등한 platform scope를 주장하지 않는다. |
| splx-ai agentic-radar: https://github.com/splx-ai/agentic-radar | agentic workflow report/evidence language | attack simulation이나 full workflow coverage를 제공한다고 말하지 않는다. | runtime attack simulation 제품이라고 말하지 않는다. |

## Non-claims

- 실제 회사 데이터, real customer data, 운영 지표, 도입 실적은 이 scorecard에 포함하지 않는다.
- public signals는 설명 언어와 reviewer artifact framing을 빌리는 근거이며, 인증이나 제품 동등성을 의미하지 않는다.
- unknown/gated facts는 그대로 unknown/gated facts로 남긴다. 최종 회사 문제, 비공개 portal, 심사 scoring details를 안다고 쓰지 않는다.
- 이 문서는 CLI output, severity, blocking policy, package metadata, product name을 바꾸지 않는다.
- AgentGuard의 현재 safe claim은 "repeatable CLI/Markdown/SARIF evidence를 남기는 deterministic rollout gate"이다.
