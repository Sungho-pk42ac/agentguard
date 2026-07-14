# AX public reference validation card

## 목적

이 문서는 AX Rollout Guard가 공개 레퍼런스를 근거로 심사자에게 설명할 때, **무엇을 빌렸는지**, **무엇은 주장하지 않는지**, **어떤 AgentGuard evidence command로 재현하는지**를 한 장으로 고정합니다. 목표는 AgentGuard를 외부 도구와 같은 제품이라고 과장하는 것이 아니라, 공개 보안/승인 흐름 언어를 기존 `PR diff` / `MCP config` / `transcript/log` / `SARIF artifact` 증거로 연결하는 것입니다.

## Public reference validation table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | LLM/agent risk vocabulary: prompt/tool misuse, sensitive-data exposure, unsafe output. | OWASP endorsement, certification, or full Top 10 coverage wording. | Map risk language to exact `scan-diff`, `scan-mcp`, and `scan-log` evidence commands. |
| [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) | Authorization, client/server trust, session, redirect, and token-boundary language. | Runtime OAuth/session/consent enforcement claims. | Treat `scan-mcp` as static preflight evidence for broad roots and credential passthrough before rollout approval. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Reviewer artifact handoff vocabulary: SARIF file, code scanning route, `ruleId`, rerunnable report. | Automatic upload, automatic triage, or GitHub-native approval claims. | Generate local SARIF with `scan-diff --sarif --out` so a reviewer can preserve and re-run the source artifact. |
| [`agent-security-scanner-mcp` npm package](https://www.npmjs.com/package/agent-security-scanner-mcp) | Public category pressure: AI-agent/MCP scanner language is now recognizable to developers. | npm popularity, customer proof, parity, or replacement claims. | Differentiate AgentGuard as Korean-first rollout approval evidence with PR/MCP/transcript lanes and fixture-backed commands. |

## Exact evidence commands

Run these from a fresh clone after `npm ci && npm run build`. The risky demo commands are expected to return non-zero when they find `BLOCK`-level evidence; the approval artifact is the verdict/report shape, not exit code zero.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
mkdir -p .agentguard-demo/public-reference-validation && node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-validation/agentguard.sarif < examples/risky-pr.diff
```

Fixture/source paths protected by this card:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`
- `.agentguard-demo/public-reference-validation/agentguard.sarif`

## Judge explanation script

> “공개 레퍼런스는 방향을 빌리기 위한 자료입니다. OWASP는 agent/tool risk vocabulary, MCP Authorization은 authorization/token boundary, GitHub SARIF는 reviewer artifact handoff, public AI-agent/MCP scanner packages는 시장 category pressure를 줍니다. AgentGuard는 이 레퍼런스를 구현됐다고 과장하지 않고, 현재 저장소의 `scan-diff`, `scan-mcp`, `scan-log`, `SARIF` evidence command로 PR diff / MCP config / transcript risk를 `PASS` / `REVIEW` / `BLOCK`으로 재현합니다.”

## Approval validation checklist

| Check | Source of record | Approval decision |
|---|---|---|
| PR diff contains secret-like or dangerous shell content. | `node dist/index.js scan-diff < examples/risky-pr.diff` | `BLOCK` findings must be removed before merge/deploy. |
| MCP config exposes broad filesystem or credential passthrough. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `BLOCK`/`REVIEW` requires path/env narrowing or owner approval. |
| Agent transcript records an approval-required operation. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `REVIEW` stays open until the business owner accepts policy/fix conditions. |
| Reviewer needs preserved evidence. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/public-reference-validation/agentguard.sarif < examples/risky-pr.diff` | SARIF artifact is attached or re-generated for reviewer handoff. |

## Machine contracts

Human-facing Markdown may be Korean-first, but automation contracts stay English-compatible:

- Verdicts: `PASS`, `REVIEW`, `BLOCK`.
- CLI surfaces: `scan-diff`, `scan-mcp`, `scan-log`, `--policy`, `--sarif`, `--out`.
- Output contracts: `JSON`, `SARIF`, `ruleId`, `locations`, and severity fields.

## Claim guardrails

- Public references are validation inputs, not customer adoption proof.
- This card does not claim SOC 2, ISO 27001, OWASP, GitHub, MCP, Snyk, or npm certification.
- This card does not claim parity with, replacement of, or same-scope coverage as any public scanner or platform.
- This card does not claim runtime-auth enforcement, live OAuth/session controls, hosted monitoring, automatic SARIF upload, or automatic reviewer approval.
- If a company problem requires runtime enforcement, this card remains preflight evidence and the missing runtime control is stated as residual risk.
