# AX public-reference source-status drill

## 사용 목적

이 문서는 AX Rollout Guard가 공개 reference를 확인할 때 **출처 상태(source status)** 를 과장 없이 설명하고, 상태가 달라도 어떤 AgentGuard 증거 명령으로 회사 문제를 검증할지 바로 고르는 한국어 우선 drill입니다.

대상권 심사에서 중요한 질문은 “이 외부 문서를 봤다”가 아니라 “public reference가 200이든, 403/WAF이든, registry fallback이든, login/auth boundary이든 현재 저장소의 어떤 source-of-record evidence로 배포 승인 판단을 재현할 수 있나?”입니다.

## Source-status decision table

| Source status | Public reference signal | Borrow | Avoid | AgentGuard evidence action |
|---|---|---|---|---|
| `HTTP 200 public page` | [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) and [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) are readable public guidance. | Agentic AI deployment governance, least privilege, explicit user consent, token passthrough boundary wording. | OWASP/MCP endorsement, complete coverage, or runtime consent/OAuth/session enforcement claims. | Map the reference to exact PR diff, MCP config, and transcript/log smoke commands below; keep residual risk explicit when a company problem needs runtime controls. |
| `403/WAF page` | A public product/package page may be blocked by WAF from the cron environment. | Treat blocked access as a provenance fact and use another public source only if available. | Pretending blocked content was read, using private credentials, or calling fallback evidence “insane-search evidence.” | Continue with fixture-backed AgentGuard commands, and label the public page as `환경에서 본문 미확인` until a user browser or allowed public path confirms it. |
| `public registry fallback` | [agent-scan npm registry metadata](https://registry.npmjs.org/agent-scan) returned public package metadata for an AI-agent activity scanner category. | Category pressure: AI-agent activity scanning is a public package surface, so AgentGuard should show richer rollout evidence. | Adoption, maturity, popularity, customer proof, or vendor parity claims from registry metadata. | Use registry metadata only to justify why PR/MCP/transcript/SARIF proof must be rerunnable and Korean approval-owner friendly. |
| `auth/login boundary` | Some official portals, leaderboards, private docs, or submission systems may require login. | Clearly separate public facts from gated/unknown facts. | Login bypass, private data claims, final company-problem certainty, or hidden scoring details. | Keep the demo on synthetic fixtures and ask the human operator to confirm gated facts before final submission. |
| `stale reference` | A once-valid reference or competitor page may change after a prior run. | Freshness/rerun language: evidence must be checked near the handoff. | Treating an old fetch, old screenshot, or old package version as current proof. | Rerun public fetch status and rerun `npm run smoke:ax-demo` before reviewer handoff if source fixtures, artifacts, or references changed. |

## Exact fixture-backed evidence commands

Run these after `npm ci && npm run build` in a fresh clone or current verified workspace. Non-zero exits are expected for risky fixture inputs when the output still shows the intended `REVIEW` or `BLOCK` verdict.

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-source-status-drill.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
npm run smoke:ax-demo
```

## Public references used by this drill

| Reference | What it changes in the drill | What it must not imply |
|---|---|---|
| https://owasp.org/www-project-top-10-for-large-language-model-applications/ | Use agentic AI governance and deployment-risk language when explaining why rollout evidence must be source-of-record. | OWASP approval, certification, or complete risk coverage. |
| https://genai.owasp.org/ | Use public GenAI security project framing to explain that agentic AI safety is a governance and evidence problem. | Any external assurance badge or official endorsement. |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Use least-privilege, explicit-consent, and token-passthrough language for MCP config approval. | Runtime MCP enforcement, OAuth/session binding, or live consent controls. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | Use SARIF artifact and reviewer handoff vocabulary. | Automatic GitHub upload, automatic triage, or branch-protection setup. |
| https://registry.npmjs.org/agent-scan | Use package category pressure that AI-agent activity scanners exist publicly. | Adoption, popularity, maturity, customer use, or product-equivalence claims. |

## Reviewer handoff script

1. State the source status first: `HTTP 200`, `403/WAF`, `public registry fallback`, `auth/login boundary`, or `stale reference`.
2. State what was borrowed and what was avoided.
3. Run the exact command for the matching evidence lane.
4. Preserve stdout/SARIF/manifest as the source-of-record artifact.
5. If the company problem requires runtime enforcement or private portal facts, mark that as residual risk instead of claiming it is solved.

## Machine-contract boundaries

This drill changes only documentation and docs-contract tests. It does not change these machine-facing contracts:

- CLI surfaces: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `--policy`, `--sarif`, `--out`.
- Verdicts: `PASS`, `REVIEW`, `BLOCK` remain English-compatible machine contracts.
- Rule IDs such as `generic-secret-assignment`, `denied-command`, `mcp-filesystem-wide-root`, and `mcp-env-token` remain stable.
- JSON/SARIF fields such as `ruleId`, `locations`, `schemaVersion`, `artifactSha256`, and `gitCommitSha` remain automation-safe.

## Non-claim guardrails

- Public references are research inputs, not implementation proof, adoption proof, certification, endorsement, or vendor parity.
- Registry metadata is category pressure only; it is not maturity, popularity, or customer evidence.
- A blocked page stays blocked until a public allowed path or user browser confirms it.
- AgentGuard is presented here as a static, rerunnable rollout gate for PR diff, MCP config, transcript/log, SARIF, and smoke manifest evidence.
- This drill does not claim hosted monitoring, does not claim private portal access, does not claim runtime OAuth controls, does not claim live MCP consent enforcement, does not claim automatic SARIF upload, and does not claim replacement of OWASP, GitHub code scanning, Snyk, Tencent AI-Infra-Guard, agentic-radar, agentshield, or any public scanner.
