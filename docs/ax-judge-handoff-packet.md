# AX judge handoff packet

AX 인재전쟁 심사자에게 AgentGuard를 AX Rollout Guard로 설명할 때 쓰는 한국어 우선 packet입니다. 이 문서는 자동 생성 산출물이 아니라 제출/발표자가 수동으로 여는 정적 handoff guide이며, 목적은 공개 reference를 근거 언어로만 빌리고 현재 저장소 fixture와 기존 CLI surface로 재현 가능한 evidence handoff를 짧게 보여주는 것입니다.

## 1. 심사자용 30초 packet order

1. 문제: "한국 팀이 커머스 VOC 에이전트에 환불, 쿠폰, CRM 메모 초안을 맡기려 하지만 PR diff와 MCP 권한이 위험하면 배포를 멈춰야 합니다."
2. Surface: AgentGuard의 현재 judge-visible surface는 `scan-mcp`, `scan-diff`, Markdown report, SARIF artifact입니다.
3. Evidence: risky fixture는 `BLOCK` 또는 `REVIEW`, fixed fixture는 `PASS`로 연결합니다.
4. Action: 심사자는 같은 fixture-backed command를 다시 실행해 수정 전후 verdict를 확인합니다.
5. Guardrail: 이 packet은 합성 fixture 기반 handoff이며 제품 범위, 외부 보증, 고객 사용 이력을 넓혀 말하지 않습니다.

## 2. Fixture-backed commands and expected verdicts

발표 전 `npm run build`를 실행한 뒤 아래 명령을 그대로 사용합니다. 모든 path는 현재 저장소에 존재하는 fixture입니다.

| Evidence | exact command | fixture path | expected verdict | judge action |
|---|---|---|---|---|
| risky MCP config | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `BLOCK` | broad filesystem root, writable path, credential passthrough가 rollout blocker인지 확인합니다. |
| fixed MCP config | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS` | 제한된 read-only fixture root로 수정된 뒤 같은 surface가 통과하는지 확인합니다. |
| risky PR diff | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `REVIEW` | secret-like material이나 risky shell material이 PR reviewer action으로 남는지 확인합니다. |
| fixed PR diff | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `PASS` | 위험 입력 제거 후 같은 command에서 출시 후보 evidence가 되는지 확인합니다. |

## 3. Existing file path map

| Purpose | exact existing file path | handoff use |
|---|---|---|
| Korean-first product entry | `README.md` | docs list와 English-compatible machine contract boundary를 확인합니다. |
| one-page judge evidence | `docs/ax-judge-evidence-index.md` | 30초 증거 카드와 before/after fixture 흐름을 보조합니다. |
| CI reviewer artifact story | `docs/ax-ci-reviewer-handoff.md` | PR comment, Markdown report, SARIF handoff framing을 보조합니다. |
| public reference comparison | `docs/ax-rollout-references.md` | 공개 reference의 borrow/avoid/action 원칙을 보조합니다. |
| sample SARIF payload | `examples/agentguard.sarif` | SARIF `ruleId`, `result`, `location`, `fingerprint` 같은 machine-readable artifact handoff를 설명할 때만 사용합니다. |

## 4. Public reference borrow / avoid / action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Agentic AI risk를 threat-to-control mapping으로 설명하는 방식 | endorsement나 coverage 보증처럼 말하지 않기 | broad MCP 권한, tool misuse, secret exposure를 `BLOCK`/`REVIEW` finding과 수정 조건으로 연결합니다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF `ruleId`, `result`, `location`, `fingerprint` 중심의 machine-readable artifact handoff | GitHub 보안 도구와 같은 역할을 한다고 말하지 않기 | AgentGuard SARIF와 Markdown report를 같은 finding의 reviewer evidence로 설명합니다. |
| https://github.com/snyk/agent-scan | agent/MCP security scanning category를 심사자가 바로 이해하는 언어 | vendor-scale coverage나 market proof처럼 말하지 않기 | 현재 범위를 `scan-mcp`와 `scan-diff` fixture evidence로 좁혀 말합니다. |
| https://github.com/Tencent/AI-Infra-Guard | AI infra guardrail category clarity | 전체 AI infra suite처럼 말하지 않기 | rollout gate 문서와 fixture-backed commands만 보여줍니다. |
| https://github.com/splx-ai/agentic-radar | agentic workflow attack-surface category clarity | runtime monitoring 또는 attack simulation을 제공한다고 말하지 않기 | deterministic scanner evidence와 approval condition으로 한정합니다. |

## 5. English-compatible machine contracts

한국어 설명은 presentation layer입니다. 아래 machine-facing 계약은 영어 그대로 유지합니다.

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`
- Rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`
- Verdicts: `BLOCK`, `REVIEW`, `PASS`
- SARIF fields and concepts: `SARIF`, `ruleId`, `result`, `location`, `fingerprint`
- Artifact paths: `agentguard.sarif`, Markdown report, PR comment, CI artifact

## 6. Non-claim guardrails

- No fake adoption: this packet does not present external rollout history, customer logos, or production usage proof.
- No certification claim: public references are cited for vocabulary and artifact framing only.
- No parity claim: AgentGuard is not presented as an end-to-end security suite, vendor-equivalent suite, runtime monitor, or attack simulator.
- No product-surface expansion: this packet does not change CLI behavior, default severity, policies, package metadata, or JSON/SARIF machine contracts.
