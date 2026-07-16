# AX public scanner signal refresh ledger

## 목적

이 문서는 이번 hourly refresh에서 확인한 공개 scanner/reference 신호를 한국어 우선으로 정리해, AX Rollout Guard가 **unknown company problem**을 받았을 때 어떤 증거 lane으로 바로 전환할지 보여주는 judge-facing ledger입니다. 핵심은 public scanner ecosystem을 따라 하는 것이 아니라, AgentGuard의 `PR diff` / `MCP config` / `transcript/log` / `SARIF artifact` / `smoke manifest`를 **Korean-first rollout approval**과 **approval gate**로 묶는 것입니다.

## Fresh public signals checked this run

| Public signal | Observed cue | Borrow | Avoid | AgentGuard action |
|---|---|---|---|---|
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | `agent/MCP server/skill scanning` category is visible in the public repo description. | agent, MCP server, and skill inventory vocabulary. | vendor-grade market proof or product-equality wording. | Route the same risk language to fixture-backed `scan-diff`, `scan-mcp`, and `scan-log` evidence. |
| [agent-scan npm registry](https://registry.npmjs.org/agent-scan) | Public registry metadata describes `Detect suspicious AI agents activities on GitHub`, with latest version `0.0.1`. | AI-agent activity scanner package category pressure and GitHub activity-scan framing. | npm adoption, maturity, customer proof, or product-equality wording. | Keep AgentGuard stronger on rerunnable rollout evidence: PR diff, MCP config, transcript/log, SARIF, and smoke manifest source-of-record. |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | Public description frames an `AI infra guardrail` / red-team style toolchain. | broad AI infrastructure risk taxonomy. | broad suite positioning or all-risk coverage language. | Keep AgentGuard as a deterministic rollout gate with exact source-of-record commands. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | Public repo presents an `agentic workflow scanner`. | workflow attack-surface wording. | simulation-suite language or attack-lab scope. | Explain AgentGuard as pre-rollout evidence for PR/MCP/transcript surfaces. |
| [agentshield public repo](https://github.com/affaan-m/agentshield) | Public search result describes tool permission and MCP server checking. | `tool permission` and config-review vocabulary. | hosted app, auth, or monitoring claims. | Map permission risk to `mcp-filesystem-wide-root`, `mcp-env-token`, and policy review outputs. |
| [agent-security-scanner-mcp npm package](https://www.npmjs.com/package/agent-security-scanner-mcp) | npm package description frames AI agent, MCP server, code, and prompt scanning as a public package category. | package-distribution and agent/MCP scanner category pressure. | npm popularity, customer proof, parity, or replacement claims. | Keep AgentGuard evidence tied to local fixture commands while naming the package ecosystem pressure honestly. |
| [Proof Layer](https://www.proof-layer.com/) | Package metadata points to a vendor homepage, showing the signal is a public product/package surface. | packaging and public-facing scanner positioning cues. | deployment proof, commercial rollout, or vendor-backed assurance claims. | Treat the homepage only as source context; the AgentGuard action remains local CLI evidence and Korean approval handoff. |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Agentic AI threats include autonomy, tool misuse, and secret exposure language. | common risk language for judge explanation. | external assurance or endorsement phrasing. | Keep findings tied to local commands and remediation conditions. |
| [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) | Authorization guidance highlights client/server trust, session, state mismatch, trusted redirect URI, and token handling. | `authorization` and token-boundary framing. | live OAuth/session/consent control wording. | Frame `scan-mcp` as static preflight evidence for approval, not a live control. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | Security Best Practices guidance reinforces least privilege, explicit user consent, and token passthrough boundaries for MCP clients/servers. | `least privilege`, `explicit user consent`, and token passthrough review language. | claims that AgentGuard enforces live MCP consent, session binding, or runtime OAuth/token policy. | Route the guidance to static MCP config approval: broad roots and env passthrough stay `BLOCK`/`REVIEW` until the company narrows scope or records an owner. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF upload flow shows reviewer-facing security artifact handoff. | `SARIF artifact`, `ruleId`, and reviewer route vocabulary. | automatic upload/triage or GitHub-native product claims. | Keep `scan-diff --sarif --out` as a rerunnable artifact lane. |
| [OpenAI Agents SDK Guardrails](https://openai.github.io/openai-agents-python/guardrails/) | Public docs frame `input guardrails`, `output guardrails`, `tool guardrails`, and `tripwire` as workflow stop/review cues. | guardrail/tripwire vocabulary for why risky agent work should pause before rollout. | OpenAI SDK integration, runtime interception, or automatic policy enforcement claims. | Translate tripwire language into static `scan-diff`, `scan-mcp`, `scan-log`, and SARIF evidence plus a human approval decision. |
| [Claude Code Security](https://docs.anthropic.com/en/docs/claude-code/security) | Claude Code Security docs emphasize workspace trust, tool permission review, and human approval boundary for safe usage. | `workspace trust`, permission review, and human approval boundary wording. | Anthropic approval, private Claude workspace access, or runtime sandbox guarantee claims. | Route risky tool/workspace evidence to `MCP config` and `transcript/log` approval owners before rollout. |
| [GitHub SARIF support](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | SARIF support for code scanning describes result, rule, and location fields reviewers expect. | `SARIF support for code scanning` field vocabulary for machine-readable reviewer handoff. | saying AgentGuard replaces GitHub code scanning or that upload/triage is automatic. | Keep generated SARIF as reviewer-owned source-of-record evidence with unchanged `ruleId` and `locations` machine fields. |

## Research provenance for this refresh

| Source path | Run status | How to use it |
|---|---|---|
| Claude Code + insane-search path | Attempted, but blocked in this cron environment with `401 Invalid authentication credentials`. | Record as unavailable; do not describe the fallback research below as insane-search evidence. |
| `https://registry.npmjs.org/agent-scan` | Public registry metadata returned 200 with package name `agent-scan`, latest version `0.0.1`, and description `Detect suspicious AI agents activities on GitHub`. | Use only as AI-agent activity scanner package category pressure: AgentGuard should keep showing richer source-of-record evidence instead of claiming package-market proof. |
| `https://www.npmjs.com/package/agent-security-scanner-mcp` | Direct public page fetch returned HTTP 403 from this environment. | Treat the npm web page as a visible package signal only when a browser/user can confirm it; do not infer popularity or adoption. |
| `https://registry.npmjs.org/agent-security-scanner-mcp` | Public registry metadata returned 200 with package name `agent-security-scanner-mcp`, latest version `4.4.12`, and agent/MCP scanner category keywords. | Use only as category-pressure evidence: AI agent/MCP scanner packaging exists, so AgentGuard must show local rerunnable PR/MCP/transcript/SARIF proof rather than broad platform claims. |
| OWASP / MCP / GitHub docs URLs above | Public HTML fetch returned 200 for the reference pages used in this ledger, including MCP Security Best Practices. | Borrow risk, least privilege, explicit user consent, authorization-boundary, and artifact-handoff vocabulary while keeping every AgentGuard claim tied to source-of-record commands. |
| `https://openai.github.io/openai-agents-python/guardrails/` | Public HTML fetch returned 200 with title `Guardrails - OpenAI Agents SDK`. | Use tripwire language as judge-facing wording for stop/review decisions; do not claim OpenAI SDK integration or runtime guardrail enforcement. |
| `https://docs.anthropic.com/en/docs/claude-code/security` | Public HTML fetch returned 200 with title `Security - Claude Code Docs`. | Borrow workspace trust/tool permission/human approval boundary language; do not imply Anthropic approval, private workspace access, or sandbox guarantees. |
| `https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning` | Public HTML fetch returned 200 with title `SARIF support for code scanning - GitHub Docs`. | Borrow SARIF field and reviewer artifact vocabulary while keeping upload/triage/approval as owner-operated steps. |

## Public reference freshness snapshot

Checked on 2026-07-16 via public fallback fetch; insane-search escalation was not required because the public pages below returned usable unauthenticated responses in this run. This snapshot is a freshness boundary, not an endorsement, external assurance badge, or production-readiness claim.

| Reference | Fetch status | Observed title/signal | Borrow | Avoid |
|---|---|---|---|---|
| https://openai.github.io/openai-agents-python/guardrails/ | HTTP 200 | `Guardrails - OpenAI Agents SDK` | `input guardrails`, `output guardrails`, `tool guardrails`, and `tripwire` stop/review vocabulary. | OpenAI SDK integration, runtime interception, or automatic enforcement claim. |
| https://docs.anthropic.com/en/docs/claude-code/security | HTTP 200 | `Security - Claude Code Docs` | Workspace trust, tool permission review, and human approval boundary language. | Anthropic endorsement, private Claude workspace access, or sandbox guarantee claims. |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | HTTP 200 | `Security Best Practices - Model Context Protocol` | Least privilege, explicit user consent, and token/permission-boundary wording. | Live OAuth/session/consent control claim. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | HTTP 200 | `SARIF support for code scanning - GitHub Docs` | Reviewer-owned SARIF field/artifact vocabulary. | Automatic SARIF upload, triage, or GitHub-native approval claim. |
| https://github.com/snyk/agent-scan | HTTP 200 | `Security scanner for AI agents, MCP servers and agent skills` | Public category pressure for agent/MCP/skill scanner wording. | Snyk parity, vendor-scale scope, or replacement claim. |
| https://github.com/Tencent/AI-Infra-Guard | HTTP 200 | `A full-stack AI Red Teaming platform securing AI ecosystems` with OpenClaw Security Scan, Agent Scan, Skills Scan, MCP scan, AI Infra scan, and LLM jailbreak evaluation. | Multi-surface AI infrastructure risk taxonomy and scanner-lane naming. | Broad suite positioning, all-risk coverage, or vendor-scale platform claim. |
| https://github.com/splx-ai/agentic-radar | HTTP 200 | `A security scanner for your LLM agentic workflows` | Agentic workflow attack-surface vocabulary. | Attack-lab/simulation-suite scope or any claim that AgentGuard covers every workflow class. |
| https://github.com/affaan-m/agentshield | HTTP 200 | `AI agent security scanner. Detect vulnerabilities in agent configurations, MCP servers, and tool permissions` | Agent configuration, MCP server, tool-permission review phrasing. | Hosted app, GitHub App, ECC plugin, or monitoring feature claims not implemented here. |
| https://www.proof-layer.com/ | HTTP 200 | `ProofLayer — Autonomous Red-Teaming for AI Systems`; autonomous red-teaming evidence positioning. | Evidence-oriented reviewer handoff language. | Continuous attack, managed service, or external assurance claims. |

## Judge-visible action ledger

| Company-problem signal | AgentGuard evidence lane | Approval decision sentence |
|---|---|---|
| Enterprise wants to let an AI coding agent change repo code before human review. | `PR diff` evidence from `scan-diff` with `generic-secret-assignment` and `denied-command` rule IDs. | “위험 diff는 배포 전 BLOCK하고, secret 제거와 command policy 수정 후 같은 명령으로 재검증합니다.” |
| Enterprise connects a third-party MCP server or broad filesystem root. | `MCP config` evidence from `scan-mcp` with `mcp-filesystem-wide-root` and `mcp-env-token`. | “MCP 권한은 업무 폴더와 필요한 env key로 축소될 때까지 승인 보류합니다.” |
| Enterprise reviews agent transcript after a risky operation. | `transcript/log` evidence from `scan-log --policy` with `denied-command`. | “사람 승인 없는 삭제/export 흔적은 REVIEW로 남기고 owner가 policy 조건을 확정합니다.” |
| Reviewer asks whether evidence can be preserved outside the terminal. | `SARIF artifact` and `smoke manifest` evidence with `schemaVersion`, `gitCommitSha`, `sourceSha256`, and `artifactSha256`. | “동일 SHA와 artifact hash를 다시 열어 source-of-record를 확인합니다.” |

## Exact evidence commands

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/public-scanner-signal-refresh.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
npm run smoke:ax-demo
```

## Smoke expectation contract

이 표는 public reference refresh가 말로 끝나지 않고, reviewer가 fresh clone에서 같은 evidence lane을 재생할 때 기대해야 하는 최소 smoke 계약입니다. Expected exit가 non-zero인 row는 위험 fixture를 의도적으로 재생하는 것이며, 실패가 아니라 `BLOCK`/`REVIEW` evidence를 보존하는 조건입니다.

| Evidence lane | Smoke expectation | Source fixture | Reviewer artifact |
|---|---|---|---|
| PR diff | Expected exit: `1`; Expected verdict: `REVIEW`; Expected command: `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`; expected rules include `generic-secret-assignment`, `denied-command`. | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Markdown/JSON stdout captured by reviewer or by `npm run smoke:ax-demo`. |
| MCP config | Expected exit: `1`; Expected verdict: `BLOCK`; Expected command: `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`; expected rules include `mcp-filesystem-wide-root`, `mcp-env-token`. | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | Static config evidence only; no runtime MCP compatibility or OAuth/session claim. |
| transcript/log | Expected exit: `0`; Expected verdict: `REVIEW`; Expected command: `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`; expected policy evidence includes `denied-command`. | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` plus `examples/agent-policy.yaml` | Reviewer approval note that a human owner must resolve the risky operation. |
| SARIF artifact | Expected exit: `1`; Expected verdict: `REVIEW`; Expected artifact: `.agentguard-demo/public-scanner-signal-refresh.sarif`; Expected command: `node dist/index.js scan-diff --sarif --out .agentguard-demo/public-scanner-signal-refresh.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`. | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF `2.1.0` handoff file for reviewer-owned upload/archive, not automatic GitHub upload. |
| smoke manifest | Expected command: `npm run smoke:ax-demo`; Expected artifact: `.agentguard-demo/ax-evidence-smoke/manifest.json`; Expected manifest fields: `schemaVersion`, `gitCommitSha`, `sourceSha256`, `artifactSha256`, `summary`, `checks[]`. | `scripts/ax-demo-smoke.mjs` plus the fixture paths above | Expected source-of-record rule: rerun before handoff if source fixture, artifact, build output, or evidence directory changes. |

Fixture paths protected by this ledger:

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`
- `scripts/ax-demo-smoke.mjs`

## Machine contracts

Human-facing Korean prose may explain rollout approval, business risk, and remediation. Machine-facing contracts stay English-compatible and unchanged:

- CLI surfaces: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `--policy`, `--sarif`, `--out`.
- Rule IDs: `generic-secret-assignment`, `denied-command`, `mcp-filesystem-wide-root`, `mcp-env-token`, and other `rule IDs` remain stable.
- Output formats: `JSON` and `SARIF` fields such as `schemaVersion`, `gitCommitSha`, `sourceSha256`, `artifactSha256`, `ruleId`, `locations`, and related evidence keys remain automation-safe.

## Non-claim guardrails

- Public references are research inputs, not proof of adoption, external approval, or source parity.
- AgentGuard is positioned as a static, rerunnable rollout gate for the current repository fixtures and CLI behavior.
- This ledger does not claim hosted dashboard behavior, live OAuth/session controls, automatic SARIF upload, or continuous monitoring.
- If a final company problem requires runtime controls, this ledger becomes the preflight evidence slice and the missing runtime control is stated as residual risk.
