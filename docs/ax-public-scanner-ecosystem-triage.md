# AX public scanner ecosystem triage

한국어 우선으로 public AI-agent/MCP scanner ecosystem 신호를 정리하되, AgentGuard의 현재 범위를 과장하지 않는 triage card입니다. 이 문서는 scanner behavior를 바꾸지 않고, CLI commands, rule IDs, JSON/SARIF/API/machine fields를 English-compatible contract로 유지합니다.

## 사용 목적

AX Rollout Guard 설명에서 public reference를 "우리가 베끼는 제품 목록"이 아니라 reviewer가 이해할 수 있는 위험 언어와 evidence routing vocabulary로 사용합니다. Borrow는 발표/문서에서 빌릴 framing이고, Avoid는 말하지 않을 claim이며, AgentGuard action은 현재 repo fixture로 재실행 가능한 증거만 적습니다.

## Public scanner ecosystem signal table

| Public ecosystem signal | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Agentic workflow risk, tool misuse, data exposure, approval boundary language. | OWASP가 AgentGuard를 평가했다거나 모든 agentic threat를 덮는다고 말하지 않는다. | PR diff, MCP config, transcript/log를 각각 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` evidence로 분리한다. |
| [GitHub SARIF upload](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF artifact handoff, upload step, reviewer-visible code scanning vocabulary. | GitHub upload workflow가 이 문서만으로 자동 구성된다고 말하지 않는다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-ecosystem-triage.sarif`로 local SARIF artifact를 만들고 CI owner가 upload workflow를 별도 연결한다. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Public scanner shape for agent-facing files and agent risk review. | Snyk agent-scan과 같은 대형 벤더 범위라고 말하지 않는다. | AgentGuard는 현재 fixture-backed PR/MCP/log evidence와 Korean operator handoff에 집중한다. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | Agent/LLM application risk discovery vocabulary and triage framing. | agentic-radar와 같은 runtime discovery breadth를 가진다고 말하지 않는다. | 발견 신호를 AgentGuard의 static/local evidence surfaces로만 라우팅한다. |
| [affaan-m agentshield](https://github.com/affaan-m/agentshield) | Prompt/tool boundary and agent interaction risk framing. | prompt firewall, runtime containment, 또는 universal guardrail이라고 말하지 않는다. | transcript/log review evidence로 승인 필요 행동을 기록한다. |
| [Cisco AI Defense mcp-scanner](https://github.com/cisco-ai-defense/mcp-scanner) | MCP server/config review, least-privilege, permission boundary language. | Cisco AI Defense나 MCP 생태계의 공인 상태를 얻었다고 말하지 않는다. | `mcp.broad_filesystem_access` 같은 rule IDs와 MCP fixture evidence로 scope를 좁힌다. |
| [Vercel CLI docs](https://vercel.com/docs/cli) | CLI onboarding/status polish benchmark: clear install, command, status, artifact wording. | Security comparison이나 보안 도구 비교 기준으로 쓰지 않는다. | 아래 fixture-backed `node dist/index.js scan-diff`, `scan-mcp`, `scan-log`, `scan-diff --sarif --out` command와 expected artifact path를 짧고 재실행 가능하게 쓴다. |

## Fixture-backed evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

| Evidence surface | Exact command | Fixture input | Expected evidence |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | PR diff risk findings for secret-like or risky shell material. |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP config findings for broad filesystem, writable path, or credential passthrough risk. |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | Policy-backed review evidence for agent shell behavior. |
| SARIF artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-ecosystem-triage.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Machine-readable SARIF artifact for security reviewer handoff. |

## Machine-contract guardrails

- CLI commands stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- rule IDs stay stable for automation and reviewer search: `secret.github_token`, `mcp.broad_filesystem_access`.
- JSON and SARIF field names stay machine-facing. SARIF vocabulary includes `version`, `$schema`, `runs`, `tool.driver.name`, `results`, `ruleId`, `locations`, `physicalLocation`, `artifactLocation.uri`, and `region.startLine`.
- Korean-first copy may explain verdicts and reviewer action, but it must not rename CLI commands, rule IDs, JSON, SARIF, API, or machine fields.

## Claim guardrails

- 말할 수 있는 것: public references에서 위험 언어와 reviewer handoff vocabulary를 빌리고, AgentGuard의 current fixture-backed evidence로 PR diff, MCP config, transcript/log, SARIF artifact를 재실행한다.
- 말하지 않는 것: 입증되지 않은 운영 실적, 외부 기관 보증, 경쟁 도구와 같은 범위라는 주장, 런타임 차단 제품이라는 표현, 전면적 플랫폼 범위 주장.
- Vercel CLI reference는 CLI onboarding/status polish benchmark로만 사용한다; security benchmark가 아니다.
- GitHub SARIF reference는 upload workflow vocabulary를 빌리는 것이다. 이 문서나 local SARIF file만으로 GitHub alert triage가 끝났다고 말하지 않는다.
