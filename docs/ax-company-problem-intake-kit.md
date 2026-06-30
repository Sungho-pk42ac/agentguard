# AX 회사 문제 인테이크 키트 (company problem intake kit)

이 문서는 AX 인재전쟁 현장에서 처음 보는 회사 문제를 6시간 현장 적응 가능한 AgentGuard 데모로 바꾸기 위한 한국어 우선 intake/adaptation kit입니다. 목표는 AgentGuard를 과장된 AI 보안 플랫폼이 아니라 PR diff, MCP config, agent transcript를 근거로 배포 승인 여부를 판단하는 deterministic rollout gate로 보여주는 것입니다.

공개 레퍼런스:

- AX 인재전쟁: https://hackathon.jocodingax.ai/
- OWASP LLM Top 10: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- MCP security best practices: https://modelcontextprotocol.io/specification/draft/basic/security_best_practices

## 사용 목적

심사자나 현업 담당자가 주는 미정의 회사 문제를 다음 산출물로 압축합니다.

- 업무 워크플로: 어떤 업무가 에이전트로 처리되는지 한 문장으로 정의합니다.
- 에이전트/도구 surface: PR diff, MCP config, transcript 중 어떤 증거가 남는지 고릅니다.
- 위험 입력: secret, 과도한 filesystem 권한, 위험 shell 행동, 개인정보 형태 텍스트처럼 AgentGuard가 설명할 수 있는 입력으로 바꿉니다.
- AgentGuard commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` 중 필요한 명령만 사용합니다.
- 승인 게이트: `BLOCK → 수정/정책 → PASS` 흐름과 배포 승인 조건을 남깁니다.
- 30초 데모 스크립트: 문제, 위험, 차단, 수정, 승인까지 한 번에 말합니다.

## 입력 카드

현장 인터뷰는 아래 7개만 채웁니다. 모르면 "가정"으로 표시하고 최종 발표에서는 가정임을 밝힙니다.

| Field | Korean prompt | Output |
|---|---|---|
| Company problem | 어떤 회사 업무가 AX로 바뀌는가? | 예: 채용 서류 1차 분류, VOC 요약, 내부 지식 검색 |
| Business owner | 누가 승인권자인가? | 예: 운영 리드, 보안 담당, 팀장 |
| Workflow | 사람이 하던 단계와 에이전트가 맡는 단계는? | 업무 워크플로 3단계 |
| Tool surface | 에이전트가 어떤 도구를 읽거나 실행하는가? | MCP server, repo, shell, PR |
| Risky input | 실패하면 무엇이 노출되거나 변경되는가? | token, 개인정보 형태 텍스트, broad filesystem, unsafe command |
| Guard command | 어떤 AgentGuard commands로 증거를 만들 것인가? | `scan-diff`, `scan-mcp`, `scan-log` |
| Approval rule | 어떤 상태면 배포 승인 가능한가? | BLOCK 해소, 정책 예외 승인, PASS report |

## 변환 절차

1. **업무 워크플로 작성**: 회사 문제를 "입력 → 에이전트 행동 → 배포/업무 영향"으로 바꿉니다.
2. **에이전트/도구 surface 선택**: PR diff, MCP config, transcript 중 하나 이상을 증거 surface로 고릅니다.
3. **위험 입력 만들기**: fake token, synthetic 개인정보 형태, broad filesystem root, writable path, 위험 shell command처럼 실제 데이터가 아닌 샘플만 씁니다.
4. **리스크 언어 매핑**: OWASP 표현은 shared risk vocabulary로만 사용합니다. 예: secret 노출, tool misuse, excessive agency. OWASP 항목 전부를 구현했다거나 인증받았다고 말하지 않습니다.
5. **MCP 권한 매핑**: MCP security best practices는 filesystem root, write permission, credential passthrough 설명에만 연결합니다. AgentGuard가 MCP 표준 인증을 제공한다고 말하지 않습니다.
6. **AgentGuard commands 실행 계획**: 입력 surface별로 아래 명령을 고릅니다.

```bash
agentguard scan-diff < risky-pr.diff
agentguard scan-mcp < risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < agent-transcript.log
```

7. **BLOCK → 수정/정책 → PASS evidence 구성**: 첫 실행은 BLOCK 또는 REVIEW를 보여주고, 수정 diff나 policy 조건을 적용한 뒤 PASS 또는 승인 가능한 report를 보여줍니다.
8. **승인 언어로 마감**: 기술 finding을 "업무 영향", "배포 승인 조건", "승인권자 확인", "최종 판정"으로 번역합니다.

## 산출물 템플릿

아래 템플릿은 회사 문제마다 복사해서 채웁니다. CLI commands, rule IDs, SARIF/API/machine fields는 English-compatible로 유지합니다.

~~~markdown
# AX Rollout Guard 승인 리포트: <회사 문제>

## 문제 입력
- 회사 문제: <한 문장>
- 승인권자: <역할>
- Prelim/Final 상태: <prelim 또는 final>

## 업무 워크플로
1. <기존 업무 입력>
2. <에이전트 처리 단계>
3. <배포 또는 업무 결정 지점>

## 에이전트/도구 surface
- PR diff: <있음/없음>
- MCP config: <있음/없음>
- Agent transcript: <있음/없음>

## 위험 입력
- <synthetic risky input>
- Risk language: <OWASP/MCP vocabulary mapping>
- AgentGuard rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`

## AgentGuard commands
```bash
agentguard scan-diff < risky-pr.diff
agentguard scan-mcp < risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < agent-transcript.log
```

## BLOCK → 수정/정책 → PASS evidence
- 최초 판정: BLOCK
- 업무 영향: <노출/오작동/무단 변경 위험>
- 수정/정책 조건: <권한 축소, secret 제거, 승인 필요 command 지정>
- 재검증 판정: PASS 또는 승인 가능한 REVIEW

## 승인 리포트
- 배포 승인 조건: <조건>
- 승인권자 확인: <역할>
- 최종 판정: <PASS/REVIEW/BLOCK>
~~~

## 예선과 본선 구분 (Prelim vs final)

- **Prelim**: 현장에서 받은 문제를 빠르게 demo pack으로 바꾼 상태입니다. 가정, synthetic 입력, 아직 재검증하지 않은 수정 조건을 명시합니다. 발표에서는 "예비 위험 가설"이라고 말합니다.
- **Final**: AgentGuard commands를 실행해 evidence를 남기고, `BLOCK → 수정/정책 → PASS` 또는 승인 가능한 REVIEW까지 확인한 상태입니다. 배포 승인 조건과 남은 리스크를 승인 리포트에 씁니다.

Prelim을 final처럼 말하지 않습니다. Final evidence가 없으면 "최종 검증 전"이라고 표시합니다.

## 운영 가드레일 (Guardrails)

- No fake claims: 운영 실적, 인증, 독점성, OWASP 항목 전부를 다룬다는 말, AI red-team 전체 기능을 주장하지 않습니다.
- No real data: 실제 개인정보, 운영 secret, 내부 문서, 실명, 전화번호, 이메일, token을 넣지 않습니다. 모든 입력은 synthetic fixture로 만듭니다.
- Temporary fixtures: 현장 실습 중 만든 `*.json`, `*.log`, `*.diff` 샘플은 임시 디렉터리에서 만들고, 저장소에 커밋하기 전 실제 credential/PII가 없는지 AgentGuard로 다시 스캔합니다.
- Scope honesty: AgentGuard는 deterministic rollout gate evidence에 집중합니다. scanner behavior, dashboard, SaaS auth, product rename은 이 kit의 범위가 아닙니다.
- English-compatible contracts: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `secret.github_token`, `mcp.broad_filesystem_access`, SARIF fields는 번역하지 않습니다.
- Business approval language: 마지막 report는 "업무 영향", "배포 승인 조건", "승인권자 확인", "최종 판정"으로 끝냅니다.

## 30초 데모 스크립트

> "이 회사 문제는 <업무 워크플로>에 AX 에이전트를 넣는 상황입니다. 에이전트가 <에이전트/도구 surface>를 사용하면서 <위험 입력>이 생겼고, AgentGuard는 `agentguard scan-diff`/`agentguard scan-mcp`/`agentguard scan-log`로 이를 BLOCK했습니다. 우리는 권한을 줄이거나 정책 승인 조건을 추가해 재검증했고, 최종 승인 리포트에는 업무 영향, 배포 승인 조건, 승인권자 확인, PASS evidence를 남겼습니다. 그래서 이 데모는 추상 보안 설명이 아니라 6시간 현장 적응 가능한 AX Rollout Guard 승인 게이트입니다."
