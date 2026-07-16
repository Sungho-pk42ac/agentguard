# AX public reference decision matrix

## 목적

이 카드는 AX Rollout Guard 운영자가 공개 레퍼런스 refresh 결과를 곧바로 **증거 명령**으로 바꾸도록 돕는 Korean-first 판단표입니다. 원칙은 `source status first, evidence command second`입니다. 공개 페이지가 읽혔는지, WAF/403으로 막혔는지, registry fallback만 가능한지, 인증 경계인지 먼저 표시한 뒤 AgentGuard의 PR diff / MCP config / transcript-log / SARIF / smoke manifest 증거로 연결합니다.

이 문서는 제품 기능을 새로 주장하지 않습니다. AgentGuard의 구현된 CLI와 예제 fixture를 사용해 본선의 미지 회사 문제에 맞춰 빠르게 `회사 문제 → 공개 신호 → AgentGuard 증거 → 승인/재실행 결정`으로 pivot하는 운영 카드입니다.

## Public reference signals checked this run

| Public reference | Source status this run | Borrow | Avoid | AgentGuard action |
|---|---|---|---|---|
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | `PUBLIC_FETCH_200`; normal public fetch succeeded | least privilege, explicit consent, token-boundary vocabulary for MCP rollout review | runtime MCP authorization/session/consent enforcement claim | Route MCP server risk to `agentguard scan-mcp` and approval-owner wording. |
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | `PUBLIC_FETCH_200`; normal public fetch succeeded | reviewer handoff artifact language and SARIF as a code-scanning evidence channel | automatic SARIF upload or external approval claim | Route PR diff risk to SARIF artifact generation and reviewer handoff. |
| splx-ai agentic-radar — https://github.com/splx-ai/agentic-radar | `PUBLIC_FETCH_200`; normal public fetch succeeded | category pressure: public agentic workflow scanners exist, so AgentGuard must show evidence routing quickly | scanner parity, replacement, adoption, or certification claim | Emphasize Korean-first rollout approval evidence across PR/MCP/transcript/SARIF. |
| agent-scan npm page — https://www.npmjs.com/package/agent-scan | `PUBLIC_WAF_403`; WAF/HTTP 403 from this Hermes environment | no page-content borrow from the blocked human page | blocked page is not product evidence | Use only a separate public registry fallback row if registry data is fetched. |
| agent-scan registry metadata — https://registry.npmjs.org/agent-scan | `PUBLIC_REGISTRY_FALLBACK_200`; public registry fallback succeeded | category pressure only: public package metadata says it detects suspicious AI agents activities on GitHub | registry metadata is category pressure only; no popularity, customer, quality, or certification inference | Keep AgentGuard comparison honest and route to fixture-backed evidence commands. |

If a source reaches an authenticated wall, use `AUTH_REQUIRED_STOP` and stop at auth boundary. If Claude Code/insane-search is unavailable, label `INSANE_SEARCH_UNAVAILABLE`; do not call normal public fetch or registry metadata insane-search evidence.

## Decision matrix

| Source status | Borrow | Next AgentGuard evidence command | Operator decision | Do not claim |
|---|---|---|---|---|
| `PUBLIC_FETCH_200` | Use visible public wording as a reference vocabulary only. | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Convert the signal into a PR-diff approval question: what must block, what can be reviewed, and what rerun proves the fix. | Do not claim external endorsement, compatibility certification, or implemented runtime controls. |
| `PUBLIC_FETCH_200` | Use MCP least-privilege / consent / token-boundary language. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | Convert the signal into a static MCP approval question before rollout. | Do not claim runtime OAuth/session/consent enforcement. |
| `PUBLIC_FETCH_200` | Use reviewer-artifact/SARIF routing language. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-decision-matrix.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Generate a local SARIF artifact and hand it to reviewer/CI as evidence. | Do not claim automatic SARIF upload, external approval, or GitHub Code Scanning triage. |
| `PUBLIC_WAF_403` | Record only that the human page was blocked. | `npm run smoke:ax-demo` | Re-run the local smoke manifest before handoff; blocked page is not product evidence. | Do not infer product capability, adoption, or quality from a page that was not read. |
| `PUBLIC_REGISTRY_FALLBACK_200` | Use package name/version/description as public fallback category pressure only. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | Show that AgentGuard can route agent behavior evidence, not just package metadata comparison. | Do not claim popularity, customers, official approval, parity, or replacement. |
| `INSANE_SEARCH_UNAVAILABLE` | Use normal public fetch/fallback evidence only if labeled. | `npm run smoke:ax-demo` | Proceed with a previously justified low-risk slice and disclose the blocker. | no insane-search overclaim. |
| `AUTH_REQUIRED_STOP` | Borrow nothing from private/authenticated content. | `agentguard doctor --json` | Stop at auth boundary and use local readiness evidence only. | Do not bypass login, paywall, private data, or credentials. |

## Exact evidence commands

Run from a fresh clone or from the repo root after `npm ci && npm run build`:

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-decision-matrix.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
npm run smoke:ax-demo
```

Referenced fixtures and scripts:

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`
- `examples/agent-policy.yaml`
- `scripts/ax-demo-smoke.mjs`

## Machine contracts preserved

- CLI commands remain English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `agentguard doctor`.
- CLI flags remain English-compatible: `--policy`, `--sarif`, `--out`, `--json`, `--lang en`.
- Verdict and machine fields remain English-compatible: `PASS`, `REVIEW`, `BLOCK`, `JSON/SARIF fields`, `rule IDs`, `GitHub Action inputs/outputs`.
- Human-facing explanation can be Korean-first; CI, SARIF, JSON, package metadata, command names, and rule identifiers remain stable.

## Non-claim guardrails

- no customer/adoption claim: 이 카드는 실고객 도입이나 customer adoption evidence가 아닙니다.
- no external certification: SOC 2, ISO 27001, official certification, 공식 인증을 주장하지 않습니다.
- no scanner parity/replacement claim: public scanners are reference/category pressure, not AgentGuard parity or replacement proof.
- no runtime authorization claim: static MCP/transcript/PR evidence does not guarantee runtime OAuth, authorization, session, or consent enforcement.
- no automatic SARIF upload claim: local `--sarif --out` artifact creation does not automatically upload SARIF or approve a rollout.
- no insane-search overclaim: normal public fetch, WAF/403, or registry fallback evidence must not be labeled as insane-search evidence.

## 대상권 operator line

본선에서 새로운 회사 문제가 나오면, 먼저 공개 신호의 source status를 고정하고, 그 다음 AgentGuard의 exact fixture-backed command로 `PASS / REVIEW / BLOCK` 증거를 재현한다. 읽히지 않은 페이지와 registry metadata는 보조 신호일 뿐이며, 최종 설득은 PR diff / MCP config / transcript-log / SARIF artifact / smoke manifest가 만든 rerunnable source-of-record로 한다.
