# AX Rollout references

AgentGuard를 AX 인재전쟁 심사 맥락에서 **AX Rollout Guard**로 설명할 때 사용할 공개 레퍼런스 비교 문서입니다. 제품명, CLI 명령, rule IDs는 그대로 AgentGuard로 유지하고, 포지셔닝만 "한국어 우선 엔터프라이즈 에이전트 배포 게이트"로 설명합니다.

## 공개 레퍼런스

- [AX 인재전쟁 해커톤](https://hackathon.jocodingax.ai/) — 심사 맥락과 발표 대상.
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — LLM 앱/에이전트 리스크의 공용 언어.
- [Model Context Protocol security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) — MCP server/tool 권한과 credential 노출을 설명할 때의 기준점.
- [Snyk agent-scan](https://github.com/snyk/agent-scan) — 에이전트 산출물과 코드 변경을 보안 관점에서 스캔하는 공개 예.
- [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) — AI 인프라 보안 점검을 넓게 다루는 공개 프로젝트.
- [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) — agentic system attack surface를 분석하는 공개 도구.
- [agentshield](https://github.com/affaan-m/agentshield) — 에이전트 보안 가드레일을 설명하는 공개 프로젝트.

## 비교와 차별화

| Reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| AX 인재전쟁 해커톤 | 현업 문제, 짧은 데모, 심사자가 바로 이해하는 결과물 | 해커톤 이름만 빌린 추상적 보안 주장 | 커머스 VOC 에이전트 같은 한국 업무 시나리오에서 `BLOCK → 수정 조건 → PASS` 흐름을 보여준다. |
| OWASP LLM Top 10 | LLM/agent risk를 설명하는 표준 어휘 | OWASP 전체를 구현했다는 식의 과장 | finding 설명과 발표에서 secret 노출, tool misuse, excessive agency를 공통 언어로 연결한다. |
| MCP security best practices | MCP 권한, filesystem root, credential passthrough의 판단 기준 | MCP 표준 인증이나 공식 적합성 주장 | `scan-mcp`와 rule IDs로 broad filesystem, writable path, env credential passthrough를 점검한다. |
| Snyk agent-scan | agent-generated change를 보안 산출물로 보는 관점 | 대형 보안 벤더와 같은 coverage 주장 | PR diff와 agent transcript를 CI/SARIF, PR comment, Markdown report로 남기는 데 집중한다. |
| Tencent AI-Infra-Guard | AI 인프라 관점의 넓은 threat inventory | AgentGuard가 전체 AI 인프라 보안 플랫폼이라는 주장 | 엔터프라이즈 데모에서는 rollout gate 역할에 한정하고, 인프라 플랫폼 확장은 로드맵으로 분리한다. |
| splx-ai agentic-radar | agentic attack surface를 지도처럼 보여주는 접근 | attack simulation 전체를 제공한다는 표현 | 현재는 deterministic scanner로 PR, MCP, transcript 근거를 모아 승인 조건을 만든다. |
| agentshield | 에이전트 가드레일을 사용자가 이해하기 쉬운 말로 설명 | 검증되지 않은 신뢰 과장과 독점성 주장 | 한국어 운영 문서와 policy-as-code 예제로 팀이 배포 전 판단할 수 있게 한다. |

## Public research refresh

| Signal | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Agentic AI를 threat-model 기반으로 보고, 자율 행동과 mitigation을 함께 설명하는 방식 | OWASP ASI 문서를 AgentGuard coverage나 공식 검증처럼 말하는 것 | risky agent behavior를 `transcript/log`, MCP, PR diff evidence에 연결하고, REVIEW 항목은 SARIF와 company-problem worksheet의 수정 조건으로 남긴다. |
| [GitHub SARIF support docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | code scanning이 이해하는 SARIF result, ruleId, location, fingerprint 중심의 증거 구조 | SARIF를 위해 CLI commands, rule IDs, product name을 바꾸는 것 | 기존 SARIF output을 유지하고 PR diff finding은 SARIF location/ruleId와 Markdown report를 같은 판단 근거로 보여준다. |
| [Anthropic Agent Skills post](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) | skills를 instructions, scripts, resources가 담긴 폴더로 보고 필요한 맥락만 점진적으로 읽는 방식 | AgentGuard가 Agent Skills 런타임이나 Anthropic 기능을 구현했다는 표현 | MCP 설정과 `transcript/log`에서 agent procedure drift를 증거화하고, demo tailoring은 company-problem worksheet에 한정해 기록한다. |

## AX judging implications

- **현업성**: AgentGuard는 "AI 에이전트를 도입할 수 있는가?"가 아니라 "에이전트가 PR, MCP, transcript에서 위험한 행동을 했을 때 배포를 어떻게 멈추고 승인 조건을 남길 것인가?"를 다룬다.
- **결과물성**: 심사자는 CLI, Markdown report, SARIF, PR comment, enterprise scenario fixture를 직접 확인할 수 있다. 설명보다 산출물이 먼저 보이도록 구성한다.
- **증거 무결성**: `transcript/log`는 에이전트가 스스로 꾸며낸 자기보고가 아니라 CI, host, PR artifact처럼 팀이 통제하는 읽기 전용 evidence channel에서 보관·검증해야 한다.
- **차별성**: AgentGuard는 공개 보안 프레임워크와 유사 도구를 부정하지 않는다. 차별점은 한국어 우선 운영 맥락, PR+MCP+transcript를 함께 보는 rollout gate, policy-as-code, CI/SARIF 연결, 엔터프라이즈 데모 시나리오다.
- **발표력**: 발표는 "문제 → 위험 입력 → AgentGuard finding → 수정/승인 조건 → 재검증" 순서로 짧게 보여준다. 공개 레퍼런스는 근거로만 쓰고, 제품 기능처럼 말하지 않는다.

## Borrow / avoid / AgentGuard action

- **Borrow**: OWASP와 MCP 문서의 공용 언어, 공개 agent-security 도구들의 surface 분류, AX 인재전쟁의 현업 데모 압축 방식을 빌린다.
- **Avoid**: 검증되지 않은 운영 실적, 인증, 독점성, 전체 AI 보안 플랫폼 같은 근거 없는 신뢰 문구를 피한다.
- **AgentGuard action**: AgentGuard라는 machine-facing 이름은 유지하고, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, rule IDs, SARIF를 그대로 보여준다. 한국어 설명은 심사자와 현업 사용자가 판단을 빠르게 이해하도록 돕는 presentation layer로 둔다.

## 발표용 한 줄

AgentGuard는 공개 LLM/MCP 보안 기준과 유사 오픈소스 도구들을 참고하되, 한국 엔터프라이즈 팀이 에이전트 PR, MCP 설정, transcript를 배포 전 승인 게이트로 검증하도록 만든 한국어 우선 AX Rollout Guard입니다.
