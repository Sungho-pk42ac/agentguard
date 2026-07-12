# AX agent action custody route

한국어 우선 **agent action custody route** 카드는 AX Rollout Guard 심사자가 “에이전트가 어떤 위험 행동을 했는가?”를 묻는 순간, source artifact와 AgentGuard proof command, custody owner, approval decision, rerun trigger를 한 줄로 연결하게 한다. 범위는 docs-contract slice다. Scanner behavior, CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine fields는 바꾸지 않는다.

## 사용 목적

AX 인재전쟁 본선의 회사 문제는 아직 고정되어 있지 않다. 그래서 이 카드는 특정 산업 시나리오보다 더 앞단의 운영 질문을 다룬다.

> agent action → source artifact → AgentGuard command → custody owner → approval decision → rerun trigger

목표는 agent self-report를 그대로 믿지 않고, PR diff / MCP config / transcript-log / SARIF artifact 같은 재실행 가능한 evidence chain으로 승인 판단을 만드는 것이다. 이 문서는 구현된 scanner output을 설명하는 운영 카드이며, 새로운 runtime enforcement나 별도 구현된 approval workflow를 추가하지 않는다.

## Agent action custody route

| Agent action / rollout question | Source artifact | Exact proof command | Custody owner | Approval decision | Rerun trigger |
|---|---|---|---|---|---|
| PR diff에 secret, PII, unsafe shell, broad agent policy hint가 들어갔는가? | `examples/risky-pr.diff` | `node dist/index.js scan-diff < examples/risky-pr.diff` | PR owner + security reviewer | `BLOCK`이면 merge 중지, `REVIEW`면 residual-risk note 작성, `PASS`면 diff evidence를 release packet에 첨부 | diff가 바뀌거나 policy/rule version이 바뀌면 rerun |
| MCP config가 broad filesystem root, writable path, credential passthrough를 노출하는가? | `examples/risky-mcp.json` | `node dist/index.js scan-mcp < examples/risky-mcp.json` | MCP/tooling owner | risky permission은 rollout 전에 config owner가 approve/deny하고 수정 조건을 남김 | MCP server config, root/path/env permission이 바뀌면 rerun |
| Agent transcript/log가 approval-required command나 destructive operation을 포함하는가? | `examples/approval-required-review.jsonl` + `examples/agent-policy.yaml` | `node dist/index.js scan-log --policy examples/agent-policy.yaml --json < examples/approval-required-review.jsonl` | operator + incident/security reviewer | `REVIEW` finding은 승인 메모 또는 rollback/exception 질문으로 승격 | transcript source, policy file, approval owner가 바뀌면 rerun |
| Reviewer가 GitHub code scanning / SARIF artifact로 evidence를 받아야 하는가? | `examples/risky-pr.diff` → generated SARIF | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-agent-action-custody-route.sarif < examples/risky-pr.diff` | CI owner + security reviewer | SARIF file을 artifact로 보존하고 업로드 여부는 workflow owner가 별도 승인 | SARIF output path, workflow, scanner version이 바뀌면 rerun |

## Exact fixture-backed commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml --json < examples/approval-required-review.jsonl
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-agent-action-custody-route.sarif < examples/risky-pr.diff
```

Fixture-backed evidence:

- `examples/risky-pr.diff` is synthetic PR diff evidence.
- `examples/risky-mcp.json` is synthetic MCP config evidence.
- `examples/agent-policy.yaml` and `examples/approval-required-review.jsonl` are synthetic policy and transcript/log evidence.
- `.agentguard-demo/ax-agent-action-custody-route.sarif` is a generated SARIF artifact path, not a committed upload result.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agentic AI threat/mitigation vocabulary for risky tool use, data exposure, and human oversight. | Avoid: OWASP coverage, assurance, external certification, or complete security program language. | AgentGuard action: map agent actions to rerunnable PR diff, MCP config, transcript/log, and SARIF evidence routes. |
| [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) | Borrow: authorization boundary, state mismatch, trusted redirect URI, and resource-owner language for MCP rollout questions. | Avoid: saying AgentGuard performs runtime OAuth, state validation, redirect URI validation, token/session binding, or authorization server duties. | AgentGuard action: keep authorization concerns as reviewer questions and route current static evidence to `scan-mcp` + `scan-log` commands. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: code-scanning artifact handoff and SARIF upload workflow language. | Avoid: saying AgentGuard uploads, triages, or approves findings without configured workflow permissions and owner approval. | AgentGuard action: generate a SARIF artifact command and assign CI/security custody before any upload. |

## Machine-contract boundaries

Human-facing explanation is Korean-first. Automation-facing contracts stay English-compatible:

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- Rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment`
- Verdict values: `BLOCK`, `REVIEW`, `PASS`
- JSON, SARIF, API, and machine fields stay stable for CI, code scanning, parsers, and package consumers.
- Markdown report wording can explain custody, but machine fields and command flags are not presentation labels.

## Non-claim guardrails

- no scanner behavior change: this card does not change rules, detectors, severity, verdict semantics, blocking policy, CLI commands, rule IDs, JSON fields, SARIF fields, or API fields.
- no default verdict/severity change: existing `BLOCK`, `REVIEW`, and `PASS` behavior remains the source of truth.
- no automatic SARIF upload: the card names a SARIF artifact command, but GitHub workflow configuration and owner approval are separate.
- no runtime authorization claim: MCP and transcript/log language is evidence framing, not runtime auth, consent UI, OAuth/session enforcement, or policy enforcement beyond current scanner output.
- no real customer/adoption claim: all examples are synthetic fixtures and local commands.
- no external certification: public references are borrow/avoid/action inputs, not assurance badges.
- no platform parity claim: AgentGuard is presented as a narrow fixture-backed custody route, not a broad runtime platform.
