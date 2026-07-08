# AX evidence expiry revalidation card

한국어 우선 judge-facing card입니다. AgentGuard evidence는 한 번 만든 스크린샷이나 리포트를 계속 믿는 자료가 아니라, 회사 문제 변경과 agent/tool surface 변경이 있으면 다시 실행해서 갱신해야 하는 synthetic fixture evidence입니다.

## 언제 evidence가 stale 되는가

Evidence는 아래 중 하나라도 바뀌면 stale로 표시하고 rerun합니다.

- 회사 문제 변경: 예선/본선 문제, 파일 형식, 배포 승인 기준, onsite 제약이 바뀐 경우.
- tool permission 변경: MCP root, writable path, shell 권한, connector scope, agent policy control이 바뀐 경우.
- secret/control 변경: secret detector 범위, policy aliases, approval wording, rollout control이 바뀐 경우.
- output contract/version 변경: AgentGuard version, command flags, JSON fields, SARIF fields, rule IDs, Markdown verdict semantics가 바뀐 경우.
- reviewer handoff 변경: SARIF artifact path, artifact hash/path, upload workflow condition, GitHub Actions step condition이 바뀐 경우.

## Revalidation commands

아래 명령은 기존 fixture로 재현되는 최소 rerun set입니다. 실행 전에 `npm run build`로 `dist/index.js`를 최신화합니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

기록할 evidence:

- command, AgentGuard version, output contract/version
- verdict summary: `PASS`, `REVIEW`, `BLOCK`
- fixture path: `examples/risky-pr.diff`, `examples/risky-mcp.json`, `examples/agent-policy.yaml`, `examples/agent-transcript.log`
- rerun reason: 회사 문제 변경, tool permission 변경, secret/control 변경 중 해당 항목

## SARIF handoff evidence

SARIF reviewer handoff는 artifact path와 hash를 함께 기록합니다. `.agentguard-demo/`는 데모 산출물 위치이며 자동 업로드를 의미하지 않습니다.

```bash
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

기록할 evidence:

- SARIF artifact path: `.agentguard-demo/agentguard.sarif`
- artifact hash/path: `sha256:<hash> .agentguard-demo/agentguard.sarif`
- upload workflow condition: GitHub Actions가 SARIF upload step을 실행하는 branch/event/permission 조건
- reviewer handoff: 누가 SARIF artifact와 Markdown summary를 검토했는지

## Machine-contract boundaries

한국어 문서는 운영 맥락과 승인 문장을 설명합니다. 아래 machine-facing 계약은 한국어로 바꾸지 않습니다.

- CLI examples: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- rule IDs
- JSON
- SARIF
- API
- machine fields
- output contract/version

필드 안정성은 AgentGuard가 테스트하는 자체 계약에 한정합니다. 외부 scanner나 GitHub upload 결과의 field stability까지 보장한다고 말하지 않습니다.

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://hackathon.jocodingax.ai/ | 회사 문제, 실제 산출물, judge-readable framing | gated scoring이나 최종 회사 문제를 안다고 주장 | 회사 문제 변경 시 stale evidence로 표시하고 rerun |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic risk/control/mitigation vocabulary | OWASP coverage나 official status 주장 | tool permission, secret, control 변경을 rerun trigger로 둠 |
| https://raw.githubusercontent.com/snyk/agent-scan/main/README.md | agent component, MCP, skills scan category와 CLI-output caution | Snyk parity나 enterprise-scale coverage 주장 | output contract/version을 evidence에 기록하고 field stability를 자체 테스트 범위로 제한 |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF artifact upload와 reviewer handoff vocabulary | upload/triage가 자동으로 끝난다고 주장 | SARIF artifact hash/path와 upload workflow condition을 함께 기록 |

## Non-claim guardrails

- No customer claim: fixture evidence는 synthetic fixture evidence입니다.
- No certification claim: OWASP, Snyk, GitHub의 보증이나 심사를 뜻하지 않습니다.
- No parity claim: AgentGuard는 외부 scanner를 대체한다고 말하지 않는 AX rollout guard evidence slice입니다.
- No broad-platform claim: 모든 red-team 범위나 전체 coverage를 제공한다고 말하지 않습니다.
- No product-scope expansion: scanner behavior, CLI flags, rule IDs, JSON/SARIF schema, package metadata는 이 card의 범위 밖입니다.
- No naming expansion: dashboard, authentication, real credential handling, product rename은 이 card의 범위 밖입니다.
