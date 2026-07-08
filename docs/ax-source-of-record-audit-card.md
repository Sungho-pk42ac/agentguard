# AX source-of-record audit card

한국어 우선 설명으로 AX 심사자와 reviewer가 "무엇이 authoritative evidence인가?"를 한 장에서 확인하게 한다. 이 카드는 scanner behavior, CLI commands, rule IDs, severity/policy, JSON/SARIF/API machine contracts를 바꾸지 않고, 현재 repo fixture와 rerunnable command만 source-of-record로 묶는다.

## 사용 목적

Agent self-report는 감사 증거가 아니다. agent가 "검사했다", "안전하다", "수정했다"고 말해도 그것만으로는 승인 근거가 되지 않는다.

이 카드의 기준은 짧다: **agent self-report is not authoritative evidence; source-of-record is repo/CI/host artifact plus rerunnable command.**

심사 또는 운영 handoff에서는 agent transcript 요약보다 아래 조합을 우선한다.

| Audit question | Source-of-record |
|---|---|
| PR diff risk를 어디서 봤는가? | repo fixture, CI diff, 또는 host에 남은 diff artifact + `agentguard scan-diff` rerun command |
| MCP config 권한을 어디서 봤는가? | repo/host MCP config artifact + `agentguard scan-mcp` rerun command |
| agent transcript/log 행동을 어디서 봤는가? | repo/host transcript/log artifact + `agentguard scan-log` rerun command |
| SARIF output을 어디서 봤는가? | CI/host SARIF artifact + 같은 input으로 재생성 가능한 `scan-diff --sarif --out` command |

## Source-of-record principle

1. Agent 말은 clue이고, 승인 증거는 아니다.
2. 증거는 repo/CI/host artifact path와 rerunnable command가 함께 있어야 한다.
3. fixture는 synthetic이어야 하며 real credentials, private logs, customer data를 넣지 않는다.
4. reviewer가 같은 저장소 루트에서 command를 다시 실행해 같은 surface와 verdict를 확인할 수 있어야 한다.
5. CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine contracts는 English-compatible 형태로 유지한다.

## Fixture-backed audit commands

아래 command는 모두 현재 저장소의 synthetic examples만 사용한다. Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 저장소 루트에서 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

| Surface | Exact command | Fixture path | Source-of-record note |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` | PR diff source-of-record는 diff artifact와 rerunnable `agentguard scan-diff` command다. |
| MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | MCP config source-of-record는 checked-in or host MCP config artifact와 rerunnable `agentguard scan-mcp` command다. |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | transcript/log source-of-record는 log artifact, policy fixture, rerunnable `agentguard scan-log` command다. |
| SARIF output | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff`, `agentguard.sarif` | SARIF source-of-record는 generated SARIF artifact와 same-input regeneration command다. Risky findings may produce expected nonzero while still writing the artifact. |

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agent autonomy, tool misuse, sensitive data, and mitigation/control vocabulary를 빌려 reviewer language를 선명하게 한다. | Avoid: OWASP coverage, external assurance, or full agentic-security-suite claim. | AgentGuard action: `scan-log`, `scan-mcp`, `scan-diff` evidence를 각각 transcript/log, MCP config, PR diff source-of-record에 연결한다. |
| [MCP security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | Borrow: consent, token, redirect, SSRF, permission, credential-boundary framing을 빌린다. | Avoid: MCP conformance, runtime auth, OAuth/session enforcement, consent UI implementation claim. | AgentGuard action: `scan-mcp < examples/risky-mcp.json`로 broad filesystem access and credential passthrough evidence를 남긴다. |
| [GitHub SARIF support docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Borrow: SARIF rule/result/location artifact vocabulary를 빌려 CI/reviewer handoff를 설명한다. | Avoid: GitHub-native ownership, native app, or security-events workflow ownership claim. | AgentGuard action: `scan-diff --sarif --out agentguard.sarif`로 same finding을 machine-readable SARIF output에 남긴다. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Borrow: public agent-security scanner가 AI agents, MCP servers, skills 같은 surface를 나누는 방식을 참고한다. | Avoid: vendor-scale coverage, market adoption, or same-scope enterprise scanner claim. | AgentGuard action: 현재 source-of-record를 repo fixture + command + artifact receipt로 좁혀 설명한다. |

## Non-claim guardrails

- no external certification: 이 카드는 외부 감사, 보증, 표준 인증, security badge를 주장하지 않는다.
- no MCP conformance/runtime auth: 이 카드는 MCP spec 적합성, runtime authorization, OAuth/session enforcement, consent UI 구현을 주장하지 않는다.
- no vendor-scale coverage: 이 카드는 vendor-scale scanner coverage, same-scope enterprise platform, broad AI security suite 범위를 주장하지 않는다.
- no real customer/adoption claim: 이 카드는 실제 구매자, 운영 배포, 채택 실적, named deployment를 주장하지 않는다.
- No scanner behavior changes, no CLI command changes, no severity/policy changes, no SaaS/auth/dashboard claim, no product rename.
- CLI commands, rule IDs, verdict values, JSON fields, SARIF fields, API fields, and machine contracts stay English-compatible.
