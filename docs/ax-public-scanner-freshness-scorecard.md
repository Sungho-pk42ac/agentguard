# AX public scanner freshness scorecard

한국어 우선으로 public AI-agent/MCP scanner 신호를 최신성 점검표로 정리하되, AgentGuard를 전체 scanner나 red-team 제품으로 과장하지 않는 AX judge-facing card입니다. 이 문서는 scanner runtime, severity policy, CLI commands, rule IDs, JSON/SARIF/API/machine fields를 stable contract로 두고, 대상권 설명에서 "현재 public ecosystem을 알고 있고 로컬 evidence로 좁혀 증명한다"는 근거만 제공합니다.

## 목적

대상권/AX judging에서는 public scanner ecosystem을 아는지, 어떤 pattern을 빌리고 어떤 claim을 피하는지, 그리고 30초 안에 어떤 local evidence를 재현할 수 있는지가 중요합니다. 이 scorecard는 공식 AX page, OWASP/MCP guidance, Snyk, Tencent, splx-ai, GitHub code scanning/SARIF reference를 제품 비교표가 아니라 freshness signal과 reviewer handoff vocabulary로 사용합니다.

## Public scanner freshness scorecard

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [AX official page](https://hackathon.jocodingax.ai/) | `AX 인재전쟁 2026 - 진짜 AI 인재를 찾는다`, `국내 대표 기업이 AI 인재를 채용합니다`처럼 회사 문제 적응력과 실무형 산출물 프레임. | gated portal scoring, final company problem, private submission requirements를 안다고 말하지 않는다. | unknown company problem을 받으면 current PR/MCP/transcript/SARIF proof lane으로 빠르게 매핑하는 local evidence checklist를 유지한다. |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | `Agentic AI - OWASP Lists Threats and Mitigations`의 agent/tool risk와 mitigation/control vocabulary. | OWASP endorsement, broad AI risk coverage, runtime firewall claim. | 위험 surface를 PR diff, MCP config, transcript/log evidence와 reviewer approval condition으로 좁힌다. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | `Security Best Practices - Model Context Protocol`와 `Security considerations, attack vectors, and best practices for MCP implementations`의 least-privilege/authorization-boundary language. | MCP server runtime enforcement, OAuth/session/consent implementation claim. | `scan-mcp` fixture evidence로 broad filesystem, writable path, credential passthrough approval risk를 보여준다. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) / [npm registry](https://registry.npmjs.org/agent-scan) | AI agents, MCP servers, agent skills처럼 scanner category를 선명하게 나누는 언어와 `agent-scan 0.0.1` / `Detect suspicious AI agents activities on GitHub` category-pressure signal. | Snyk 범위나 대형 scanner coverage를 AgentGuard 범위처럼 말하지 않는다. | AgentGuard는 Korean-first rollout approval/evidence layer로 좁혀 설명하고 PR diff, MCP config, transcript/log evidence를 fixture로 재실행한다. |
| [npm `agent-security-scanner-mcp` registry metadata](https://registry.npmjs.org/agent-security-scanner-mcp) | `agent-security-scanner-mcp 4.4.12`와 model-context-protocol security scanner registry signal처럼 MCP scanner category가 별도 시장 신호로 존재한다는 점. | registry fallback, not human-facing product-page proof; popularity, production-use proof, endorsement, same-scope claim, 또는 implemented runtime MCP scanner breadth로 말하지 않는다. | registry-only 신호는 category pressure로만 쓰고, AgentGuard action은 현재 `scan-mcp` fixture evidence와 reviewer approval owner로 제한한다. |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | agent scan, MCP scan, skills scan, infra scan처럼 broad AI security taxonomy를 구분하는 언어. | infra-wide 분석 suite나 CVE coverage를 가진다고 말하지 않는다. | broad taxonomy를 AgentGuard의 현재 PR/MCP/transcript/SARIF evidence actions로 축소해 reviewer가 실행할 command로 연결한다. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | workflow-oriented LLM agentic scanner framing과 agentic risk discovery vocabulary. | 추상적인 "agentic security" copy만 쓰거나 runtime discovery breadth를 가진다고 말하지 않는다. | every comparison row 옆에 exact fixture-backed command를 붙여 local proof 없이 claim만 남지 않게 한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) / [SARIF support](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | `SARIF support for code scanning - GitHub Docs`의 artifact, finding, location, reviewer route vocabulary. | GitHub code scanning parity, external assurance, 또는 upload workflow가 이 문서로 완성된다고 말하지 않는다. | `scan-diff --sarif --out` command로 local SARIF artifact를 만들고 CI/GitHub upload는 별도 owner가 연결할 handoff로 남긴다. |

## Fresh public-signal rows checked in this run

| Public signal | Freshness cue checked | Borrow | Avoid | AgentGuard action |
|---|---|---|---|---|
| AX official page | `AX 인재전쟁 2026 - 진짜 AI 인재를 찾는다`; `국내 대표 기업이 AI 인재를 채용합니다`. | company-problem adaptation and real-business outcome framing. | final company problem, private scoring rubric, or portal-only facts. | Keep the scorecard tied to current local commands and unknown-company-problem proof lanes. |
| OWASP Agentic AI guidance | `Agentic AI - OWASP Lists Threats and Mitigations`. | agent/tool threat and mitigation language. | OWASP endorsement, all-in-one AI security suite, or runtime firewall claim. | Map threat language to PR diff, MCP config, transcript/log, and reviewer approval evidence. |
| MCP Security Best Practices | `Security Best Practices - Model Context Protocol`; `Security considerations, attack vectors, and best practices for MCP implementations`; current MCP security URL HTTP 200 via normal public fetch; insane-search escalation not required. | least privilege, authorization boundary, and MCP risk language. | runtime MCP consent/OAuth/session enforcement claim. | Keep `scan-mcp` evidence static and fixture-backed while naming approval risks clearly. |
| Snyk agent-scan README and registry | agent/MCP/skills scanner category plus MCP execution-consent warning; `agent-scan 0.0.1`; `Detect suspicious AI agents activities on GitHub`. | agent, MCP server, and skill scanner category language. | Snyk parity or execution claim; AgentGuard does not execute MCP servers. | Keep the local commands limited to `scan-diff`, `scan-mcp`, and `scan-log` fixture evidence. |
| npm agent-security-scanner-mcp registry | `agent-security-scanner-mcp 4.4.12`; model-context-protocol security scanner registry signal; registry fallback, not human-facing product-page proof. | MCP scanner category pressure and package metadata freshness language. | package popularity, production-use proof, formal-assurance, public scanner substitute claim, or runtime MCP enforcement claim. | Treat the registry row as public fallback evidence only and keep the proof path on `scan-mcp` plus approval-owner review. |
| Tencent AI-Infra-Guard README | AI security taxonomy plus release-signal freshness. | Broad AI security taxonomy and release freshness language. | infra-wide red-team suite or CVE replacement; keep a no CVE coverage claim. | Map the taxonomy back to exact PR/MCP/transcript/SARIF evidence actions only. |
| splx-ai agentic-radar README | workflow-oriented agentic security scanner framing. | Workflow-oriented scanner framing for agentic risk review. | vague agentic-security copy without local commands. | Pair each public framing point with the fixture-backed commands below. |
| GitHub SARIF upload and support docs | artifact/reviewer handoff vocabulary for SARIF files; `SARIF support for code scanning - GitHub Docs`. | SARIF artifact, upload input, support boundary, and reviewer handoff terms. | GitHub alert ownership, no upload/triage automation claim, or automatic upload scope. | Produce the local SARIF artifact and leave upload or triage to a repository-owned workflow. |

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
