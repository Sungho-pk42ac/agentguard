# AX Rollout Guard 예선 제출 패키지

이 문서는 AX 인재전쟁 예선 심사자가 30초 안에 AgentGuard의 현재 산출물을 이해하도록 만든 한국어 우선 preliminary submission one-pager입니다. 최종 회사 문제를 알고 있다고 말하지 않고, 기존 synthetic scenario와 문서만 근거로 `PR diff + MCP config + agent transcript/log`를 배포 승인 게이트로 묶습니다.

## 한 문장 문제 정의

AX Rollout Guard는 한국 팀이 AI 에이전트를 현업 업무에 붙이기 전에 PR diff, MCP 설정, 에이전트 transcript/log에서 secret exposure, tool misuse, excessive agency 위험을 찾아 `BLOCK → 수정/정책 → PASS` 승인 근거로 남기게 하는 AgentGuard 활용 패키지입니다.

## 예선 제출 요약

- 제출물: AgentGuard CLI, synthetic enterprise scenario fixtures, Markdown/SARIF evidence, 한국어 우선 운영 문서.
- 심사자가 바로 볼 장면: 위험한 PR diff, broad filesystem MCP permission, 위험 shell transcript를 각각 스캔해 배포 전 `BLOCK` 또는 검토 조건을 확인합니다.
- AX 적합성: AX 인재전쟁의 회사 문제형 평가처럼 "현업 문제 → AI 에이전트 행동 → 위험 증거 → 승인 조건"으로 설명합니다.
- 현재 범위: 예선용 prelim 패키지입니다. 실제 회사 데이터, 최종 문제, 운영 지표, 외부 보증은 포함하지 않습니다.

## Smoke/demo commands

저장소 루트에서 실행합니다. 아래 명령은 현재 구현된 AgentGuard commands와 existing fixtures만 사용합니다.

```bash
npm run build
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

심사 발표에서는 설치된 CLI가 있으면 같은 surface를 아래처럼 짧게 보여줄 수 있습니다.

```bash
agentguard scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
agentguard scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
agentguard scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Reviewer-visible terms to watch: `secret.github_token`, `mcp.broad_filesystem_access`, `SARIF`, `BLOCK`, `PASS`.

## 30초 데모 스크립트

> "이 예선 제출은 AX 에이전트를 커머스 VOC 업무에 붙이는 상황을 가정합니다. PR diff에는 secret-like token이 있고, MCP config는 넓은 filesystem root를 열며, transcript에는 승인 없이 export나 삭제성 명령을 시도한 흔적이 있습니다. AgentGuard는 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 이 evidence를 찾아 `BLOCK` 또는 검토 조건을 남깁니다. 수정은 token 제거, MCP root 축소, 승인 필요 command 정책화이고, 재검증 결과를 Markdown 또는 SARIF로 남겨 예선 심사자가 배포 승인 판단을 볼 수 있게 합니다."

## 한계와 non-claims

- 이 문서는 prelim submission package입니다. 최종 회사 문제, 실제 운영 데이터, 실제 사용자 지표를 안다고 주장하지 않습니다.
- OWASP와 MCP는 risk vocabulary와 permission framing으로만 참고합니다. 외부 기관의 보증이나 적합성 판정을 주장하지 않습니다.
- GitHub SARIF/code scanning 문서는 CI artifact framing을 설명하는 공개 참고 자료입니다. AgentGuard가 GitHub 보안 제품을 대체한다고 말하지 않습니다.
- AgentGuard의 현재 제출 범위는 deterministic rollout gate evidence입니다. dashboard, SaaS auth, product rename, real customer data, machine-facing rule ID 변경은 범위 밖입니다.
- CLI commands, rule IDs, JSON/SARIF/API/machine fields는 English-compatible로 유지합니다.

## Public reference signals

| Reference | Borrow | Avoid |
|---|---|---|
| AX 인재전쟁: https://hackathon.jocodingax.ai/ | 회사 문제형 평가, 짧은 reviewer-readable 결과물, 예선 제출 맥락 | 최종 회사 문제가 이미 정해졌다는 표현 |
| OWASP Agentic AI threats: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic risk framing, excessive agency/tool misuse 언어 | 외부 보증처럼 들리는 표현 |
| OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/ | secret exposure 같은 공통 risk vocabulary | 모든 항목을 다룬다는 표현 |
| MCP security best practices: https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | filesystem root, write permission, credential exposure 설명 | MCP 표준 판정을 제공한다는 표현 |
| GitHub SARIF support: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | CI/report artifact framing, reviewer-verifiable SARIF output | GitHub 보안 기능을 대체한다는 표현 |

## Existing evidence links

| Existing asset | How this package uses it |
|---|---|
| `docs/ax-company-problem-intake-kit.md` ([link](ax-company-problem-intake-kit.md)) | 현장 회사 문제를 AgentGuard demo pack으로 바꾸는 인터뷰/변환 절차 |
| `docs/ax-demo-scenario-matrix.md` ([link](ax-demo-scenario-matrix.md)) | 커머스, 재무, HR, 여행 시나리오별 30초 demo angle과 evidence command |
| `docs/ax-competitive-comparison.md` ([link](ax-competitive-comparison.md)) | 공개 보안 레퍼런스에서 빌릴 말과 피해야 할 과장 표현 |
| `docs/ax-rule-compliance-checklist.md` ([link](ax-rule-compliance-checklist.md)) | 예선 규정/증거/미확인 항목을 분리해 제출 직전 과장 주장 리스크를 줄이는 체크리스트 |
