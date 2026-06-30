# Finance audit agent approval scenario

이 예시는 **AX Rollout Guard**를 재무 감사 증빙 자동 수집 에이전트 배포 전 승인 게이트로 사용하는 합성 시나리오입니다. 모든 전표·승인자·계정·토큰은 데모용 가짜 데이터입니다.

## 상황

한국 재무/감사 대응팀이 Codex/Cursor/Claude Code 기반 업무 에이전트에게 다음 일을 맡기려 합니다.

- 비용 전표와 승인 메모 요약
- 감사 증빙 export 후보 추출
- 내부 결재 리포트 초안 작성
- 재무 파일 접근 범위, MCP 설정, agent transcript/log 점검

AgentGuard는 배포 전 `PR diff`, `MCP config`, `agent transcript/log`를 검사해 **BLOCK → 정책/수정 조건 → PASS** 흐름으로 승인 가능한 조건을 만듭니다.

## 30초 데모 흐름

```bash
agentguard scan-diff < examples/enterprise-scenarios/finance-audit-agent/risky-pr.diff
agentguard scan-mcp < examples/enterprise-scenarios/finance-audit-agent/risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/finance-audit-agent/agent-transcript.log
```

1. 위험한 PR diff가 합성 감사 export 토큰, 환경 출력, 삭제성 shell 동작을 포함해 `BLOCK`됩니다.
2. MCP 설정이 파일시스템 루트, `/tmp` writable 경로, credential passthrough를 노출해 `BLOCK`됩니다.
3. 에이전트 로그가 승인 없는 감사 번들 export, 환경 출력, credential 파일 읽기, 삭제성 shell 명령을 포함해 `BLOCK`됩니다.
4. [`expected-approval-report.md`](expected-approval-report.md)는 심사위원에게 보여줄 한국어 승인 리포트 예시입니다.

## 배포 조건 예시

- MCP filesystem root를 감사 fixture 전용 read-only 작업 디렉터리로 제한합니다.
- synthetic token placeholder도 환경변수/secret manager 경로로 이동합니다.
- 감사 증빙 export, 원장 파일 쓰기, 승인 메모 생성, `/tmp` 쓰기, 삭제성 shell 명령은 승인 필요 작업으로 정책에 명시합니다.
- 수정 후 동일 명령을 다시 실행해 `PASS` 또는 승인 가능한 `REVIEW` 상태를 증빙합니다.
