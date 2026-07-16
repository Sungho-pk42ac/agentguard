# AX evidence gap burndown

## 목적

한국어 우선 카드로 공개 reference pressure를 대상권/AX judging에서 바로 설명 가능한 다음 proof artifact로 줄입니다. 이 문서는 scanner behavior, CLI command names, rule IDs, verdict values, JSON/SARIF fields, GitHub Action runtime, package publishing, dashboard/SaaS behavior를 바꾸지 않습니다.

unknown company problem을 받았을 때 운영자는 이 burndown을 보고 **어떤 gap을 어떤 source-of-record command로 닫을지**, **누가 approval owner인지**, **무엇을 residual-risk note로 남길지**를 30초 안에 정합니다.

## Public reference pressure checked this run

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agentic threat-to-mitigation language, sensitive data exposure, excessive agency, human oversight vocabulary. | Avoid: OWASP endorsement, coverage, certification, or formal assurance claim. | Map threat language to `scan-diff` and `scan-log` evidence that a reviewer can rerun before rollout. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | Borrow: least privilege, explicit consent, token boundary, trusted redirect URI and permission-review language. | Avoid: runtime OAuth, session, or consent enforcement claim. | Route MCP server/config risk to static `scan-mcp` approval evidence and a named approval owner. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF reviewer handoff and code-scanning artifact vocabulary. | Avoid: automatic SARIF upload, automatic approval, or GitHub endorsement claim. | Keep SARIF as an artifact handoff path: generate the file, preserve it, and let CI/security reviewer decide. |
| [npm `agent-scan` registry metadata](https://registry.npmjs.org/agent-scan) | Borrow: public scanner category pressure that agent activity scanners are emerging. | Avoid: Snyk parity, public scanner replacement, package popularity, customer adoption, or vendor-scale platform claim. | Differentiate AgentGuard as rollout evidence routing across PR diff, MCP config, transcript/log, and SARIF artifact surfaces. |

## Gap burndown queue

| Gap | Why it matters for AX judging | Next proof artifact | Evidence command | Owner decision |
| --- | --- | --- | --- | --- |
| Agent PR adds secret-like or dangerous rollout material | 회사 문제 적응력은 설명보다 runnable proof가 먼저다. PR diff evidence lets the judge see the risk before agent code ships. | Markdown/terminal finding plus optional JSON/SARIF artifact from the same fixture. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Security reviewer records `BLOCK` or `REVIEW`, fix condition, and residual-risk note. |
| MCP config asks for broad filesystem/root/env access | MCP public guidance emphasizes least privilege and explicit consent. Static config evidence proves the rollout gate can stop overbroad tool permissions. | MCP approval note that names the server/config, path/env risk, and least-privilege fix. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | Platform owner narrows roots/env or signs a time-boxed exception with approval owner. |
| Agent transcript/log shows approval-required or denied shell behavior | Agentic threat-to-mitigation language becomes concrete only when an actual transcript maps to `REVIEW`/`BLOCK`. | Source-of-record transcript evidence with policy path and rerun trigger. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | Incident/security reviewer decides policy exception, rollback, or blocked rollout. |
| Reviewer needs machine artifact handoff | 대상권 demo needs reviewer-verifiable artifacts, not screenshots or agent self-report. | SARIF file preserved under `.agentguard-demo/` for code-scanning or security-review handoff. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-gap-burndown.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | CI/security owner attaches SARIF/JSON/SARIF evidence and confirms fresh-clone rerun before relying on it. |

## Exact evidence commands

Run from a fresh clone or clean working tree after `npm ci && npm run build`:

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-gap-burndown.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Risky fixture commands may exit non-zero when they correctly produce `BLOCK` evidence. Treat exit code as part of the source-of-record, then inspect the verdict and artifact contents rather than hiding the non-zero result.

## Machine-contract boundary

Keep English-compatible machine contracts unchanged: `PASS`, `REVIEW`, `BLOCK`, `scan-diff`, `scan-mcp`, `scan-log`, `--sarif`, `--out`, `JSON/SARIF`, rule IDs, verdict spelling, SARIF field names, CLI options, and package metadata.

This document is a reviewer/operator routing card only. It does not change scanner scoring, severity thresholds, GitHub Action behavior, package publication, or runtime authorization behavior.

## Non-claim guardrails

- No customer rollout or real customer evidence claim; examples are synthetic fixtures.
- No external certification, SOC 2, ISO 27001, OWASP approval, MCP approval, GitHub approval, Snyk approval, or formal assurance claim.
- No public scanner parity or replacement claim; public scanner references are category pressure and language references only.
- No runtime OAuth/session/consent enforcement claim; AgentGuard evidence here is static pre-rollout evidence that a human reviewer can approve, rerun, or block.
- No automatic SARIF upload or automatic approval claim; SARIF is a handoff artifact and the workflow owner decides whether and where to upload it.
