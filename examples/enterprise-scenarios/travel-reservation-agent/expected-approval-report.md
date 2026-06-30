# AX Rollout Guard 승인 리포트

**시나리오:** 여행 예약 변경·취소 안내 에이전트
**판정: BLOCK**
**대상:** PR diff, MCP config, agent transcript/log

## 핵심 탐지

| 영역 | 위험 | 업무 영향 | 권장 조치 |
| --- | --- | --- | --- |
| PR diff | 예약 명단 export, 환경 출력, 삭제성 shell 명령이 추가됨 | 예약·노선·좌석 변경 정보가 승인 없이 임시 저장소로 이동하거나 운영 캐시가 사라질 수 있음 | export/printenv/rm 명령 제거, 승인된 내부 reservation adapter로 제한 |
| MCP config | 예약 운영 홈 전체 filesystem root와 write 권한 | 에이전트가 업무 범위를 넘어 예약 파일을 읽거나 수정할 수 있음 | 여행 예약 fixture 전용 read-only root로 축소 |
| MCP env | 예약 API와 안내 메시지 토큰 passthrough | 에이전트 세션이 고권한 토큰을 상속해 tool misuse와 insecure output handling 위험이 커질 수 있음 | secret manager 참조와 최소권한 토큰으로 대체 |
| transcript | 승인 없는 예약 명단 export/환경 출력/credential 파일 읽기/삭제성 명령 | excessive agency로 취소·환불 안내와 좌석 재배정 근거의 감사 추적성이 깨질 수 있음 | 예약 export, printenv, cat .env, 삭제, 메시지 발송을 승인 필요 작업으로 등록 |

## 배포 조건

1. `agent-policy.yaml`에 예약 명단 export, 노선 변경 확정, 좌석 재배정, 취소·환불 안내 발송, 환경 출력, credential 파일 읽기, 삭제성 shell 명령을 승인 필요 작업으로 명시합니다.
2. MCP filesystem root를 `/workspace/synthetic-travel-readonly`처럼 전용 read-only 경로로 제한합니다.
3. 토큰 placeholder도 코드/설정에서 제거하고 환경별 secret manager 경로만 남깁니다.
4. 수정 후 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`를 재실행해 `PASS` 또는 승인 가능한 `REVIEW` 상태를 증빙합니다.

## 승인 체크리스트

- [ ] 운영 예약 원장이나 실사용 토큰이 입력 fixture에 없다.
- [ ] 사람이 승인해야 하는 예약 변경·좌석 재배정·취소·환불 안내 작업이 정책에 포함되어 있다.
- [ ] MCP tool 권한이 여행 예약 fixture 디렉터리와 read-only 원칙에 맞게 줄었다.
- [ ] 리포트가 한국어로 업무 영향과 조치 조건을 설명한다.
- [ ] JSON/SARIF/CLI machine contract는 기존 English-compatible 형식을 유지한다.
