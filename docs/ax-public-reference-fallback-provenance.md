# AX public reference fallback provenance card

한국어 우선 provenance card입니다. 목적은 AX Rollout Guard hourly research에서 **normal public fetch**, **WAF/HTTP 403**, **public registry fallback**, **insane-search unavailable** 같은 소스 상태를 솔직하게 라벨링하고, 그 신호를 현재 AgentGuard의 fixture-backed evidence command로 낮추는 것입니다. CLI commands, rule IDs, `PASS` / `REVIEW` / `BLOCK`, JSON/SARIF fields는 English-compatible machine contract로 유지합니다.

## 목적

대상권 심사에서는 “어떤 공개 신호를 봤고, 무엇을 빌렸으며, 무엇을 주장하지 않는가?”가 중요합니다. 이 문서는 public reference가 proof가 아니라 **research input**임을 분리하고, 실제 proof는 `scan-diff` / `scan-mcp` / `scan-log` / SARIF artifact / smoke manifest 재실행으로 남기는 operator card입니다.

## Source status labels

| Source status | Meaning | Allowed use | Disallowed claim |
|---|---|---|---|
| `PUBLIC_FETCH_200` | normal unauthenticated public fetch returned usable content. | title, visible description, Borrow/Avoid/AgentGuard action row. | external endorsement, adoption, certification, or full coverage. |
| `PUBLIC_WAF_403` | public web page was blocked from this environment. | record the blocker and use only separately verified public fallback metadata. | claiming the blocked page was read by insane-search or authenticated access. |
| `PUBLIC_REGISTRY_FALLBACK_200` | public registry/API metadata returned usable unauthenticated JSON. | package name/version/description as category-pressure evidence. | popularity, quality, customer adoption, parity, or vendor assurance. |
| `INSANE_SEARCH_UNAVAILABLE` | Claude/insane-search path could not run or was not needed. | state the boundary and proceed with public fallback evidence only if enough evidence exists. | calling fallback evidence “insane-search evidence”. |
| `AUTH_REQUIRED_STOP` | page requires login/private content/payment/auth. | stop at boundary and ask for user-provided public excerpt if needed. | bypassing auth, inferring hidden content, or storing credentials. |

## Public reference fallback ledger

| Public reference | Source status this run | Borrow | Avoid | AgentGuard action |
|---|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | `PUBLIC_FETCH_200`; title observed: `Agentic AI - OWASP Lists Threats and Mitigations`. | agent autonomy, tool misuse, secret exposure, and mitigation vocabulary. | OWASP endorsement, certification, or full threat-model coverage. | Map risk language to PR diff, MCP config, transcript/log, SARIF artifact evidence lanes. |
| MCP Authorization — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | `PUBLIC_FETCH_200`; title observed: `Authorization - Model Context Protocol`. | authorization boundary, state mismatch, trusted redirect URI, approval-owner question. | runtime OAuth, state validation, session binding, consent UI, or authorization server claim. | Phrase `scan-mcp` / `scan-log` output as static preflight evidence plus approver decision. |
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | `PUBLIC_FETCH_200`; title observed: `Uploading a SARIF file to GitHub - GitHub Docs`. | third-party SARIF artifact handoff, `ruleId`, result/location vocabulary. | automatic upload, GitHub-native approval, or code-scanning triage claim. | Generate local SARIF with `--sarif --out` and hand the artifact path to the CI/reviewer owner. |
| Snyk agent-scan — https://github.com/snyk/agent-scan | `PUBLIC_FETCH_200`; public description says `Security scanner for AI agents, MCP servers and agent skills`. | public category pressure for agent/MCP/skill scanning. | scanner parity, replacement, adoption, or vendor-scale maturity claim. | Differentiate AgentGuard as Korean-first rollout approval evidence across PR/MCP/transcript/SARIF. |
| Tencent AI-Infra-Guard — https://github.com/Tencent/AI-Infra-Guard | `PUBLIC_FETCH_200`; public description says `A full-stack AI Red Teaming platform securing AI ecosystems`. | multi-surface AI infrastructure risk taxonomy. | full-stack platform equivalence, all-risk coverage, or red-team suite claim. | Keep AgentGuard scope narrow: local static evidence and rerunnable approval handoff. |
| npm web page for `agent-scan` — https://www.npmjs.com/package/agent-scan | `PUBLIC_WAF_403` in this Hermes environment. | none from the blocked web page itself. | claiming npm page contents were read, package popularity, or production adoption. | Use `https://registry.npmjs.org/agent-scan` only as public registry fallback metadata. |
| npm registry `agent-scan` — https://registry.npmjs.org/agent-scan | `PUBLIC_REGISTRY_FALLBACK_200`; public metadata observed `name=agent-scan`, latest version `0.0.1`, description `Detect suspicious AI agents activities on GitHub`. | package-distribution category pressure and activity-scanner wording. | maturity, quality, install base, Snyk parity, or proof of enterprise demand. | Route category pressure to exact AgentGuard commands and non-claim guardrails. |

## Exact evidence commands

| Evidence lane | Exact command | Source fixture / artifact | Operator decision |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | PR owner removes secret-like/risky change or documents residual `REVIEW` owner. |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP/tool owner narrows filesystem/env permission before rollout. |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | 운영 owner reviews approval-required command/export/delete/deploy behavior. |
| SARIF artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-fallback-provenance.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/public-reference-fallback-provenance.sarif` | CI/reviewer owner archives or uploads the artifact through a separately approved workflow. |
| smoke manifest | `npm run smoke:ax-demo` | `scripts/ax-demo-smoke.mjs`; `.agentguard-demo/ax-evidence-smoke/manifest.json` | reviewer checks `schemaVersion`, `gitCommitSha`, `summary`, `checks[]`, and per-lane expected results before handoff. |

## Machine contracts

- Commands remain `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, and `agentguard doctor`.
- Flags remain English-compatible: `--policy`, `--sarif`, `--out`, `--json`, `--lang en`.
- Verdicts remain `PASS`, `REVIEW`, and `BLOCK`.
- JSON/SARIF fields, rule IDs, package metadata, GitHub Action inputs/outputs, and scanner scoring are unchanged by this card.

## Non-claim guardrails

- no customer/adoption claim: public references and registry metadata are not customer proof.
- no external certification: OWASP, MCP, GitHub, Snyk, Tencent, and npm references are not endorsements or assurance badges.
- no scanner parity/replacement claim: AgentGuard does not claim to replace public scanners or equal a full red-team platform.
- no runtime authorization claim: this card does not implement OAuth, state validation, consent UI, session binding, or runtime enforcement.
- no automatic SARIF upload claim: the SARIF command produces a local artifact; upload/reviewer routing needs separate owner approval.
- no insane-search overclaim: this run used normal public fetch and public registry fallback evidence; it did not use private/authenticated content or auth bypass.

## 대상권 operator line

“공개 reference는 방향 신호로만 쓰고, blocked page나 registry metadata는 provenance label을 붙입니다. 최종 판단은 AgentGuard가 지금 재실행할 수 있는 PR diff, MCP config, transcript/log, SARIF, smoke manifest evidence로만 보여줍니다.”
