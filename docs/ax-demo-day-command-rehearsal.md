# AX demo-day command rehearsal

이 카드는 AX Rollout Guard demo day 직전에 운영자가 같은 명령, 같은 fixture, 같은 artifact 문구로 리허설하기 위한 **한국어 우선** command card입니다. 목표는 **회사 문제 → AgentGuard command → expected verdict → reviewer artifact → 승인 질문**을 3분 안에 반복하는 것입니다.

범위는 문서와 fixture-backed evidence뿐입니다. Scanner behavior, product naming, package publishing, SaaS/auth/dashboard, real customer data, customer adoption, certification, platform parity는 이 카드에서 만들거나 주장하지 않습니다.

## 목적

커머스 VOC agent가 환불, 쿠폰, CRM note 초안을 만들기 전에 운영자는 아래 네 가지 surface를 같은 순서로 리허설합니다.

- PR diff: agent-visible 변경에 secret-like literal, denied command, PII-shaped text가 들어오는지 본다.
- MCP config: agent tool이 filesystem root, writable path, credential-like env를 과하게 받는지 본다.
- transcript/log: policy가 필요한 행동을 사람 승인 조건으로 남기는지 본다.
- SARIF/smoke artifact: reviewer가 Markdown, JSON, SARIF, manifest를 같은 run에서 따라갈 수 있는지 본다.

한국어 설명은 presentation layer입니다. `agentguard`, CLI command names, verdict values, rule IDs, JSON/SARIF fields, machine fields는 English-compatible machine contract로 그대로 둡니다.

## 3-minute command rehearsal

1. `npm run build` 후 저장소 루트에서 실행한다.
2. PR diff command를 먼저 실행하고 현재 fixture의 `REVIEW`를 "merge 전 reviewer 확인" 문장으로 읽는다.
3. MCP command를 실행하고 현재 fixture의 `REVIEW`를 "agent rollout 연결 전 권한 축소 검토" 문장으로 읽는다.
4. transcript/log command를 실행하고 `REVIEW`를 "정책 승인자 확인 필요" 문장으로 읽는다.
5. SARIF command를 실행해 `.agentguard-demo/ax-demo-day-command-rehearsal.sarif` artifact를 만든다.
6. `npm run smoke:ax-demo`로 전체 smoke manifest와 fixture-backed artifacts가 재생되는지 확인한다.

30초 발표 문장:

> "AgentGuard는 커머스 VOC agent를 바로 막거나 허용한다고 말하지 않습니다. PR diff, MCP config, transcript/log를 같은 built CLI로 재생해 `BLOCK` 또는 `REVIEW` evidence를 만들고, reviewer가 Markdown, JSON, SARIF artifact를 보고 승인 조건을 남기게 합니다."

## Fixture-backed commands

아래 command는 모두 저장소 안의 synthetic fixture만 사용합니다. 발표 전 `npm run build`를 실행한 뒤 built CLI surface인 `node dist/index.js`로 실행합니다.

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-demo-day-command-rehearsal.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
npm run smoke:ax-demo
```

Fixture paths:

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`

## Expected verdicts and artifacts

| Rehearsal step | Expected verdict / artifact language | Approval question |
|---|---|---|
| `scan-diff` risky PR diff | Expected verdict: `REVIEW` for the current fixture; it contains `generic-secret-assignment` and denied command evidence, so treat it as merge-hold evidence until reviewer cleanup. | "이 PR diff는 secret-like material 또는 위험 command evidence가 있으므로 reviewer 확인 전 merge를 승인하지 않습니다." |
| `scan-mcp` risky MCP config | Expected verdict: `REVIEW` for the current fixture. Filesystem and credential-like tool exposure는 rollout hold evidence로 읽는다. | "agent MCP 권한을 업무 fixture path와 read-only 조건으로 줄이기 전 운영 연결을 승인하지 않습니다." |
| `scan-log --policy` transcript/log | Expected verdict: `REVIEW`. Expected rule IDs include `denied-command`; 사람 승인 또는 policy exception 확인이 필요하다. | "정책 위반 가능 행동은 담당자 review가 끝나기 전 자동 실행으로 넘기지 않습니다." |
| `scan-diff --sarif --out ...` | Expected artifact: `.agentguard-demo/ax-demo-day-command-rehearsal.sarif`; SARIF 2.1.0 `rules`, `results`, `locations` 같은 machine fields를 reviewer handoff로 둔다. | "GitHub code scanning upload나 archive는 reviewer-owned follow-up이며, 이 카드는 SARIF file input만 만든다." |
| `npm run smoke:ax-demo` | Expected artifact language: smoke manifest, JSON evidence, SARIF artifact, accepted non-zero risky fixture exits. | "manifest가 같은 run의 PR diff, MCP, transcript/log, SARIF artifacts를 가리킬 때만 demo evidence로 넘깁니다." |

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agent autonomy, tool misuse, excessive agency, mitigation/control vocabulary를 빌릴 점으로 둔다. | Avoid: OWASP endorsement, certification, complete threat coverage claim은 피할 점이다. | AgentGuard action: PR/MCP/log finding을 `BLOCK` 또는 `REVIEW` rollout gate 문장으로 낮춘다. |
| [Snyk `agent-scan`](https://github.com/snyk/agent-scan) | Borrow: AI agent, MCP server, agent skill scanner category framing을 빌릴 점으로 둔다. | Avoid: Snyk ecosystem parity, commercial breadth, 대체재 주장은 피할 점이다. | AgentGuard action: Korean-first PR diff, MCP config, transcript/log evidence rehearsal로 범위를 고정한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF file handoff and code scanning upload vocabulary를 빌릴 점으로 둔다. | Avoid: automatic upload ownership, GitHub-native integration scope, GitHub product substitute claim은 피할 점이다. | AgentGuard action: `.agentguard-demo/ax-demo-day-command-rehearsal.sarif`를 reviewer-owned upload or archive input으로 남긴다. |
| [Stripe CLI](https://github.com/stripe/stripe-cli) | Borrow: demo-day에 사람이 같은 command를 반복 실행하고 output을 확인하는 CLI rehearsal discipline을 빌릴 점으로 둔다. | Avoid: payment integration, webhook runtime, Stripe ecosystem feature parity claim은 피할 점이다. | AgentGuard action: fixture-backed command order와 artifact check만 리허설한다. |

## Machine-contract boundaries

이 카드는 한국어 발표 문구를 추가할 뿐 아래 machine-facing contract를 바꾸지 않습니다.

- Product and CLI surface: `agentguard`, `node dist/index.js`, `scan-diff`, `scan-mcp`, `scan-log`
- Verdict vocabulary: `PASS`, `REVIEW`, `BLOCK`
- Rule IDs and examples: `rule IDs`, `generic-secret-assignment`, `denied-command`
- Output contracts: `JSON`, `SARIF`, `SARIF 2.1.0`, `machine fields`
- Artifact paths: `.agentguard-demo/ax-demo-day-command-rehearsal.sarif`, `.agentguard-demo/ax-evidence-smoke/manifest.json`
- Package scripts: `npm run smoke:ax-demo`

## Non-claim guardrails

- 이 command rehearsal은 synthetic fixture와 public reference framing만 사용합니다.
- 실제 운영 채택, reference account, customer deployment를 주장하지 않습니다.
- 외부 기관 보증, 표준 적합성, 공식 검토 완료를 주장하지 않습니다.
- Snyk, GitHub, Stripe, OWASP의 제품이나 ecosystem을 대체한다고 말하지 않습니다.
- 운영형 웹 제품, 로그인, 과금, 고객 자료 업로드 기능은 이 카드 범위가 아닙니다.
- 모든 agent 보안 영역을 다루는 broad platform이나 전면 보안 범위를 주장하지 않습니다.
- 이 카드는 scanner behavior, rule severity, default policy, package publishing, product name을 바꾸지 않습니다.
