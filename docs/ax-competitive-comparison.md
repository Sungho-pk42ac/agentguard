# AX competitive comparison

AgentGuard를 AX Rollout Guard 예선/대상권 준비물로 설명할 때 심사자가 30초 안에 차별점을 이해하도록 만든 한국어 우선 one-page matrix입니다. 결론은 단순합니다: AgentGuard는 공개 보안 프레임워크와 agent security scanner를 대체하는 full platform이 아니라, 한국 팀의 PR+MCP+transcript 증거를 CI/리포트로 묶는 deterministic rollout gate입니다.

## 30초 포지셔닝

AgentGuard는 OWASP와 MCP의 위험 언어를 빌리고, Snyk agent-scan, Tencent AI-Infra-Guard, splx-ai agentic-radar 같은 공개 도구의 surface 인식을 참고합니다. 대신 차별점은 한국어 우선 운영 문서, `agentguard scan-diff` + `scan-mcp` + `scan-log`, SARIF/Markdown evidence, 그리고 `BLOCK → 수정 조건 → PASS` 승인 흐름입니다.

## 경쟁/레퍼런스 matrix

| Reference | Borrow | Avoid | AgentGuard differentiator |
|---|---|---|---|
| OWASP LLM / Agentic AI threats | tool misuse, excessive agency, secret exposure 같은 공용 risk vocabulary | OWASP coverage, certification, endorsement처럼 들리는 표현 | finding과 발표 스크립트를 OWASP 언어에 매핑하되, 실제 산출물은 AgentGuard 리포트와 CI evidence로 보여준다. |
| MCP security guidance | tool permission, filesystem root, credential exposure framing | MCP 표준 전체 준수나 vendor-grade platform 주장 | `scan-mcp`가 broad filesystem, writable path, env credential passthrough를 rollout gate 입력으로 만든다. |
| Snyk agent-scan | agent, MCP server, skill scanning framing | 대형 보안 벤더와 같은 coverage나 market proof 주장 | PR diff + MCP config + transcript를 한국어 승인 리포트와 SARIF로 묶어 심사자가 바로 확인할 수 있게 한다. |
| Tencent AI-Infra-Guard | 넓은 AI infra threat inventory와 red-team 관점 | AgentGuard를 full-stack AI red-team suite처럼 포장 | AgentGuard는 rollout gate, not full platform: 배포 전 승인/차단 evidence에 집중한다. |
| splx-ai agentic-radar | agentic workflow attack-surface language | attack simulation이나 broad-platform coverage 주장 | deterministic scanner로 반복 가능한 CI 결과물과 정책 기반 승인 조건을 남긴다. |

## AX judging fit

- **대상권**: "우리는 보안 도구를 하나 더 만들었다"가 아니라 "AI 에이전트를 현업에 배포할 때 무엇을 근거로 멈추고 승인하는가"를 보여준다.
- **현업성**: 한국 팀이 실제로 보는 PR diff, MCP 설정, 에이전트 transcript/log를 입력으로 삼고, CLI commands와 rule IDs는 English-compatible로 유지한다.
- **결과물성**: 심사자는 Markdown report, SARIF, enterprise scenario fixture, PR comment workflow를 통해 설명보다 먼저 결과물을 볼 수 있다.

## Claim guardrails

발표와 문서에서 다음은 금지한다.

- **fake adoption**: 실제 채택, 운영 실적, 레퍼런스가 있는 것처럼 말하지 않는다.
- **certification**: OWASP, MCP, SOC 2, ISO 같은 외부 보증을 받은 것처럼 말하지 않는다.
- **broad-platform**: 전체 AI 보안 플랫폼, full platform, full red-team platform처럼 과장하지 않는다.

사용 가능한 문장은 이 범위에 둔다: "AgentGuard는 공개 위험 언어와 agent security scanner 흐름을 참고하되, 한국어 우선 rollout gate로 PR+MCP+transcript evidence를 남긴다."
