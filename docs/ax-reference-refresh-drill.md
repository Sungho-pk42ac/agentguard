# AX reference refresh drill

이 문서는 AgentGuard를 AX Rollout Guard로 설명하기 전, 공개 레퍼런스가 바뀌었는지 30분 안에 다시 확인하고 judge-visible evidence로 낮추는 한국어 우선 refresh drill입니다. 목표는 대상권(target-prize) 심사에서 "외부 기준을 읽고, 과장 없이, 바로 실행 가능한 증거로 바꾸는 팀"처럼 보이게 하는 것입니다.

범위는 문서와 증거 명령뿐입니다. AgentGuard, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `secret.github_token`, `mcp.broad_filesystem_access`, rule IDs, SARIF fields는 machine-facing contract로 유지합니다.

## 30-minute drill

1. Public signal을 하나 고른다.
2. 최신 공개 페이지가 HTTP 200으로 열리는지 확인하고, 제목과 날짜 또는 README 첫 설명을 기록한다.
3. Borrow / Avoid / AgentGuard action을 한 줄씩 쓴다.
4. 아래 fixture-backed command 중 하나로 judge-visible evidence를 만든다.
5. Markdown report, SARIF, PR comment, worksheet 중 어디에 남길지 적는다.

## Public signal refresh table

| Public signal | Borrow | Avoid | AgentGuard action | Evidence command | Freshness check |
|---|---|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agent autonomy, tool-use risk, mitigation vocabulary를 agent rollout 설명에 빌린다. | Avoid: OWASP 보증, 공식 검토, 전체 대응처럼 말하지 않는다. | AgentGuard action: PR diff와 transcript/log evidence를 tool misuse와 승인 조건 언어로 연결한다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | Freshness check: refresh 때 HTTP 200, 제목, 게시일 또는 last checked 날짜를 기록한다. |
| [MCP security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | Borrow: consent, credential, confused deputy, least privilege framing을 MCP approval 설명에 빌린다. | Avoid: MCP 공식 적합성이나 기본 차단 정책 변경처럼 말하지 않는다. | AgentGuard action: broad filesystem, writable path, credential passthrough를 승인 전 수정 조건으로 적는다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Freshness check: 최신 페이지 redirect와 HTTP 200을 확인하고 permission/credential 표현이 바뀌었는지 본다. |
| [GitHub SARIF support for code scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Borrow: SARIF rule, result, location, fingerprint evidence routing을 빌린다. | Avoid: GitHub code scanning을 대체하거나 CLI/rule IDs를 presentation용으로 바꾼다고 말하지 않는다. | AgentGuard action: Markdown과 SARIF를 같은 finding의 reviewer evidence로 설명한다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | Freshness check: refresh 때 supported SARIF terms와 redirected docs URL을 last checked로 남긴다. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Borrow: AI agents, MCP servers, agent skills처럼 category를 선명하게 나누는 표현을 빌린다. | Avoid: Snyk enterprise 범위, 운영 실적, 대형 vendor 기능을 AgentGuard 범위처럼 말하지 않는다. | AgentGuard action: AgentGuard는 PR diff, MCP config, transcript/log의 rollout evidence gate라고 좁혀 말한다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Freshness check: README 첫 설명, security warning, latest visible repo state를 refresh note에 적는다. |
| [AX hackathon](https://hackathon.jocodingax.ai/) | Borrow: real-company-problem, 짧은 demo, 현업 통과 여부 중심의 압축을 빌린다. | Avoid: 비공개 심사표, 실제 회사 데이터, 평가 portal 세부를 아는 것처럼 말하지 않는다. | AgentGuard action: 회사 문제를 `BLOCK -> 수정 조건 -> PASS` evidence story로 바꾼다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Freshness check: refresh 때 public page title과 visible schedule/context만 last checked로 적는다. |

## Evidence commands

아래 명령은 모두 현재 저장소의 합성 fixture-backed input만 사용합니다. 발표 전 `npm run build` 후 실행하면 built CLI surface와 연결됩니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

전역 CLI 설명에서는 같은 surface를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 읽습니다. 명령 이름, rule IDs, verdict 값, JSON/SARIF field는 영어 machine contract로 둡니다.

## Freshness note template

```text
Last checked: YYYY-MM-DD UTC
Public signal:
Observed public facts:
Borrow:
Avoid:
AgentGuard action:
Evidence command:
Evidence surface: Markdown / SARIF / PR comment / worksheet
```

## Safe phrasing

- "공개 문서의 threat/mitigation 언어를 빌려 AgentGuard evidence 설명을 선명하게 합니다."
- "AgentGuard는 현재 저장소 fixture 기준으로 PR diff, MCP config, transcript/log를 rollout approval evidence로 만듭니다."
- "SARIF와 Markdown은 같은 finding을 reviewer가 볼 수 있는 artifact로 남기는 경로입니다."

## Non-claims

- 실제 고객 자료, private transcript, real secrets를 사용하지 않습니다.
- 외부 기관 보증, 운영 도입 실적, 독점 지위, vendor-scale 기능을 말하지 않습니다.
- CLI behavior, detector severity, default policy, package metadata, rule IDs는 이 drill로 바꾸지 않습니다.
- public research refresh는 데모 전 표현과 evidence routing을 새로 확인하는 절차이며, 새로운 scanner 동작을 추가하지 않습니다.
