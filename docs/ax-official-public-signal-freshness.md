# AX official public-signal freshness

한국어 우선 공식 신호 freshness 카드입니다. 목적은 AX Rollout Guard 제출/시연 전에 **공개적으로 확인된 신호(publicly confirmed)**와 **아직 gated portal에서 확인해야 하는 신호**를 분리하고, 현재 AgentGuard repo가 어떤 exact command로 증거를 다시 만들 수 있는지 30초 안에 보여주는 것입니다.

## Public-confirmed vs gated-unverified

| 구분 | 현재 상태 | AgentGuard 사용 원칙 |
|---|---|---|
| Public-confirmed | AX 인재전쟁 2026 public landing은 `https://hackathon.jocodingax.ai/`에서 확인 가능한 hiring/AX hackathon 맥락, online preliminary task, AI preliminary judge + human review, final company practitioner review, `현업에서 통하는가` 언어를 제공합니다. | 회사 문제가 무엇이든 `company problem → agent/tool surface → evidence command → PASS / REVIEW / BLOCK → human approval` 흐름으로 설명합니다. |
| Portal-gated/unverified | Apply/portal CTA `https://hack.primer.kr/`의 exact problem statement, scoring rubric, submission fields, tool/API permission, IP/privacy terms는 cron에서 로그인 없이 확인하지 않았습니다. | docs나 demo에서 gated rubric을 확인한 것처럼, final-round problem known, or official approval 같은 표현을 쓰지 않습니다. |
| Repo evidence | AgentGuard는 PR diff, MCP config, transcript/log, SARIF artifact를 fixture-backed command로 재현합니다. | public signal을 주장으로 끝내지 않고 rerunnable source-of-record command와 artifact path로 연결합니다. |

## Borrow / Avoid / AgentGuard action

| Public reference signal | Borrow | Avoid | AgentGuard action | Evidence command |
|---|---|---|---|---|
| AX 인재전쟁 public landing — `https://hackathon.jocodingax.ai/` | real company problem, AI preliminary judge + human review, company practitioner review, `현업에서 통하는가` framing | gated portal rubric/submission/API permissions를 확인한 것처럼 말하지 않기 | unknown company problem을 PR diff/MCP/transcript evidence로 빠르게 바꾸는 freshness queue를 둡니다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-official-public-signal-freshness.sarif < examples/risky-pr.diff` |
| OWASP GenAI/LLM Top 10 — `https://genai.owasp.org/llm-top-10/` | prompt/tool misuse, excessive agency, secrets exposure, mitigation language | OWASP 보증, 전면 준수, 전체 플랫폼 커버리지 주장 금지 | risky PR diff와 agent transcript를 `BLOCK` / `REVIEW` / `PASS` evidence로 설명합니다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml --json < examples/approval-required-review.jsonl` |
| MCP Authorization spec — `https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization` | authorization, trusted redirect URI, session/state boundary language | runtime OAuth/state/session 제어를 구현했다고 말하지 않기 | static MCP config preflight로 broad filesystem / writable path / dangerous command risk를 보여줍니다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` |
| GitHub SARIF upload docs — `https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github` | SARIF artifact as reviewer/source-of-record handoff | SARIF upload이 approval 또는 automatic triage를 보장한다고 말하지 않기 | reviewer가 PR에서 다운로드/재실행 가능한 SARIF artifact command를 둡니다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-official-public-signal-freshness.sarif < examples/risky-pr.diff` |

## 30-second judge script

1. "AX final 문제는 아직 gated portal/company context가 정합니다. 그래서 AgentGuard는 특정 업종 답안을 외우는 대신 company problem을 agent/tool risk surface로 변환합니다."
2. "이 PR diff/MCP config/transcript는 synthetic fixture입니다. real customer data가 아니며, repo에서 같은 command로 다시 만들 수 있습니다."
3. "사람용 설명은 한국어로 제공합니다. Machine contract stays unchanged: `PASS` / `REVIEW` / `BLOCK`, JSON, SARIF, rule IDs."
4. "심사자나 실무자는 SARIF/Markdown/JSON evidence를 보고 fix 또는 policy condition을 정한 뒤 같은 command로 rerun합니다."

## Exact fixture-backed command queue

Fresh clone prerequisite when using `dist` commands:

```bash
npm ci
npm run build
mkdir -p .agentguard-demo
```

PR diff / SARIF reviewer artifact:

```bash
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-official-public-signal-freshness.sarif < examples/risky-pr.diff
```

MCP config preflight:

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
```

Approval-required transcript/log JSON:

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml --json < examples/approval-required-review.jsonl
```

Required fixture/source paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/approval-required-review.jsonl`
- `.agentguard-demo/ax-official-public-signal-freshness.sarif` (generated artifact path; ignored demo output, not committed evidence)

## Machine-contract boundary

- Keep CLI commands and flags as English: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `--sarif`, `--out`, `--policy`, `--json`.
- Keep verdict tokens as English: `PASS` / `REVIEW` / `BLOCK`.
- Keep `JSON`, `SARIF`, `API`, `rule IDs`, and `machine fields` stable for automation.
- Human-facing Korean copy may explain business approval, residual risk, fix condition, and rerun trigger. Machine contracts stay unchanged.

## Gated checklist before final submission

- [ ] exact preliminary/final problem statement pasted or screenshotted by the user after login.
- [ ] submission fields, file/URL format, and deadline checked from `https://hack.primer.kr/`.
- [ ] tool/API/model/internet permission and final-room constraints verified.
- [ ] privacy/IP/result-usage terms checked before using any non-synthetic data.
- [ ] any public page count, schedule, or partner list refreshed live before mentioning numbers.

## Honest limits

This card is a source-of-record routing aid, not a hosted policy engine, runtime OAuth/session validator, customer deployment proof, third-party assurance, or same-level claim against public scanners. It shows how to turn public AX/security signals into rerunnable AgentGuard evidence while keeping gated facts explicitly unverified.
