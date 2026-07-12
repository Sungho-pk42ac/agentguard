# AX evidence-to-approver channel map

## 목적

AX Rollout Guard 데모에서 심사위원과 현업 승인자가 묻는 질문은 단순히 “스캐너가 무엇을 찾았나?”가 아니라 “그 finding을 어떤 증거로 재현하고, 어느 승인 채널로 넘기며, 어떤 조건에서 배포를 막거나 재실행하는가?”입니다.

이 문서는 현재 AgentGuard가 이미 생성할 수 있는 `PR diff`, `MCP config`, `Transcript/log`, `SARIF handoff` 증거를 승인자 채널까지 연결하는 한국어 우선 handoff 카드입니다. CLI commands, rule IDs, `PASS`, `REVIEW`, `BLOCK`, JSON/SARIF machine fields는 English-compatible contract로 유지합니다.

## Public references

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI Threats and Mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic AI risk를 threat → mitigation → owner 언어로 정리합니다. | OWASP가 AgentGuard를 검증했다거나 전체 보안 플랫폼과 동등하다고 말하지 않습니다. | finding을 업무 위험, 통제 조건, 재실행 명령, 승인자 action으로 번역합니다. |
| Model Context Protocol Authorization — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | authorization, redirect/session/state 경계를 승인 채널과 신뢰 경계로 설명합니다. | AgentGuard가 runtime OAuth state, redirect URI, session enforcement를 수행한다고 말하지 않습니다. | `scan-mcp`/`scan-log` 결과를 “정적 사전 점검 증거 + 사람이 승인할 질문”으로 라우팅합니다. |
| GitHub SARIF upload/code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF를 reviewer-visible artifact로 전달하는 방식을 빌립니다. | SARIF가 자동 승인, 자동 업로드, 자동 triage를 끝낸다고 말하지 않습니다. | `scan-diff --sarif --out ...` artifact를 코드 리뷰/보안 리뷰 채널의 source-of-record로 지정합니다. |

## Approver channel map

| Evidence surface | Exact fixture-backed command | Primary approver channel | Decision language | Rerun trigger |
|---|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | PR reviewer / tech lead | `BLOCK`이면 merge 중지, secret 또는 dangerous command 제거 후 재실행 | diff 변경, policy 변경, finding waiver 요청 |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | 보안 담당자 / 플랫폼 owner | `REVIEW`/`BLOCK`이면 filesystem root, writable path, credential passthrough를 승인 조건으로 분리 | MCP server 추가, root/path/command 권한 변경 |
| Transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | 업무 owner / 운영 승인자 | denied command 또는 approval-required operation은 업무 목적·rollback 조건 확인 전 배포 보류 | agent run 재실행, 정책 deny/allow 변경, 민감 경로 접근 발견 |
| SARIF handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-to-approver-channel-map/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | GitHub code scanning reviewer / security reviewer | SARIF result는 reviewer가 위치·ruleId·severity를 확인하는 artifact; approval 자체는 사람/조직 프로세스가 결정 | PR head SHA 변경, SARIF artifact 재생성, code scanning workflow 조건 변경 |

## Fixture-backed evidence commands

Fresh clone 기준:

```bash
npm ci
npm run build
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-to-approver-channel-map/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

위 명령은 demo fixture를 source-of-record로 삼습니다. `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, `examples/agent-policy.yaml`가 갱신되면 문서의 기대 설명도 다시 검토해야 합니다.

## Machine-contract boundary

- Verdict vocabulary는 `PASS`, `REVIEW`, `BLOCK` 그대로 유지합니다.
- CLI surfaces는 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` 그대로 유지합니다.
- JSON/SARIF fields such as `ruleId`, `artifactLocation.uri`, `tool.driver.name` remain English-compatible.
- Rule IDs such as `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`는 CI, SARIF, reviewer tooling이 읽는 계약이므로 이름을 유지합니다.
- Korean-first wording은 승인 설명, 업무 위험, 조치 조건, 발표 스크립트에만 적용합니다.

## Non-claim guardrails

- 실제 고객사 도입, 공식 인증, OWASP/GitHub/Snyk endorsement를 주장하지 않습니다.
- AgentGuard는 runtime OAuth authorization, redirect URI, session enforcement를 수행한다고 주장하지 않습니다.
- SARIF artifact는 reviewer handoff 증거이며, 자동 업로드·자동 승인·자동 조치를 의미하지 않습니다.
- 이 카드는 current CLI evidence를 승인 채널에 연결하는 문서입니다. SaaS auth, billing, hosted dashboard, runtime policy enforcement 구현 범위가 아닙니다.
