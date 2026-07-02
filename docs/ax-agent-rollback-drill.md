# AX agent rollback drill

이 문서는 AgentGuard를 AX Rollout Guard로 설명할 때, `BLOCK` finding을 **rollback → mitigate → re-run → approval** 결정으로 바꾸는 한국어 우선 drill card입니다. 목표는 심사위원에게 "스캐너가 위험을 찾았다"에서 멈추지 않고, 회사 rollout gate가 멈춤/수정/재실행/승인 결정을 남기는 모습을 30초 안에 보여주는 것입니다.

범위는 문서와 fixture-backed evidence뿐입니다. Scanner behavior, rule severity, default policy, package name은 바꾸지 않습니다.

## Purpose

커머스 VOC 팀이 agent에게 환불, 쿠폰, CRM note 초안을 맡기기 전 승인권자는 다음 질문에 답해야 합니다.

- agent가 넓은 filesystem root, writable path, credential-like env를 받는가?
- PR diff가 agent-visible source에 secret-like literal이나 담당자 PII를 추가하는가?
- `BLOCK` 또는 `REVIEW` evidence가 나오면 rollout을 어떻게 멈추고, 어떤 수정 후 다시 실행하며, 어떤 조건에서 approval하는가?

이 drill은 AgentGuard finding을 rollout decision evidence로 낮춥니다. Human-facing 설명은 한국어 우선이고, CLI commands, rule IDs, JSON/SARIF/API/machine fields는 English-compatible contract로 유지합니다.

## 30-second drill

1. Risky MCP config를 실행한다.
   `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json`
2. `BLOCK` evidence를 rollback decision으로 읽는다: broad root, writable path, credential-like env passthrough가 있으므로 agent rollout을 멈춘다.
3. Fixed MCP config를 실행한다.
   `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`
4. `PASS` evidence를 approval 조건으로 읽는다: fixture 전용 read-only path와 credential passthrough 제거가 확인되면 제한 rollout을 승인한다.
5. PR diff도 같은 방식으로 `REVIEW/BLOCK → 수정 diff → PASS`를 보여준다.

30초 설명 문장:

> "AgentGuard는 risky agent 설정을 그냥 빨간불로 끝내지 않습니다. `BLOCK`이면 rollout을 rollback하고, broad/writable/credential 조건을 제거한 뒤 같은 command로 re-run합니다. fixed fixture가 `PASS`가 되면 approval evidence가 Markdown/SARIF로 남습니다."

## Rollback decision table

| AgentGuard evidence | Rollback decision | Mitigation | Re-run command | Approval condition |
|---|---|---|---|---|
| `BLOCK` with `mcp.broad_filesystem_access` or `mcp.filesystem_writable_path` | Rollback rollout: agent MCP config를 배포하지 않는다. | filesystem scope를 업무 fixture path로 좁히고 read-only로 바꾼다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS` output이면 limited approval; command/rule IDs는 그대로 둔다. |
| `BLOCK` with credential-like env passthrough | Rollback rollout: credential이 agent runtime으로 넘어가는 설정을 제거한다. | secret manager 또는 human approval workflow가 credential을 소유하게 둔다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS` output이고 env credential passthrough finding이 없으면 approval. |
| `REVIEW` or `BLOCK` with `generic-secret-assignment` in PR diff | Rollback merge: risky diff를 병합하지 않는다. | source에서 secret-like literal과 담당자 PII를 제거한다. | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `PASS` output이면 reviewer approval evidence로 남긴다. |
| No finding after mitigation | Continue rollout gate. | 승인 문장, evidence command, Markdown/SARIF artifact 위치를 기록한다. | Same surface: `agentguard scan-mcp` or `agentguard scan-diff` | `PASS`와 reviewer note가 함께 있어야 approval. |

## Fixture-backed evidence commands

아래 command는 모두 저장소 안의 합성 fixture만 사용합니다. 발표 전 `npm run build` 후 built CLI surface로 실행합니다.

```bash
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff
```

Global install 설명에서는 같은 surface를 아래처럼 읽습니다.

```bash
agentguard scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
agentguard scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
agentguard scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff
agentguard scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff
```

Evidence handoff:

- Markdown report: reviewer가 `BLOCK`, `REVIEW`, `PASS` verdict와 Korean explanation을 바로 읽는 surface입니다.
- SARIF: GitHub code scanning이 `rules`, `results`, `locations` 같은 machine fields로 finding을 routing하는 artifact입니다.
- JSON/API: automation이 같은 verdict와 rule IDs를 읽는 machine-facing path입니다.

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [AX hackathon](https://hackathon.jocodingax.ai/) | Borrow: company-provided real problem, 30-second evidence, 현업 통과 여부 중심 압축을 빌린다. | Avoid: 비공개 심사표, 실제 회사 데이터, 한 가지 고정 시나리오만 맞춘 듯한 표현을 피한다. | AgentGuard action: reusable rollback drill card로 `BLOCK → mitigate → re-run → PASS approval`을 설명한다. |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agent autonomy, tool risk, mitigation/control vocabulary를 빌린다. | Avoid: OWASP 보증, 모든 위험 대응, 공식 검토 완료처럼 말하지 않는다. | AgentGuard action: `BLOCK` finding을 stop-control-mitigate wording으로 바꾼다. |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | Borrow: agent, MCP, AI-infra scanner category framing을 빌린다. | Avoid: broad red-team platform parity나 vendor-scale 기능처럼 말하지 않는다. | AgentGuard action: PR diff, MCP config, transcript/log rollout evidence gate라는 좁은 scope를 유지한다. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | Borrow: workflow/tool/MCP visibility framing을 빌린다. | Avoid: dashboard, visualizer, full workflow observability parity를 주장하지 않는다. | AgentGuard action: surface → evidence → decision 순서의 rollback drill로 낮춘다. |
| [GitHub SARIF support](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Borrow: machine-readable artifact routing via rules/results/locations를 빌린다. | Avoid: GitHub product substitute나 GitHub 공식 도구처럼 말하지 않는다. | AgentGuard action: Markdown은 human reviewer용, SARIF는 machine routing용 evidence handoff로 설명한다. |

## Machine-contract boundaries

한국어 human docs를 추가해도 아래 contract는 바꾸지 않습니다.

- CLI commands: `agentguard scan-mcp`, `agentguard scan-diff`
- Node commands: `node dist/index.js scan-mcp`, `node dist/index.js scan-diff`
- Verdict vocabulary: `PASS`, `REVIEW`, `BLOCK`
- Rule IDs: `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment`
- JSON fields, SARIF fields, API fields, machine fields
- Product name: `AgentGuard`

## Non-claim guardrails

- 실제 고객 자료, private transcript, real secrets, 운영 도입 실적을 주장하지 않습니다.
- 외부 기관 보증, 표준 적합성, 공식 검토 완료를 주장하지 않습니다.
- 운영형 웹 제품, 로그인, 과금, 고객 자료 업로드 기능은 이 drill 범위가 아닙니다.
- 모든 agent 보안 영역을 다루는 플랫폼이나 vendor 대체재를 주장하지 않습니다.
- 이 문서는 scanner verdict logic, severity/default policy, rule IDs, package publishing을 바꾸지 않습니다.
