# HR recruiting agent approval scenario

이 예시는 **AX Rollout Guard**를 HR/채용 자동화 에이전트 배포 전 승인 게이트로 사용하는 합성 시나리오입니다. 모든 후보자, 평가, 파일 경로, 토큰은 데모용 가짜 데이터이며 실제 개인이나 조직을 나타내지 않습니다.

## 상황

인사팀이 Codex/Cursor/Claude Code 기반 업무 에이전트에게 다음 일을 맡기려 합니다.

- 지원자 이력서 요약
- 채용 단계별 후보자 순위 초안 작성
- 면접 피드백 병합
- 채용 워크플로우의 PR diff, MCP 설정, agent transcript/log 점검

AgentGuard는 배포 전 `PR diff`, `MCP config`, `agent transcript/log`를 검사해 **BLOCK → 정책/수정 조건 → PASS** 흐름으로 승인 가능한 조건을 만듭니다. 이 fixture는 runtime interceptor가 아니라, staging/dev에서 남은 agent 산출물과 로그를 배포 승인 전에 감사하는 pre-rollout gate 데모입니다.

## 30초 데모 흐름

```bash
agentguard scan-diff < examples/enterprise-scenarios/hr-recruiting-agent/risky-pr.diff
agentguard scan-mcp < examples/enterprise-scenarios/hr-recruiting-agent/risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/hr-recruiting-agent/agent-transcript.log
```

1. 위험한 PR diff가 합성 지원자 CSV export와 삭제성 shell 동작을 포함해 `BLOCK`됩니다.
2. MCP 설정이 사용자 홈 전체 쓰기 권한과 HR 도구 토큰 passthrough를 노출해 `BLOCK` 또는 `REVIEW`됩니다.
3. 에이전트 로그가 승인 없는 후보자 자료 export, 순위 생성, 파일 삭제 명령을 포함해 검토 대상이 됩니다.
4. [`expected-approval-report.md`](expected-approval-report.md)는 심사위원에게 보여줄 한국어 승인 리포트 예시입니다.

## 배포 조건 예시

- MCP filesystem root를 프로젝트 전용 read-only 작업 디렉터리로 제한합니다.
- 합성 token placeholder도 환경변수/secret manager 경로로 이동합니다.
- 후보자 export, 순위 생성, 평가 병합, 삭제성 shell 명령은 승인 필요 작업으로 정책에 명시합니다.
- 수정 후 동일 명령을 다시 실행해 `PASS` 또는 승인 가능한 `REVIEW` 상태를 증빙합니다.
