# AX demo operator checklist

이 문서는 AgentGuard/AX Rollout Guard 대상권 라이브 데모를 3분 안에 반복할 수 있게 만든 한국어 우선 operator checklist입니다. 범위는 저장소 안의 합성 fixture와 현재 CLI evidence뿐입니다. Scanner behavior, CLI commands, rule IDs, JSON/SARIF machine contracts는 이 문서로 바꾸지 않습니다.

## 3-minute operator flow

발표 전 저장소 루트에서 `npm run build`를 한 번 실행합니다. 아래 명령은 Bash 또는 Zsh 호환 셸 기준이며, judge/operator가 같은 입력에서 `BLOCK` / `REVIEW` / `PASS` 흐름을 바로 볼 수 있도록 고정합니다.

| Time | Operator action | Exact command | What to say |
| --- | --- | --- | --- |
| 0:00-0:30 | risky MCP before 상태를 보여준다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | "커머스 VOC 에이전트 MCP 설정이 broad filesystem/root, writable path, credential-like env를 열면 rollout gate는 `BLOCK`입니다." |
| 0:30-0:55 | fixed MCP after 상태를 보여준다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | "같은 업무 fixture를 좁힌 뒤에는 `PASS`로 내려가며, 이것은 현재 입력에 대한 CLI evidence입니다." |
| 0:55-1:25 | risky PR diff를 보여준다. | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | "agent가 만든 PR diff에 token-like literal, PII-like value, risky shell material이 들어가면 사람이 검토해야 할 rollout evidence가 됩니다." |
| 1:25-1:45 | fixed PR diff를 보여준다. | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | "수정 fixture는 risky material을 제거하고 같은 surface에서 `PASS`를 확인합니다." |
| 1:45-2:25 | transcript/log approval boundary를 보여준다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | "에이전트 transcript는 tool misuse, excessive agency, approval-required action을 `REVIEW` 또는 정책 finding으로 바꿉니다." |
| 2:25-3:00 | reviewer handoff artifact를 생성한다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | "Markdown은 사람이 읽고, SARIF는 같은 finding을 reviewer-visible artifact로 넘깁니다." |

Referenced fixture and context paths:

- `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json`
- `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`
- `examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff`
- `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`
- `docs/ax-competitor-objection-answer-card.md`
- `docs/ax-judge-evidence-index.md`
- `docs/ax-sarif-reviewer-loop-card.md`

## Expected exits and artifacts

| Surface | Expected verdict | Expected exit/artifact | Operator check |
| --- | --- | --- | --- |
| risky MCP fixture | `BLOCK` | critical finding produces a non-zero exit | Keep the English CLI command and rule IDs unchanged while explaining the Korean approval stop. |
| fixed MCP fixture | `PASS` | exit `0` | Treat `PASS` as "this fixture has no blocking finding", not as production approval. |
| risky PR diff fixture | `REVIEW` or `BLOCK` depending on severity | critical finding produces a non-zero exit; non-critical review output exits `0` | Use the finding text as approval evidence, not as a scanner behavior change. |
| fixed PR diff fixture | `PASS` | exit `0` | Confirm the same fixture family no longer carries risky material. |
| transcript/log fixture | `REVIEW` or policy finding | no critical finding exits `0`; critical finding produces a non-zero exit | Explain the approval boundary and residual risk in Korean. |
| SARIF handoff | SARIF 2.1.0 file | `.agentguard-demo/agentguard.sarif` is created; critical finding can still produce a non-zero exit | Hand the artifact to reviewer/CI without claiming GitHub upload or risk closure. |

Cleanup after the rehearsal:

```bash
rm -rf .agentguard-demo
```

## Fallback wording

- "AgentGuard는 runtime 권한을 대신 집행한다고 말하지 않습니다. 현재 데모는 MCP config, PR diff, transcript/log를 rollout approval evidence로 바꾸는 흐름입니다."
- "이 `PASS`는 운영 채택이나 외부 보증이 아니라, 현재 합성 fixture에서 blocking finding이 없다는 CLI 결과입니다."
- "SARIF는 reviewer-visible artifact입니다. GitHub code scanning 업로드나 triage 완료를 대신한다고 말하지 않습니다."
- "AX 인재전쟁 맥락에서는 real-output judging에 맞춰 실제 command, verdict, artifact를 보여주되 gated portal 내용이나 숨은 심사 기준을 확인했다고 말하지 않습니다."
- "Public references는 Borrow/Avoid framing을 위한 근거입니다. 외부 프로젝트와 동등, 대체, 인증 관계를 주장하지 않습니다."

## Public references

| Reference | Borrow | Avoid | Checklist framing |
| --- | --- | --- | --- |
| https://hackathon.jocodingax.ai/ | AX 인재전쟁, real-output, AI talent judging framing | gated portal detail이나 비공개 심사 기준을 확인했다고 말하기 | 3-minute flow를 operator-visible commands, verdicts, artifacts 중심으로 둔다. |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, approval-boundary vocabulary | OWASP 보증, 전체 위협 대응, 표준 준수 완료처럼 말하기 | MCP/log finding을 rollout stop, review, fallback wording으로 낮춘다. |
| https://docs.github.com/en/code-security/code-scanning | reviewer-visible artifact, SARIF handoff, security review routing | SARIF upload가 risk closure를 보장한다고 말하기 | `--sarif --out` file을 reviewer handoff evidence로만 설명한다. |
| https://github.com/snyk/agent-scan | agent scanner, MCP, security category language | feature parity, vendor-scale coverage, adoption claim | AgentGuard는 Korean-first fixture-backed PR diff/MCP/transcript checklist로 좁혀 말한다. |

## Non-claims

- 실제 조직 데이터, 운영 실적, customer reference를 주장하지 않습니다.
- 외부 reference의 승인, 보증, certified status를 주장하지 않습니다.
- 기존 보안 제품군이나 broad agent-security platform을 대체한다고 말하지 않습니다.
- dashboard, hosted SaaS, auth, billing, database, customer upload는 이 checklist 범위가 아닙니다.
