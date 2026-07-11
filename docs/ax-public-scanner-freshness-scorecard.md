# AX public scanner freshness scorecard

한국어 우선으로 public AI-agent/MCP scanner 신호를 최신성 점검표로 정리하되, AgentGuard를 전체 scanner나 red-team 제품으로 과장하지 않는 AX judge-facing card입니다. 이 문서는 scanner runtime, severity policy, CLI commands, rule IDs, JSON/SARIF/API/machine fields를 stable contract로 두고, 대상권 설명에서 "현재 public ecosystem을 알고 있고 로컬 evidence로 좁혀 증명한다"는 근거만 제공합니다.

## 목적

대상권/AX judging에서는 public scanner ecosystem을 아는지, 어떤 pattern을 빌리고 어떤 claim을 피하는지, 그리고 30초 안에 어떤 local evidence를 재현할 수 있는지가 중요합니다. 이 scorecard는 Snyk, Tencent, splx-ai, GitHub code scanning/SARIF reference를 제품 비교표가 아니라 freshness signal과 reviewer handoff vocabulary로 사용합니다.

## Public scanner freshness scorecard

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | AI agents, MCP servers, agent skills처럼 scanner category를 선명하게 나누는 언어. | Snyk 범위나 대형 scanner coverage를 AgentGuard 범위처럼 말하지 않는다. | AgentGuard는 Korean-first rollout approval/evidence layer로 좁혀 설명하고 PR diff, MCP config, transcript/log evidence를 fixture로 재실행한다. |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | agent scan, MCP scan, skills scan, infra scan처럼 broad AI security taxonomy를 구분하는 언어. | infra-wide 분석 suite나 CVE coverage를 가진다고 말하지 않는다. | broad taxonomy를 AgentGuard의 현재 PR/MCP/transcript/SARIF evidence actions로 축소해 reviewer가 실행할 command로 연결한다. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | workflow-oriented LLM agentic scanner framing과 agentic risk discovery vocabulary. | 추상적인 "agentic security" copy만 쓰거나 runtime discovery breadth를 가진다고 말하지 않는다. | every comparison row 옆에 exact fixture-backed command를 붙여 local proof 없이 claim만 남지 않게 한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF/code-scanning evidence handoff vocabulary: artifact, finding, location, reviewer route. | GitHub code scanning parity, external assurance, 또는 upload workflow가 이 문서로 완성된다고 말하지 않는다. | `scan-diff --sarif --out` command로 local SARIF artifact를 만들고 CI/GitHub upload는 별도 owner가 연결할 handoff로 남긴다. |

## Fresh public-signal rows checked in this run

| Public signal | Freshness cue checked | Borrow | Avoid | AgentGuard action |
|---|---|---|---|---|
| Snyk agent-scan README | agent/MCP/skills scanner category plus MCP execution-consent warning. | agent, MCP server, and skill scanner category language. | Snyk parity or execution claim; AgentGuard does not execute MCP servers. | Keep the local commands limited to `scan-diff`, `scan-mcp`, and `scan-log` fixture evidence. |
| Tencent AI-Infra-Guard README | AI security taxonomy plus release-signal freshness. | Broad AI security taxonomy and release freshness language. | infra-wide red-team suite or CVE replacement; keep a no CVE coverage claim. | Map the taxonomy back to exact PR/MCP/transcript/SARIF evidence actions only. |
| splx-ai agentic-radar README | workflow-oriented agentic security scanner framing. | Workflow-oriented scanner framing for agentic risk review. | vague agentic-security copy without local commands. | Pair each public framing point with the fixture-backed commands below. |
| GitHub SARIF upload docs | artifact/reviewer handoff vocabulary for SARIF files. | SARIF artifact, upload input, and reviewer handoff terms. | GitHub alert ownership, no upload/triage automation claim, or automatic upload scope. | Produce the local SARIF artifact and leave upload or triage to a repository-owned workflow. |

## AgentGuard evidence actions

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

| Evidence surface | Exact command | Fixture input | Reviewer action |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | PR diff에서 secret-like material 또는 risky shell addition을 reviewer가 확인한다. |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP config의 broad filesystem, writable path, credential passthrough risk를 승인 조건으로 보낸다. |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | agent transcript/log의 policy-sensitive action을 `REVIEW` evidence로 남긴다. |
| SARIF artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-public-scanner-freshness-scorecard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | machine-readable SARIF artifact를 security reviewer 또는 CI owner에게 넘긴다. |

## SARIF/reviewer handoff

- SARIF artifact는 GitHub-style code scanning vocabulary를 빌리는 local handoff evidence다. 이 문서만으로 upload workflow나 alert triage가 구성된다고 말하지 않는다.
- Reviewer memo에는 command, fixture input, artifact path, expected verdict, residual action을 남긴다.
- SARIF fields는 machine-facing contract다: `version`, `$schema`, `runs`, `tool.driver.name`, `results`, `ruleId`, `locations`, `physicalLocation`, `artifactLocation.uri`, `region.startLine`.
- Korean-first human copy는 reviewer 판단과 승인 조건을 설명하지만 SARIF field names는 그대로 둔다.

## Machine contracts

- CLI commands and option flags stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `--policy`, `--sarif`, `--out`.
- rule IDs stay stable for automation and reviewer search: `secret.github_token`, `mcp.broad_filesystem_access`.
- JSON and SARIF stay machine-facing. The scorecard may explain findings in Korean, while command names, rule IDs, JSON fields, SARIF fields, flags, and artifact paths stay exact.
- Fixture paths stay synthetic and rerunnable: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, `examples/agent-policy.yaml`.

## Non-claim guardrails

- 말할 수 있는 것: public scanner signals에서 category language와 reviewer handoff vocabulary를 빌리고, AgentGuard의 current fixture-backed evidence로 PR diff, MCP config, transcript/log, SARIF artifact를 재실행한다.
- 말하지 않는 것: 운영 실적, 외부 기관 보증, public scanner와 같은 범위라는 주장, runtime enforcement 제품이라는 표현, 전면적 보안 커버리지 주장.
- Snyk/Tencent/splx-ai/GitHub references는 비교 우위나 vendor 대체 주장이 아니라 freshness signal이다.
- 이 slice는 docs/tests only다. Scanner behavior, severity/blocking policy, JSON/SARIF schema, product name, hosted workflow, account system, or rollout feature scope를 바꾸지 않는다.
