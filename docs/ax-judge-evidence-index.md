# AX judge evidence index

이 문서는 AX Rollout Guard 심사자가 30초 안에 볼 수 있는 한국어 우선 증거 카드입니다. 목적은 회사 문제를 AgentGuard의 현재 구현 surface인 MCP config와 PR diff fixture에 연결하고, 예상 판정, 업무 영향, 승인 조건, 공개 reference grounding을 한 페이지에서 확인하게 하는 것입니다.

## 30초 증거 카드

| Evidence | 회사 문제 연결 | exact command | fixture | 예상 판정 | 업무 영향 | 승인 조건 |
|---|---|---|---|---|---|---|
| risky MCP | 커머스 VOC 에이전트가 고객 export와 작업 디렉터리에 넓은 파일 권한을 갖고 배포될 수 있다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `BLOCK` 또는 강한 `REVIEW` 근거 | 고객 자료 export, 로컬 파일 쓰기, credential passthrough가 승인 없이 열릴 수 있어 운영 출시를 멈춰야 한다. | MCP root를 fixture 전용 read-only 경로로 줄이고, credential passthrough를 제거해야 한다. |
| fixed MCP | 같은 VOC 에이전트를 제한된 fixture root와 read-only 권한으로 재검토한다. | `node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json` | `PASS` | 파일 권한 리스크가 데모 범위 안으로 줄어 배포 승인 논의가 가능해진다. | `examples/ax-rollout-before-after/commerce-voc-mcp/readonly-voc-export/`처럼 읽기 전용 evidence root만 허용한다. |
| risky PR diff | VOC 자동화 PR에 secret-like 값이나 risky shell material이 들어가면 출시 전 검토가 필요하다. | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/risky.diff` | `REVIEW` | PR comment나 CI artifact에서 사람이 위험 변경을 확인하고 수정 지시를 남길 수 있다. | secret-like material을 제거하고 운영 명령은 정책 또는 승인 report에 남긴다. |
| fixed PR diff | 수정된 PR diff가 같은 surface에서 재검토된다. | `node dist/index.js scan-diff < examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `examples/ax-rollout-before-after/commerce-voc-pr-diff/fixed.diff` | `PASS` | 위험 입력이 제거된 뒤 reviewer가 출시 후보로 볼 수 있는 evidence가 남는다. | 같은 command로 재실행한 결과가 `PASS`여야 하며, business approval note에는 "VOC 자동화는 제한된 fixture와 승인된 권한에서만 진행"이라고 적는다. |

## 심사자 설명 순서

1. 회사 문제: "커머스 VOC 운영팀이 환불, 쿠폰, CRM 메모 초안을 에이전트에게 맡기려 한다."
2. 위험 surface: AgentGuard가 지금 보여주는 범위는 MCP config와 PR diff이다.
3. 증거 카드: risky fixture는 `BLOCK`/`REVIEW`, fixed fixture는 `PASS`로 연결한다.
4. 승인 조건: 넓은 파일 권한, credential passthrough, secret-like diff가 제거된 경우에만 rollout 후보로 본다.

## Public reference grounding

| Reference | 빌릴 점 / borrow | 피할 점 / avoid | 이 증거 카드에서의 적용 |
|---|---|---|---|
| https://github.com/snyk/agent-scan | agent와 MCP scanner surface를 reviewer가 바로 이해하는 말로 설명한다. | 같은 제품 범위나 시장 채택을 주장하지 않는다. | AgentGuard surface를 `scan-mcp` MCP config와 `scan-diff` PR diff fixture로만 적는다. |
| https://github.com/Tencent/AI-Infra-Guard | AI infrastructure guardrail이라는 넓은 문제 framing을 빌린다. | 전체 AI infra 보안 플랫폼처럼 말하지 않는다. | 문서는 rollout gate evidence이며, scanner 동작이나 platform scope를 넓히지 않는다. |
| https://github.com/splx-ai/agentic-radar | agentic workflow scanner positioning을 참고한다. | runtime monitoring이나 넓은 workflow coverage를 제공한다고 말하지 않는다. | commands는 기존 `scan-mcp`와 `scan-diff` fixture 네 개로 제한한다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | CI와 reviewer artifact로 evidence를 남기는 방식을 참고한다. | GitHub security products의 역할까지 수행한다고 말하지 않는다. | SARIF/CI 문맥은 artifact framing으로만 쓰고, 이 index는 사람이 읽는 one-page handoff로 둔다. |

## 정직성 가드레일

- 이 문서는 합성 fixture 기반 증거 카드이며 실제 조직, 실사용자, 배포 실적을 말하지 않는다.
- AgentGuard는 현재 `scan-mcp`와 `scan-diff` 결과를 보여준다. 이 문서는 scanner behavior, rule IDs, CLI command names를 변경하지 않는다.
- 공개 reference는 설명 언어와 reviewer artifact framing을 빌리는 근거이며, 인증이나 제품 동등성을 의미하지 않는다.
