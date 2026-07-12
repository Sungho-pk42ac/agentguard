# AX judging lens trace card

한국어 우선 **judging lens trace card**입니다. AX Rollout Guard를 대상권 후보처럼 설명할 때, 공개 AX page의 `REAL PROBLEM / REAL JUDGE / REAL OUTPUT` 기대와 현재 AgentGuard가 실제로 재현할 수 있는 fixture-backed evidence를 한 장에서 연결합니다. 이 문서는 scanner behavior, CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine fields를 바꾸지 않습니다.

## 사용 목적

심사위원 질문은 보통 “좋은 보안 도구인가?”보다 더 구체적입니다. **회사 문제가 바뀌어도 붙일 수 있는가, 현업자가 이해하는가, 산출물이 재현되는가, 과장하지 않는가**를 묻습니다. 아래 표는 그 judging lens를 현재 저장소의 exact command와 approval 문장으로 낮춥니다.

Fresh clone에서는 repository root에서 먼저 `npm ci && npm run build`를 실행한 뒤 `node dist/index.js ...` commands를 그대로 사용합니다.

## AX judging lens → current AgentGuard evidence

| Judging lens | What the judge needs to see | Exact evidence command or source | Judge-safe reading |
|---|---|---|---|
| 회사 문제 적응력 | unknown company problem을 PR diff / MCP config / transcript-log surface로 빠르게 분해할 수 있어야 한다. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | “최종 회사 문제를 이미 안다는 뜻이 아니라, 회사 업무 변경 diff를 rollout gate evidence로 바꾸는 방식입니다.” |
| 현업성 | 보안 finding이 비즈니스 승인 조건으로 번역되어야 한다. | `docs/ax-company-problem-intake-kit.md` + `docs/ax-approval-owner-escalation-matrix.md` | “현업 승인자는 finding 자체가 아니라 승인/수정/보류 조건을 봅니다.” |
| AX 적합성 | AI agent/tool/workflow 권한과 행동을 배포 전 정적으로 점검한다. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | “runtime MCP 서버 실행이나 OAuth enforcement가 아니라 static pre-rollout permission evidence입니다.” |
| 결과물성 | 발표장에서 같은 입력으로 verdict와 artifact를 다시 만들 수 있어야 한다. | `npm run smoke:ax-demo` | “작동 산출물은 말이 아니라 smoke manifest, JSON/SARIF/Markdown artifact, exact command receipt입니다.” |
| 차별성 | generic SAST/secret scanner가 아니라 PR diff + MCP + transcript/log + SARIF handoff를 agent rollout approval로 묶는다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | “AgentGuard의 차별점은 한국어 enterprise approval route와 agent/tool surface evidence입니다.” |
| 재현성·검증성 | reviewer가 source fixture와 artifact를 다시 확인할 수 있어야 한다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-judging-lens-trace-card.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | “SARIF file creation은 reviewer handoff evidence이며 automatic upload나 approval completion이 아닙니다.” |
| 발표력 | 30초 안에 company problem → risk evidence → approval condition 문장이 나와야 한다. | `docs/ax-30-second-demo-card.md` + `docs/ax-real-judge-demo-map.md` | “첫 문장은 제품 과장이 아니라 현재 fixture-backed command가 무엇을 증명하는지입니다.” |
| 정직성 | gated scoring, 실제 고객, 외부 인증, platform parity를 주장하지 않아야 한다. | `docs/ax-rule-compliance-checklist.md` + `docs/ax-assumption-ledger.md` | “public references는 framing input이고, AgentGuard의 현재 증거는 synthetic fixture 기반입니다.” |

## Exact fixture-backed command set

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-judging-lens-trace-card.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
npm run smoke:ax-demo
```

Referenced paths:

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`
- `scripts/ax-demo-smoke.mjs`
- `docs/ax-company-problem-intake-kit.md`
- `docs/ax-approval-owner-escalation-matrix.md`
- `docs/ax-30-second-demo-card.md`
- `docs/ax-real-judge-demo-map.md`
- `docs/ax-rule-compliance-checklist.md`
- `docs/ax-assumption-ledger.md`

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| AX 인재전쟁 official page — https://hackathon.jocodingax.ai/ | `REAL PROBLEM`, `REAL JUDGE`, `REAL OUTPUT` framing and company-facing result proof. | gated scoring detail, final company problem, hiring result, or private portal certainty. | Map each judging lens to an exact current evidence command or source file. |
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agent/tool misuse, excessive permission, sensitive data exposure, mitigation vocabulary. | OWASP coverage, certification, external validation, or runtime prevention claims. | Route PR/MCP/transcript evidence to approval owner and rerun condition language. |
| Snyk agent-scan — https://github.com/snyk/agent-scan | public AI-agent/MCP/skills scanner category framing. | Snyk product parity, installed-agent inventory scope, market adoption, or stable-output guarantees. | Keep differentiation narrow: Korean enterprise rollout evidence over PR diff, MCP config, transcript/log, and SARIF handoff. |
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | reviewer-readable SARIF artifact handoff and code-scanning vocabulary. | automatic SARIF upload, automatic approval, GitHub code scanning replacement, or platform parity. | Generate SARIF as local evidence and leave upload/triage to the workflow owner. |
| Tencent AI-Infra-Guard — https://github.com/Tencent/AI-Infra-Guard | public signal that AI infrastructure risk spans agents, skills, MCP, and infra. | full red-team platform, broad infra scanner, or same-scope product claim. | Use the reference only to explain why agent/tool rollout risk is a real category. |

## Machine-contract boundaries

- CLI commands remain English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `agentguard doctor`.
- Verdict values remain machine-facing: `PASS`, `REVIEW`, `BLOCK`.
- `rule IDs`, `JSON`, `SARIF`, `API`, `machine fields`, `ruleId`, `artifactLocation.uri`, and `tool.driver.name` are not translated or renamed.
- This card has no scanner behavior change, no exit-code semantics change, no default verdict/severity change, no package publishing change, no hosted auth/dashboard behavior change, no runtime OAuth/sandbox/authorization implementation.

## Non-claim guardrails

- no real customer/adoption claim: all demo paths in this card use synthetic fixtures.
- no external certification: OWASP, GitHub, Snyk, Tencent, and AX references are framing inputs, not endorsements.
- no platform parity claim: AgentGuard is not presented as a replacement for Snyk, Tencent AI-Infra-Guard, GitHub code scanning, OWASP guidance, or a full AI red-team platform.
- no automatic SARIF upload: SARIF creation is local evidence; upload, triage, and approval remain workflow-owned.
- no runtime authorization claim: static MCP/transcript evidence does not prove OAuth, session, consent, redirect URI, or sandbox enforcement.
- no hidden scoring claim: public AX language guides the demo, but gated/private evaluation details remain unknown.
