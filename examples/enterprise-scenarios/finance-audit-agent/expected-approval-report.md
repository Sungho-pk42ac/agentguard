# AX Rollout Guard 승인 리포트

**시나리오:** 재무 감사 증빙 자동 수집 에이전트
**판정: BLOCK**
**대상:** PR diff, MCP config, agent transcript/log

## 핵심 탐지

| 영역 | 위험 | 업무 영향 | 권장 조치 |
| --- | --- | --- | --- |
| PR diff | 감사 증빙 export, 환경 출력, 권한 변경 shell 명령이 추가됨 | 재무 증빙과 실행 환경이 승인 없이 외부 전송되거나 임시 저장소에서 과도하게 열릴 수 있음 | export/printenv 명령 제거, 승인된 내부 audit adapter로 제한 |
| MCP config | 파일시스템 root와 `/tmp` writable path가 노출됨 | 에이전트가 업무 범위를 넘어 전표, 결재 메모, 감사 fixture를 읽거나 임시 export 파일을 쓸 수 있음 | 감사 fixture 전용 read-only root로 축소 |
| MCP env | ERP/감사 export 토큰 passthrough | 에이전트 세션이 고권한 토큰을 상속해 sensitive information disclosure 위험이 커질 수 있음 | secret manager 참조와 최소권한 토큰으로 대체 |
| transcript | 승인 없는 export/환경 출력/credential 파일 읽기/권한 변경/삭제성 명령 | excessive agency와 insecure output handling으로 감사 추적성이 깨질 수 있음 | export, printenv, cat .env, chmod, 삭제, 결재 메모 생성을 승인 필요 작업으로 등록 |

## 배포 조건

1. `agent-policy.yaml`에 감사 증빙 export, 원장 파일 쓰기, 환경 출력, credential 파일 읽기, 권한 변경 shell 명령, 삭제성 shell 명령을 승인 필요 작업으로 명시합니다.
2. MCP filesystem root를 `/workspace/synthetic-audit-readonly`처럼 전용 read-only 경로로 제한합니다.
3. 토큰 placeholder도 코드/설정에서 제거하고 환경별 secret manager 경로만 남깁니다.
4. 수정 후 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`를 재실행해 `PASS` 또는 승인 가능한 `REVIEW` 상태를 증빙합니다.

## 승인 체크리스트

- [ ] 운영 원장이나 실서비스 토큰이 입력 fixture에 없다.
- [ ] 사람이 승인해야 하는 작업이 정책에 포함되어 있다.
- [ ] MCP tool 권한이 감사 fixture 디렉터리와 read-only 원칙에 맞게 줄었다.
- [ ] 리포트가 한국어로 업무 영향과 조치 조건을 설명한다.
- [ ] JSON/SARIF/CLI machine contract는 기존 English-compatible 형식을 유지한다.
