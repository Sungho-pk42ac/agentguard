# Commerce VOC agent approval scenario

이 예시는 **AX Rollout Guard**를 커머스 VOC 자동 처리 에이전트 배포 전 승인 게이트로 사용하는 합성 시나리오입니다. 모든 인물·주문·개인정보·토큰은 데모용 가짜 데이터입니다.

## 상황

한국 커머스 운영팀이 Codex/Cursor/Claude Code 기반 업무 에이전트에게 다음 일을 맡기려 합니다.

- VOC 티켓 요약
- 환불/쿠폰 후보 추출
- CRM 메모 초안 작성
- 운영 정책 위반 가능성이 있는 PR diff와 MCP 설정 점검

AgentGuard는 배포 전 `PR diff`, `MCP config`, `agent transcript/log`를 검사해 **BLOCK → 정책/수정 조건 → PASS** 흐름으로 승인 가능한 조건을 만듭니다.

## 30초 데모 흐름

```bash
agentguard scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
agentguard scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

1. 위험한 PR diff가 합성 결제/VOC 토큰과 과도한 shell 동작을 포함해 `BLOCK`됩니다.
2. MCP 설정이 사용자 홈 전체 쓰기 권한과 토큰 passthrough를 노출해 `BLOCK` 또는 `REVIEW`됩니다.
3. 에이전트 로그가 승인 없는 고객 데이터 export/삭제성 명령을 포함해 검토 대상이 됩니다.
4. [`expected-approval-report.md`](expected-approval-report.md)는 심사위원에게 보여줄 한국어 승인 리포트 예시입니다.

## 배포 조건 예시

- MCP filesystem root를 프로젝트 전용 read-only 작업 디렉터리로 제한합니다.
- synthetic token placeholder도 환경변수/secret manager 경로로 이동합니다.
- VOC export, 쿠폰 지급, 환불 처리, 대량 이메일 전송은 승인 필요 작업으로 정책에 명시합니다.
- 수정 후 동일 명령을 다시 실행해 `PASS` 또는 승인 가능한 `REVIEW` 상태를 증빙합니다.
