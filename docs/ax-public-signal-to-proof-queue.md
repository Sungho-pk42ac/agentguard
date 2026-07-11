# AX public signal-to-proof queue

한국어 우선 설명으로 AX 인재전쟁 / AX Rollout Guard 심사자가 공개 signal을 현재 AgentGuard proof command와 다음 artifact decision으로 바로 연결하게 한다. 범위는 docs-contract slice다. Scanner behavior, CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine fields는 바꾸지 않는다.

## 사용 목적

공개 scanner, OWASP risk language, SARIF handoff, npm/GitHub package discoverability는 모두 "관심 signal"일 뿐이다. 심사자 앞에서는 signal을 claim으로 키우지 말고, 지금 repo에서 재실행 가능한 proof command와 reviewer가 받아야 할 artifact로 줄여야 한다.

이 카드는 **public signal -> proof command -> next artifact decision** queue다. Public reference는 빌릴 language를 정하고, AgentGuard action은 PR diff, MCP config, transcript/log, SARIF handoff 중 어디로 evidence를 보낼지 정한다.

## Public signal to proof queue

| Public signal | Proof command | Current proof surface | Next artifact decision |
|---|---|---|---|
| PR diff에 secret/PII/unsafe rollout clue가 보인다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | Markdown report on stdout with `REVIEW`/`BLOCK`/`PASS` verdict vocabulary. | Markdown을 reviewer note에 붙이고, code-scanning handoff가 필요하면 SARIF command도 rerun한다. |
| MCP server permission, writable root, broad filesystem access가 rollout risk로 보인다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | MCP permission finding and reviewer-readable Markdown. | Agent platform owner가 permission review를 열고 config path/source owner를 확인한다. |
| Agent transcript/log에 approval-required shell behavior가 보인다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | transcript/log policy evidence with approval finding and Markdown handoff. | Incident/security reviewer가 approval note, exception, or rollback question을 남긴다. |
| GitHub code scanning 또는 reviewer artifact route가 필요하다. | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | SARIF file path plus optional Markdown report. | CI owner가 SARIF upload workflow를 별도 승인하고, `.agentguard-demo/agentguard.sarif`를 artifact로 넘긴다. |

Queue rule:

- Public signal은 "왜 봐야 하는가"를 설명한다.
- proof command는 현재 fixture로 재실행 가능한 증거만 적는다.
- next artifact decision은 reviewer가 받을 Markdown, SARIF, config review, approval note를 고른다.
- `BLOCK`, `REVIEW`, `PASS` verdict values는 그대로 둔다.

## Exact fixture-backed commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

Fixture-backed evidence:

- `examples/risky-pr.diff` is synthetic PR diff evidence.
- `examples/risky-mcp.json` is synthetic MCP config evidence.
- `examples/agent-policy.yaml` and `examples/agent-transcript.log` are synthetic policy and transcript/log evidence.
- `.agentguard-demo/agentguard.sarif` is a generated SARIF artifact path, not a committed upload result.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | Borrow: shared LLM/agent risk language for prompt, data, supply-chain, and agentic tool exposure. | Avoid: OWASP coverage, external assurance, certification, or complete security program claim. | AgentGuard action: route risk language to PR diff, MCP config, transcript/log, and SARIF evidence rows. |
| [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) | Borrow: state mismatch, trusted redirect URI, and authorization boundary language for explaining why MCP/OAuth rollout needs a named owner. | Avoid: saying AgentGuard performs runtime OAuth, state validation, redirect URI validation, session binding, or authorization server duties. | AgentGuard action: keep OAuth/MCP callback risk as a reviewer question and route current evidence to `scan-mcp` + `scan-log` proof commands before rollout approval. |
| [GitHub SARIF upload](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file) | Borrow: reviewer artifact routing language for SARIF handoff. | Avoid: saying upload, triage, or approval happens without a configured workflow and owner. | AgentGuard action: document the exact SARIF command and hand `.agentguard-demo/agentguard.sarif` to the CI/reviewer owner. |
| [splx-ai `agentic-radar`](https://github.com/splx-ai/agentic-radar) | Borrow: public scanner vocabulary around agentic risks and exposed agent surfaces. | Avoid: attack simulation, runtime exploit coverage, or product replacement language. | AgentGuard action: keep the narrow differentiator as PR diff + MCP config + transcript/log proof commands. |
| [Tencent `AI-Infra-Guard`](https://github.com/Tencent/AI-Infra-Guard) | Borrow: public AI infrastructure risk category language. | Avoid: broad AI-infra platform parity, deployment posture ownership, or runtime infrastructure protection claim. | AgentGuard action: map infrastructure-flavored signals to the current fixture-backed queue instead of expanding scope. |
| [`agentshield` npm package](https://www.npmjs.com/package/agentshield) | Borrow: CLI/package discoverability language for first-minute evaluator trust. | Avoid: backup, rollback, runtime platform, or ecosystem parity claim. | AgentGuard action: keep the first-minute proof as exact local commands and generated artifacts. |
| [`agentshield` GitHub repo](https://github.com/affaan-m/agentshield) | Borrow: public README/package framing for CLI discoverability. | Avoid: source-control rollback, broad runtime enforcement, or same-product claim. | AgentGuard action: show AgentGuard's current PR+MCP+transcript differentiator with fixture-backed commands. |

## Machine-contract boundaries

Human-facing explanation is Korean-first. Automation-facing contracts stay English-compatible:

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- Rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment`
- Verdict values: `BLOCK`, `REVIEW`, `PASS`
- JSON, SARIF, API, and machine fields stay stable for CI, code scanning, and parsers.
- Markdown report wording can explain the evidence, but machine fields and command flags are not presentation labels.

## Non-claim guardrails

- no scanner behavior change: this card does not change rules, detectors, severity, verdict semantics, blocking policy, CLI commands, rule IDs, JSON fields, SARIF fields, or API fields.
- no default verdict/severity change: existing `BLOCK`, `REVIEW`, and `PASS` behavior remains the source of truth.
- no automatic SARIF upload: the card names a SARIF artifact command, but GitHub workflow configuration and owner approval are separate.
- no runtime authorization claim: MCP and transcript/log language is evidence framing, not runtime auth, consent UI, OAuth/session enforcement, or policy enforcement beyond current scanner output.
- no real customer/adoption claim: all examples are synthetic fixtures and local commands.
- no external certification: public references are borrow/avoid/action inputs, not assurance badges.
- no platform parity claim: AgentGuard is presented as a narrow fixture-backed proof queue, not a broad runtime platform.
