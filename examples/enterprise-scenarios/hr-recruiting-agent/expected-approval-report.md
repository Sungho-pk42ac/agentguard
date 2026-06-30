# AX Rollout Guard 승인 리포트

**시나리오:** HR/채용 자동화 에이전트
**판정: BLOCK**
**대상:** PR diff, MCP config, agent transcript/log

## 핵심 탐지

| 영역 | 위험 | 업무 영향 | 권장 조치 |
| --- | --- | --- | --- |
| PR diff | shell 명령과 후보자 export 경로가 추가됨 | 지원자 평가 자료가 승인 없이 외부 전송/임시 저장될 수 있음 | export 명령 제거, 승인된 내부 API adapter로 제한 |
| MCP config | 사용자 홈 전체 filesystem root와 write 권한 | 에이전트가 채용 업무 범위를 넘어 파일을 읽거나 수정할 수 있음 | 프로젝트 전용 read-only root로 축소 |
| MCP env | ATS/면접/검증 도구 토큰 passthrough | 에이전트 세션이 고권한 채용 도구 토큰을 상속할 수 있음 | secret manager 참조와 최소권한 토큰으로 대체 |
| transcript | 승인 없는 후보자 export와 삭제성 명령 | 채용 판단 근거와 평가 자료가 승인 절차 없이 이동하거나 사라질 수 있음 | export, 순위 생성, 평가 병합, 삭제 명령을 승인 필요 작업으로 등록 |

## 배포 조건

1. `agent-policy.yaml`에 후보자 export, shortlist 생성, 평가 병합, 삭제성 shell 명령을 승인 필요 작업으로 명시합니다.
2. MCP filesystem root를 `/workspace/synthetic-recruiting-readonly`처럼 전용 read-only 경로로 제한합니다.
3. 토큰 placeholder도 코드/설정에서 제거하고 환경별 secret manager 경로만 남깁니다.
4. 수정 후 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`를 재실행해 `PASS` 또는 승인 가능한 `REVIEW` 상태를 증빙합니다.

## 승인 체크리스트

- [ ] 실제 개인 식별자나 운영 토큰이 입력 fixture에 없다.
- [ ] 사람이 승인해야 하는 채용 판단 작업이 정책에 포함되어 있다.
- [ ] MCP tool 권한이 업무 디렉터리와 read-only 원칙에 맞게 줄었다.
- [ ] 리포트가 한국어로 업무 영향과 조치 조건을 설명한다.
- [ ] JSON/SARIF/CLI machine contract는 기존 English-compatible 형식을 유지한다.
