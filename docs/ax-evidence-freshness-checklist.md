# AX evidence freshness checklist

이 문서는 AX Rollout Guard 데모 직전, 현재 증거가 unknown company problem에 다시 실행 가능한지 확인하는 한국어 우선 checklist입니다. 목표는 AX 인재전쟁 맥락에서 "회사 문제를 안전한 AgentGuard 증거로 낮추고, 공개 reference를 과장 없이 빌려 쓴다"를 보여주는 것입니다.

범위는 문서와 evidence freshness 확인뿐입니다. AgentGuard, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `secret.github_token`, `mcp.broad_filesystem_access`, rule IDs, verdict 값, JSON/SARIF field는 machine-facing contract로 유지합니다.

## 10-minute pre-demo checklist

1. 데모할 company problem을 한 문장으로 적는다.
2. PR diff, MCP config, transcript/log 중 어떤 AgentGuard surface가 증거가 되는지 고른다.
3. 아래 fixture-backed command를 `npm run build` 후 다시 실행한다.
4. 결과가 `BLOCK`, `REVIEW`, `PASS` 중 어떤 verdict인지 기록한다.
5. public reference에서 Borrow / Avoid / AgentGuard action을 한 줄씩 확인한다.
6. SARIF가 필요한 handoff라면 SARIF command도 실행해 fresh artifact를 만든다.
7. private customer data, real secrets, portal-only judging detail을 말하지 않는지 마지막으로 지운다.

## Public reference freshness map

| Public reference | Borrow | Avoid | AgentGuard action | Freshness proof |
|---|---|---|---|---|
| [AX hackathon](https://hackathon.jocodingax.ai/) | Borrow: result-first, company problem, 짧은 demo framing을 빌린다. | Avoid: public page 밖의 judging/submission detail이나 실제 회사 데이터를 아는 것처럼 말하지 않는다. | AgentGuard action: unknown company problem을 현재 fixture로 재실행 가능한 `BLOCK -> 수정 조건 -> PASS` evidence story로 바꾼다. | Freshness proof: public page가 HTTP 200으로 열리는지 보고, visible title/context와 last checked 날짜만 기록한다. |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agent autonomy, tool misuse, excessive agency, mitigation vocabulary를 빌린다. | Avoid: OWASP 보증, 검토 완료, 전체 대응 범위처럼 말하지 않는다. | AgentGuard action: PR diff와 transcript/log evidence를 tool misuse와 release approval condition 언어로 연결한다. | Freshness proof: `node dist/index.js scan-diff < examples/risky-pr.diff`를 재실행하고 last checked note에 public page title을 적는다. |
| [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) | Borrow: least privilege, token passthrough, user consent, authorization framing을 빌린다. | Avoid: MCP 적합성, 기본 policy 변경, complete MCP coverage처럼 말하지 않는다. | AgentGuard action: broad filesystem root, writable path, credential passthrough demo evidence를 배포 전 수정 조건으로 둔다. | Freshness proof: `node dist/index.js scan-mcp < examples/risky-mcp.json`를 재실행하고 permission/credential 표현이 바뀌었는지 메모한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF artifact를 reviewer/CI handoff로 남기는 방식을 빌린다. | Avoid: GitHub code scanning 역할을 대체하거나 AgentGuard가 GitHub 보안 제품이라고 말하지 않는다. | AgentGuard action: 같은 finding을 Markdown report와 SARIF artifact로 전달하는 optional evidence path를 보여준다. | Freshness proof: `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff`를 실행해 fresh SARIF 파일을 만든다. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Borrow: AI agent, MCP server, skill/config scanner category language를 빌린다. | Avoid: 대형 상용 제품 범위, 운영 실적, 같은 시장 범위를 주장하지 않는다. | AgentGuard action: Korean-first PR diff + MCP config + transcript/log rollout evidence gate로 좁혀 설명한다. | Freshness proof: `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log`를 재실행하고 README 첫 설명 또는 visible repo state를 적는다. |

## Fixture-backed commands

아래 명령은 모두 현재 저장소의 합성 fixture-backed input만 사용합니다. 실제 고객 자료, private transcript, real secret은 사용하지 않습니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff
```

전역 CLI 설명에서는 같은 surface를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 읽습니다. `BLOCK`, `REVIEW`, `PASS` verdict와 `secret.github_token`, `mcp.broad_filesystem_access`, rule IDs, JSON, SARIF field 이름은 자동화가 읽는 machine-facing contract입니다.

## Freshness note template

```text
Last checked: YYYY-MM-DD UTC
Company problem:
Public reference:
Observed public facts:
Borrow:
Avoid:
AgentGuard action:
Evidence command:
Expected verdict: BLOCK / REVIEW / PASS
Evidence surface: Markdown / JSON / SARIF / PR comment / worksheet
```

## Judge-safe phrasing

- "공개 reference의 threat/mitigation 언어를 빌려 현재 AgentGuard evidence 설명을 선명하게 합니다."
- "AgentGuard는 저장소 fixture 기준으로 PR diff, MCP config, transcript/log를 rollout approval evidence로 만듭니다."
- "SARIF는 reviewer/CI artifact handoff이며, GitHub code scanning을 대체한다는 뜻이 아닙니다."
- "비공개 competition rule은 확인하지 않았고, public page에서 보이는 문제 framing만 사용합니다."

## No-claim guardrails

- 실사용 조직 이름, 운영 실적, private customer data, real secrets를 말하지 않습니다.
- 규격 심사 통과나 외부 기관 보증을 말하지 않습니다.
- OWASP, MCP, GitHub, Snyk가 AgentGuard를 승인했다는 표현을 쓰지 않습니다.
- 대형 상용 제품 범위나 전체 red-team coverage를 제공한다고 말하지 않습니다.
- CLI behavior, scanner rule, default severity, product name, package metadata는 이 checklist로 바꾸지 않습니다.
