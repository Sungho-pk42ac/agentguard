# AX final company-problem worksheet

이 worksheet는 본선 현장에서 처음 받는 회사 문제를 10분 안에 AgentGuard/AX Rollout Guard 데모와 승인 리포트로 바꾸기 위한 한국어 우선 작업지입니다. 목적은 "우리가 모든 agent security를 대신한다"가 아니라, 기존 CLI evidence로 **회사 문제 → PR diff/MCP config/agent transcript → BLOCK → REVIEW/PASS → 승인 조건**을 설명하는 것입니다.

Public references used as reference vocabulary only:

- OWASP Agentic AI threats and mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/
- MCP security best practices: https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
- Snyk agent-scan: https://github.com/snyk/agent-scan

## 사용 목적

심사자나 기업 담당자가 주는 회사 문제를 아래 네 가지로 압축합니다.

- 업무 영향: 어떤 업무 결정, 배포, 고객 응대, 내부 승인에 AX agent가 들어가는지 적습니다.
- Evidence surface: AgentGuard가 읽을 수 있는 PR diff, MCP config, agent transcript 중 무엇으로 증거를 만들지 고릅니다.
- 위험 언어: OWASP agentic-risk vocabulary와 MCP consent/control, tool boundary, data boundary framing을 참고 표현으로만 씁니다.
- 승인 조건: finding을 기술 경고가 아니라 "운영 연결 전 수정 조건" 또는 "사람 승인 후 제한 rollout"로 바꿉니다.

## 10분 작성 순서

1. 회사 문제를 한 문장으로 씁니다. 예: "커머스 VOC agent가 고객 불만을 요약하고 환불/쿠폰 추천 PR을 만든다."
2. 업무 owner를 정합니다. 예: CS 운영 리드, 보안 담당, 서비스 팀장.
3. agent가 남기는 evidence surface를 고릅니다: PR diff, MCP config, agent transcript.
4. 현재 저장소 fixture 중 가장 가까운 command를 선택합니다.
5. risky command로 `BLOCK` 또는 `REVIEW`를 보여줍니다.
6. fixed command로 `PASS` 또는 승인 가능한 상태를 보여줍니다.
7. 마지막 문장을 "배포 승인 조건"으로 씁니다.

## 회사 문제 입력 카드

| Field | 작성 값 |
|---|---|
| 회사 문제 | `<기업 업무를 한 문장으로>` |
| 업무 owner | `<승인권자 역할>` |
| AX agent 역할 | `<요약, 검색, PR 생성, 티켓 처리, 배포 보조 등>` |
| PR diff surface | `<있음/없음, 어떤 코드/설정 변경인지>` |
| MCP config surface | `<있음/없음, 어떤 도구/파일/권한인지>` |
| agent transcript surface | `<있음/없음, 어떤 shell/tool 행동인지>` |
| 위험 입력 | `<fake secret, synthetic PII 형태, broad filesystem, writable path, unsafe command>` |
| 최종 승인 조건 | `<수정, 권한 축소, 정책 승인, PASS report>` |

## 위험 언어 매핑

| Evidence | 참고 언어 | AgentGuard 설명 |
|---|---|---|
| PR diff에 secret-like 값 또는 개인정보 형태 텍스트가 추가됨 | OWASP agentic-risk vocabulary: tool misuse, sensitive data exposure, excessive agency | `agentguard scan-diff`로 PR 승인 전에 risk evidence를 만든다. |
| MCP filesystem root가 넓거나 write-capable임 | MCP security best practices: consent/control, tool boundary, data boundary | `agentguard scan-mcp`로 MCP config evidence를 만들고 root 축소/read-only 조건을 남긴다. |
| transcript에 승인 없는 export, 민감 경로 접근, 삭제성 명령이 있음 | Agent/tool behavior review and approval boundary | `agentguard scan-log`로 사람 승인 조건이 필요한 행동을 `REVIEW`로 남긴다. |
| 여러 surface가 동시에 걸림 | agent/MCP scanner category와 component inventory framing | AgentGuard 차별점은 broad scanner platform 전체 범위 주장이 아니라 한국어 rollout approval evidence를 PR diff/MCP/transcript에 묶는 것이다. |

이 표의 외부 reference는 설명 언어를 빌리는 용도입니다. OWASP, MCP, Snyk가 AgentGuard를 인증하거나 검증했다는 뜻이 아닙니다.

## Evidence commands

현재 저장소의 fixture-backed command만 사용합니다. 발표 전에 저장소 루트에서 `npm run build`를 실행한 뒤 아래 명령을 그대로 복사해 씁니다. 이 상대 경로들은 docs-contract test가 존재 여부를 고정합니다.

```bash
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff
node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff
node dist/index.js scan-log < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

Expected storyline:

- Risky MCP config: broad/writable filesystem evidence로 `BLOCK`.
- Fixed MCP config: root 축소와 read-only 조건으로 `PASS`.
- Risky PR diff: synthetic secret-like/PII 형태 evidence로 `REVIEW` 또는 `BLOCK`.
- Fixed PR diff: 위험 값 제거 후 `PASS`.
- agent transcript: 위험 shell/tool 행동을 사람 승인 조건이 필요한 `REVIEW` evidence로 설명.

## 승인 조건 템플릿

```markdown
# AX Rollout Guard final worksheet: <회사 문제>

## 문제
- 회사 문제: <한 문장>
- 업무 owner: <승인권자 역할>
- agent 역할: <업무 자동화 단계>

## Evidence surface
- PR diff: <command/result>
- MCP config: <command/result>
- agent transcript: <command/result>

## Risk language
- OWASP 참고 표현: <tool misuse/sensitive data/excessive agency 중 해당 항목>
- MCP 참고 표현: <consent/control/tool boundary/data boundary 중 해당 항목>
- AgentGuard rule/evidence: <finding 또는 verdict>

## BLOCK → REVIEW/PASS
- 최초 판정: <BLOCK 또는 REVIEW>
- 업무 영향: <노출, 무단 변경, 승인 없는 실행, 과도한 권한>
- 수정/정책 조건: <secret 제거, root 축소, read-only, 사람 승인>
- 재검증 판정: <PASS 또는 승인 가능한 REVIEW>

## 배포 승인 조건
- <조건 1>
- <조건 2>
- 남은 리스크: <있으면 명시, 없으면 synthetic fixture 기준이라고 명시>
```

## 10분 데모 플랜

| Minute | 할 일 | 산출물 |
|---|---|---|
| 0-2 | 회사 문제와 업무 owner를 한 문장으로 정리 | 문제 입력 카드 |
| 2-4 | PR diff/MCP config/agent transcript 중 evidence surface 선택 | command 1-2개 선택 |
| 4-6 | risky fixture command 실행 또는 결과 캡처 | `BLOCK`/`REVIEW` evidence |
| 6-8 | fixed fixture command 실행 또는 수정 조건 설명 | `PASS`/승인 조건 |
| 8-10 | 승인 조건 템플릿 완성 | 30초 발표 문장 |

30초 발표 문장:

> "이 회사 문제는 `<업무>`에 AX agent를 연결하는 상황입니다. AgentGuard는 PR diff/MCP config/agent transcript evidence로 `<위험>`을 먼저 `BLOCK` 또는 `REVIEW`로 보여주고, 권한 축소나 정책 승인 조건 뒤 `PASS` 또는 제한 rollout 조건을 남깁니다. 그래서 이 데모는 broad security platform 주장이 아니라, 한국 팀이 바로 읽을 수 있는 배포 승인 worksheet입니다."

## 금지 주장

- 운영 원천자료, 운영 채택 실적, reference account, 운영 적용 완료를 주장하지 않습니다.
- OWASP, MCP, Snyk가 AgentGuard를 인증, 검증, 감사, 공식 승인했다고 말하지 않습니다.
- Snyk agent-scan이나 다른 agent/MCP scanner platform과 같은 전체 범위 제품이라고 말하지 않습니다.
- 모든 보안 영역을 포괄한다거나 red-team 제품군 수준이라고 말하지 않습니다.
- AgentGuard가 MCP runtime controls를 실행하거나 강제한다고 말하지 않습니다.
- 실제 secret, 실제 개인정보, private transcript, 내부 문서를 fixture에 넣지 않습니다.

## Out-of-scope

- CLI behavior 변경
- rule ID, severity, policy default 변경
- product rename
- dashboard/SaaS/auth 추가
- package metadata 변경
- 실제 회사 데이터 저장
