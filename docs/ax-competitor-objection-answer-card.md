# AX competitor objection answer card

이 카드는 AX Rollout Guard 대상권 심사에서 나올 수 있는 경쟁/레퍼런스 objection에 답하기 위한 한국어 우선 answer card입니다. 목적은 AgentGuard를 더 크게 보이게 만드는 것이 아니라, 현재 repo evidence로 바로 검증 가능한 rollout gate 차별점을 30초 안에 말하는 것입니다.

## Claim boundary

- AgentGuard는 공개 위험 언어와 scanner category를 참고하지만, 현재 범위는 PR diff, MCP config, transcript/log evidence를 배포 전 승인 게이트로 묶는 것입니다.
- fake adoption, certification, broad-platform overclaim은 사용하지 않습니다.
- 모든 답변은 아래 fixture-backed command, 기존 docs, public reference의 borrow/avoid 경계에만 근거합니다.

## Fixture-backed evidence commands

| Surface | Exact command | Existing fixture | Expected use |
|---|---|---|---|
| risky MCP rollout | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | broad filesystem, writable path, credential passthrough를 `BLOCK` 또는 강한 `REVIEW` 근거로 설명 |
| fixed MCP rollout | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | fixture 전용 read-only root로 줄인 뒤 `PASS` 후보 evidence 설명 |
| risky PR diff | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | secret-like material과 risky shell material을 rollout 전 `REVIEW` 근거로 설명 |
| fixed PR diff | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | 같은 surface를 재검토해 `PASS` evidence로 남김 |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` plus `examples/agent-policy.yaml` | 승인 없는 export, 민감 경로 접근, 삭제성 command를 사람 승인 조건으로 설명 |

Existing docs: `docs/ax-judge-evidence-index.md`, `docs/ax-judge-evidence-ladder.md`, `docs/ax-competitive-comparison.md`, `docs/github-action.md`.

## Public references and safe use

| Reference | Borrow | Avoid |
|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, secrets, approval boundary vocabulary | 외부 보증이나 완전 대응처럼 들리는 claim |
| https://genai.owasp.org/llm-top-10/ | shared LLM risk language that judges may already know | checklist completion이나 standard replacement claim |
| https://github.com/Tencent/AI-Infra-Guard | broad AI infra and agent threat inventory framing | full-stack red-team suite positioning |
| https://github.com/splx-ai/agentic-radar | agentic workflow and MCP scanner category language | equivalent coverage, runtime monitoring, market proof |
| https://github.com/affaan-m/agentshield | AI agent security scanner framing, MCP/tool permission risk vocabulary, GitHub Action/App packaging vocabulary | fake adoption, certification, vendor-scale claim, product-scope parity |

## Objection 1: "Tencent AI-Infra-Guard가 더 넓은데 AgentGuard가 왜 필요한가?"

30초 답변:
AgentGuard는 더 넓은 AI infra suite라고 말하지 않습니다. Tencent AI-Infra-Guard에서 빌릴 점은 agent, MCP, infra threat inventory를 심사자가 이해하는 언어로 정리하는 방식입니다. 피할 점은 AgentGuard가 같은 red-team suite나 broad-platform coverage를 제공한다고 말하는 것입니다. 여기서는 `scan-mcp`가 `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json`의 넓은 filesystem/write/credential passthrough를 멈추고, `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`로 줄였을 때 같은 command에서 `PASS` 후보 evidence를 남기는 rollout gate만 보여줍니다.

Evidence to open:
- `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json`
- `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json`
- `docs/ax-judge-evidence-index.md`

## Objection 2: "agentic-radar나 Agentshield 계열 scanner가 있으면 충분하지 않나?"

30초 답변:
AgentGuard는 agentic-radar와 `https://github.com/affaan-m/agentshield`에서 agent workflow, AI agent security scanner, MCP/tool permission, GitHub Action/App comparison vocabulary를 빌립니다. 피할 점은 equivalent coverage, fake adoption, vendor-scale, runtime monitoring, product-scope parity를 주장하는 것입니다. 차별점은 한국어 우선 심사/운영 문서와 exact command evidence입니다. 같은 commerce VOC rollout에서 `scan-diff`, `scan-mcp`, `scan-log`가 PR diff, MCP config, transcript/log를 각각 `REVIEW`, `BLOCK`, `PASS` 논의로 연결하고, 그 결과를 `docs/ax-judge-evidence-ladder.md`에서 30초 답변으로 다시 읽을 수 있습니다.

Evidence to open:
- `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff`
- `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff`
- `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `docs/ax-judge-evidence-ladder.md`

## Objection 3: "OWASP LLM Top 10과 Agentic AI threat 문서만 읽으면 되는 것 아닌가?"

30초 답변:
OWASP 문서에서 빌릴 점은 tool misuse, excessive agency, secret exposure 같은 공통 위험 언어입니다. 피할 점은 OWASP가 AgentGuard 범위나 결과를 보증한다고 말하는 것입니다. AgentGuard의 역할은 framework를 대체하는 것이 아니라, 그 위험 언어를 실제 repo fixture와 CI-friendly evidence로 낮추는 것입니다. 심사자는 `scan-diff` 결과와 `docs/github-action.md`의 SARIF 흐름을 같이 보면 "위험 언어"가 "PR reviewer가 보는 artifact"로 바뀌는 지점을 확인할 수 있습니다.

Evidence to open:
- `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff`
- `docs/github-action.md`
- `docs/ax-competitive-comparison.md`

## Safe closing script

"AgentGuard는 공개 reference의 위험 언어와 scanner category를 빌리지만, 현재 claim은 좁게 둡니다. PR diff, MCP config, transcript/log를 기존 fixture-backed command로 검사하고, `BLOCK → 수정 조건 → PASS` evidence를 한국어 우선 rollout gate로 남기는 것이 대상권 차별점입니다."
