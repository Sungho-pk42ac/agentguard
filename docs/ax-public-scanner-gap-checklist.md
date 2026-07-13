# AX public scanner gap checklist

한국어 우선으로 public AI-agent/MCP scanner와 AgentGuard의 차이를 심사위원이 바로 볼 수 있게 정리한 gap-to-demo checklist입니다. 이 문서는 scanner behavior를 바꾸지 않고, CLI commands, rule IDs, JSON/SARIF/API/machine fields를 English-compatible contract로 유지합니다.

## 대상권 포지셔닝

대상권 설명은 "public scanner보다 크다"가 아니라 "public scanner가 말하는 agent/tool risk를 한국 팀의 rollout approval evidence로 라우팅한다"입니다. AgentGuard는 현재 로컬 fixture-backed evidence를 통해 PR diff, MCP, transcript/log, SARIF handoff를 보여줍니다. 심사위원에게는 아래 질문으로 좁혀 말합니다.

| Judge question | AgentGuard answer | Exact proof |
|---|---|---|
| AI agent가 코드/PR에 위험한 값을 새로 넣었는가? | PR diff에서 secret-like material과 risky shell material을 분리해 보여준다. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` |
| MCP 권한이 너무 넓거나 writable path를 열었는가? | MCP config에서 broad filesystem, writable path, credential passthrough risk를 증거화한다. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` |
| agent transcript/log에서 승인자 검토가 필요한 행동이 보이는가? | policy-backed transcript/log review evidence를 만든다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` |
| 보안 reviewer에게 넘길 artifact가 있는가? | SARIF artifact를 만들어 GitHub code scanning upload vocabulary와 맞춘다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-gap-checklist.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` |

## Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | Prompt injection, sensitive information disclosure, supply-chain and model/tool risk vocabulary. | OWASP coverage 전체를 구현했다고 말하지 않는다. | LLM risk language를 PR diff, MCP, transcript/log evidence question으로만 좁힌다. |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Agentic workflow, tool misuse, data exposure, human approval boundary framing. | Agentic AI threat set 전체를 처리한다고 말하지 않는다. | agent/tool misuse language를 exact fixture-backed commands와 approval question에 붙인다. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) | Consent, least-privilege, confused-deputy, authorization boundary wording. | 실행 중 MCP 호출 정책 엔진이라고 말하지 않는다. | `mcp.broad_filesystem_access`와 `mcp.filesystem_writable_path` findings를 static MCP evidence와 승인 질문으로 라우팅한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file) | Third-party SARIF artifact handoff and reviewer-visible code scanning vocabulary. | local SARIF file만으로 GitHub alert triage가 끝났다고 말하지 않는다. | exact `--sarif --out` command와 artifact path를 reviewer handoff command로 적는다. |
| [snyk/agent-scan](https://github.com/snyk/agent-scan) | AI-agent scanner category language: agent components, MCP servers, tools, prompts, resources. | Snyk product breadth나 installed-agent inventory scope를 가진다고 말하지 않는다. | AgentGuard gap은 "installed inventory"가 아니라 "rollout evidence commands"로 설명한다. |
| [splx-ai/agentic-radar](https://github.com/splx-ai/agentic-radar) | Agentic system analysis, operational insight, vulnerability discovery vocabulary. | workflow visualization breadth를 가진다고 말하지 않는다. | discovery story 대신 PR/MCP/log/SARIF surface별 rerunnable proof를 제시한다. |
| [affaan-m/agentshield](https://github.com/affaan-m/agentshield) | Agent configuration, MCP server, tool permission scanner category language. | CLI, GitHub Action, app workflow breadth를 가진다고 말하지 않는다. | AgentGuard의 현재 proof는 local CLI fixture와 Korean operator handoff라고 선을 긋는다. |
| [`agent-security-scanner-mcp` npm package](https://www.npmjs.com/package/agent-security-scanner-mcp) | npm registry에서도 agent/MCP security scanner category가 생기고 있다는 packaging/discoverability pressure를 빌린다. | npm 생태계 breadth, package popularity, vendor endorsement, or comparable scanner coverage를 주장하지 않는다. | AgentGuard action은 새 package claim이 아니라 기존 `scan-diff`/`scan-mcp`/`scan-log`/SARIF fixture-backed proof를 한국어 rollout approval evidence로 라우팅하는 것이다. |

## Gap-to-demo checklist

| Public scanner expectation | Honest AgentGuard gap | Demo-safe phrasing | Fixture-backed proof |
|---|---|---|---|
| 자동 agent/component inventory | 현재 slice는 installed inventory 제품 설명이 아니다. | "우리는 설치 자산 전체 탐색보다 rollout approval evidence를 먼저 보여줍니다." | PR diff, MCP, transcript/log commands below. |
| agentic workflow graph discovery | workflow graph를 그린다고 말하지 않는다. | "workflow discovery 대신 위험 surface별 증거와 승인 질문을 분리합니다." | `scan-diff`, `scan-mcp`, `scan-log` outputs. |
| MCP consent and authorization control | 실제 MCP 서버 호출을 제어하지 않는다. | "MCP best-practice 질문을 static config evidence로 바꿔 승인자가 묻게 합니다." | MCP command plus `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`. |
| GitHub code scanning reviewer handoff | SARIF upload workflow 설정은 CI owner가 연결해야 한다. | "AgentGuard는 SARIF file을 만들고, upload step은 GitHub workflow에서 연결합니다." | SARIF command plus `.agentguard-demo/ax-public-scanner-gap-checklist.sarif`. |
| vendor-scale scanner catalog | public scanner catalog breadth를 주장하지 않는다. | "대상권 demo에서는 public scanner 언어를 빌려 현재 evidence gap을 정직하게 보여줍니다." | Borrow/Avoid/AgentGuard action table. |

## Fixture-backed evidence commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

| Evidence surface | Exact command | Existing fixture input | Judge-visible evidence |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | newly added secret-like or risky shell material in a PR diff. |
| MCP | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | broad filesystem, writable path, or credential passthrough risk. |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | policy-backed review evidence for agent shell behavior. |
| SARIF | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-gap-checklist.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | machine-readable SARIF artifact for security reviewer handoff. |

## Honest gaps

- AgentGuard does not claim 운영 도입 실적, public reference endorsement, or external audit status.
- AgentGuard does not claim the same scanner breadth as `snyk/agent-scan`, `splx-ai/agentic-radar`, or `affaan-m/agentshield`.
- AgentGuard does not claim npm ecosystem breadth, package popularity, vendor endorsement, or registry-scale scanner coverage from `agent-security-scanner-mcp`.
- AgentGuard does not claim to control live MCP server calls. It records static/local MCP evidence and approval questions.
- AgentGuard does not claim GitHub will triage alerts automatically. It emits SARIF; the upload workflow and reviewer process remain separate.
- AgentGuard does not rename CLI commands, rule IDs, JSON, SARIF, API, or machine fields for Korean copy.

## Non-claim guardrails

- 말할 수 있는 것: public references의 agent/tool misuse, data exposure, consent, least-privilege, confused-deputy, authorization boundary, SARIF handoff vocabulary를 빌려 현재 AgentGuard evidence commands로 라우팅한다.
- 말하지 않는 것: 입증되지 않은 운영 실적, 외부 기관 보증, public scanner와 같은 범위, live-control 제품, 전면적 보안 플랫폼.
- English-compatible contracts stay stable: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `rule IDs`, `JSON`, `SARIF`.
- Rule IDs and SARIF fields stay reviewer-searchable: `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `tool.driver.name`, `ruleId`, `artifactLocation.uri`.
