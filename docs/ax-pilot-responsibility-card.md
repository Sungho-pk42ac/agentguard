# AX pilot responsibility card

이 문서는 AgentGuard를 AX Rollout Guard로 설명할 때, `PASS / REVIEW / BLOCK` 결과를 파일럿 rollout 책임 분장으로 바꾸는 한국어 우선 handoff card입니다. 목표는 business approval, residual risk, rollback, evidence rerun의 소유자를 빠르게 정해 현업 파일럿 go/no-go 대화를 시작하는 것입니다.

범위는 문서와 fixture-backed evidence뿐입니다. CLI behavior, rule IDs, JSON/SARIF/API contracts, package metadata, product name은 바꾸지 않습니다.

## 사용 목적

파일럿 시작 전 5분 안에 다음 네 가지를 정합니다.

- 누가 business approval을 내릴 수 있는가.
- 누가 residual risk를 소유하고 예외 조건을 기록하는가.
- `BLOCK` 또는 높은 `REVIEW`가 나오면 누가 rollback을 지시하는가.
- 수정 뒤 같은 fixture-backed command로 evidence rerun을 누가 수행하고 보관하는가.

이 카드는 scanner verdict를 운영 책임으로 낮추는 문서입니다. AgentGuard는 PR diff, MCP config, transcript/log fixture evidence를 현재 구현 범위로 다루며, 더 넓은 보안 플랫폼이나 운영 SaaS 범위를 주장하지 않습니다.

## 책임 분장 카드

| Decision point | Owner | Input evidence | Required action |
|---|---|---|---|
| Business approval | 현업 업무 책임자 | `PASS` 또는 허용 가능한 `REVIEW` report | 파일럿 목적, 영향 범위, 승인 조건을 기록한다. |
| Residual risk | 보안/리스크 담당자 | `REVIEW` findings, `secret.github_token`, `mcp.broad_filesystem_access` 같은 rule IDs | 남는 위험, 보완 통제, 다음 점검일을 적는다. |
| Rollback | 운영/릴리즈 담당자 | `BLOCK` verdict 또는 credential/tool permission finding | rollout을 멈추고 risky PR/MCP/log 입력을 수정 대상으로 돌린다. |
| Evidence rerun | AgentGuard 운영자 | 같은 fixture와 같은 command | 수정 뒤 같은 command를 다시 실행하고 Markdown, JSON, SARIF, API evidence 위치를 남긴다. |

## 운영 책임자별 판단

- 현업 업무 책임자는 "이 agent가 지금 업무에 들어가도 되는가"만 결정합니다. 보안 예외나 scanner 기준을 임의로 바꾸지 않습니다.
- 보안/리스크 담당자는 residual risk와 compensating control을 적습니다. OWASP 또는 MCP 문서가 AgentGuard를 보증한다는 표현은 쓰지 않습니다.
- 운영/릴리즈 담당자는 `BLOCK`이면 rollback을 기본값으로 둡니다. severity, default policy, rule IDs는 이 카드에서 바꾸지 않습니다.
- AgentGuard 운영자는 same input class, same command, same output contract로 evidence rerun을 수행합니다.

## Fixture-backed evidence commands

아래 command는 모두 저장소의 합성 fixture만 사용합니다. 발표 전 `npm run build` 후 built CLI surface로 실행합니다.

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

Global install 설명에서는 같은 surface를 아래처럼 읽습니다.

```bash
agentguard scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
agentguard scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

Evidence handoff:

- PR diff: agent-visible code change와 secret-like material을 확인한다.
- MCP: broad filesystem, writable path, credential passthrough를 확인한다.
- Transcript/log: agent shell behavior와 policy review 조건을 확인한다.
- Machine contracts: CLI commands, rule IDs, JSON, SARIF, API, machine fields는 English-compatible contract로 유지한다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | agent autonomy, tool misuse, mitigation/control vocabulary를 빌린다. | OWASP 보증, 전체 위협 대응 완료, 공식 검토 완료처럼 말하지 않는다. | owner, risk, mitigation, rerun fields로 `REVIEW/BLOCK`을 책임 분장에 연결한다. |
| [MCP security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | least privilege, user consent, token handling, confused deputy framing을 빌린다. | MCP 표준 적합성이나 공식 호환성처럼 말하지 않는다. | MCP permission owner와 rerun condition을 카드에 넣는다. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | agent/MCP scanner category clarity를 빌린다. | vendor-scale coverage나 대형 보안 제품 parity를 말하지 않는다. | PR diff evidence와 agent-generated change review에 집중한다. |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | AI infra threat inventory와 agent/MCP category framing을 빌린다. | AgentGuard를 전체 AI 인프라 보안 제품처럼 말하지 않는다. | current scope를 PR diff, MCP config, transcript/log rollout evidence gate로 제한한다. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | agentic surface visibility와 workflow/tool/MCP framing을 빌린다. | attack simulation, dashboard, full observability parity를 말하지 않는다. | finding을 surface → owner → decision → rerun 순서로 운영 handoff한다. |

## Re-run and residual-risk rules

- `PASS`: business approval owner가 제한 파일럿 승인 조건을 기록한다.
- `REVIEW`: residual risk owner가 남는 위험과 보완 통제를 적고, 필요하면 rerun 전 수정 조건을 건다.
- `BLOCK`: rollback owner가 파일럿을 멈추고, evidence rerun owner가 수정 후 같은 command를 다시 실행한다.
- 재실행은 같은 fixture path와 같은 CLI surface로 수행한다. presentation을 위해 command, rule IDs, verdict vocabulary를 바꾸지 않는다.

## Non-claim guardrails

- 비공개 자료, private transcript, 운영 실적, 특정 회사 사용 사례를 주장하지 않습니다.
- 외부 기관 보증, 표준 적합성, 공식 검토 완료를 주장하지 않습니다.
- 운영형 웹 제품, 로그인, 과금, 고객 자료 업로드 기능은 이 카드 범위가 아닙니다.
- 모든 agent 보안 영역을 다루는 플랫폼이나 vendor 대체재를 주장하지 않습니다.
- 이 문서는 scanner verdict logic, severity/default policy, rule IDs, package publishing을 바꾸지 않습니다.
