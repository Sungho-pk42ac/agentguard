# AX public scanner signal refresh ledger

## 목적

이 문서는 이번 hourly refresh에서 확인한 공개 scanner/reference 신호를 한국어 우선으로 정리해, AX Rollout Guard가 **unknown company problem**을 받았을 때 어떤 증거 lane으로 바로 전환할지 보여주는 judge-facing ledger입니다. 핵심은 public scanner ecosystem을 따라 하는 것이 아니라, AgentGuard의 `PR diff` / `MCP config` / `transcript/log` / `SARIF artifact` / `smoke manifest`를 **Korean-first rollout approval**과 **approval gate**로 묶는 것입니다.

## Fresh public signals checked this run

| Public signal | Observed cue | Borrow | Avoid | AgentGuard action |
|---|---|---|---|---|
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | `agent/MCP server/skill scanning` category is visible in the public repo description. | agent, MCP server, and skill inventory vocabulary. | vendor-grade market proof or product-equality wording. | Route the same risk language to fixture-backed `scan-diff`, `scan-mcp`, and `scan-log` evidence. |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | Public description frames an `AI infra guardrail` / red-team style toolchain. | broad AI infrastructure risk taxonomy. | broad suite positioning or all-risk coverage language. | Keep AgentGuard as a deterministic rollout gate with exact source-of-record commands. |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | Public repo presents an `agentic workflow scanner`. | workflow attack-surface wording. | simulation-suite language or attack-lab scope. | Explain AgentGuard as pre-rollout evidence for PR/MCP/transcript surfaces. |
| [agentshield public repo](https://github.com/affaan-m/agentshield) | Public search result describes tool permission and MCP server checking. | `tool permission` and config-review vocabulary. | hosted app, auth, or monitoring claims. | Map permission risk to `mcp-filesystem-wide-root`, `mcp-env-token`, and policy review outputs. |
| [agent-security-scanner-mcp npm package](https://www.npmjs.com/package/agent-security-scanner-mcp) | npm package description frames AI agent, MCP server, code, and prompt scanning as a public package category. | package-distribution and agent/MCP scanner category pressure. | npm popularity, customer proof, parity, or replacement claims. | Keep AgentGuard evidence tied to local fixture commands while naming the package ecosystem pressure honestly. |
| [Proof Layer](https://www.proof-layer.com/) | Package metadata points to a vendor homepage, showing the signal is a public product/package surface. | packaging and public-facing scanner positioning cues. | deployment proof, commercial rollout, or vendor-backed assurance claims. | Treat the homepage only as source context; the AgentGuard action remains local CLI evidence and Korean approval handoff. |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Agentic AI threats include autonomy, tool misuse, and secret exposure language. | common risk language for judge explanation. | external assurance or endorsement phrasing. | Keep findings tied to local commands and remediation conditions. |
| [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) | Authorization guidance highlights client/server trust, session, state mismatch, trusted redirect URI, and token handling. | `authorization` and token-boundary framing. | live OAuth/session/consent control wording. | Frame `scan-mcp` as static preflight evidence for approval, not a live control. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF upload flow shows reviewer-facing security artifact handoff. | `SARIF artifact`, `ruleId`, and reviewer route vocabulary. | automatic upload/triage or GitHub-native product claims. | Keep `scan-diff --sarif --out` as a rerunnable artifact lane. |

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
