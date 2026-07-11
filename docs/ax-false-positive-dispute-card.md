# AX false-positive dispute review card

한국어 우선 dispute-review 카드입니다. 목적은 AX 심사자와 enterprise reviewer가 "AgentGuard가 rollout을 막았는데 engineer가 false-positive/오탐이라고 주장하면 누가, 어떤 evidence로, 어디까지 승인하는가?"를 한 장에서 확인하게 하는 것입니다.

이 카드는 docs/tests slice입니다. AgentGuard의 scanner behavior, CLI commands, rule IDs, verdict logic, JSON/SARIF/API machine contracts, package metadata는 바꾸지 않습니다.

## 사용 목적

contested finding은 말로 닫지 않는다. engineer comment, agent self-report, 채팅 요약은 clue일 수 있지만 source-of-record가 아니다. reviewer는 같은 repo root에서 rerunnable evidence command를 다시 실행하고, source-of-record artifact를 확인한 뒤 approver decision을 남긴다.

짧은 판단 기준:

- `BLOCK`: rollout/배포 중단. 위험 finding이 source-of-record artifact와 rerunnable command로 재현되고, 예외 승인 경계가 없다.
- `REVIEW`: false-positive 또는 정책 예외 후보. 사람이 approver decision을 남기고 residual risk, owner, expiry를 기록해야 한다.
- `PASS`: 같은 input을 다시 실행했을 때 finding/위험/차단 사유가 없거나, 승인 조건이 source-of-record artifact에 남아 있다.

## Dispute review path

1. disputed finding을 rule ID, surface, location, verdict와 함께 고정한다.
2. engineer가 "false-positive" 또는 "오탐"이라고 주장하면 reviewer는 먼저 source-of-record artifact를 찾는다: PR diff, MCP config, transcript/log, Markdown report, JSON, SARIF.
3. reviewer는 아래 fixture-backed command와 같은 형식으로 실제 artifact를 다시 스캔한다.
4. 같은 finding이 재현되면 `BLOCK` 또는 `REVIEW`다. 재현되지 않으면 input drift, fixture mismatch, policy mismatch를 확인하고 새 artifact path를 남긴다.
5. approver가 정책 예외를 승인하면 approver decision에 reason, owner, expiry, rollback trigger를 기록한다.
6. runtime authorization, consent, session-boundary 판단은 AgentGuard static MCP config evidence와 분리한다. AgentGuard는 이 카드에서 MCP server를 실행하거나 OAuth/session 흐름을 대신 승인하지 않는다.

## Source-of-record evidence

| Dispute question | Source-of-record artifact | Rerun evidence |
|---|---|---|
| PR diff finding이 실제인가? | checked-in PR diff, CI diff artifact, or reviewer-attached diff | `scan-diff` rerun + Markdown report + JSON/SARIF if needed |
| MCP permission finding이 과한가? | MCP config file or host-exported MCP config artifact | `scan-mcp` rerun against the same config text |
| transcript/log approval finding이 false-positive인가? | agent transcript/log artifact plus policy file | `scan-log --policy ...` rerun |
| reviewer handoff가 machine-readable인가? | SARIF artifact and Markdown report | `scan-diff --sarif --out agentguard.sarif` same-input regeneration |
| approval-required event가 예외 승인됐는가? | approver decision record and policy exception note | rerun evidence plus owner/expiry/rollback trigger |

## Fixture-backed rerun commands

아래 commands는 현재 repository의 synthetic fixture만 사용한다. Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 저장소 root에서 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/approval-required-review.jsonl
node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff
```

| Artifact | Fixture path | Dispute use |
|---|---|---|
| PR diff | `examples/risky-pr.diff` | secret-like PR diff finding을 reviewer가 같은 `scan-diff` command로 재현한다. |
| MCP config | `examples/risky-mcp.json` | broad filesystem permission, `mcp.broad_filesystem_access`, token passthrough 의심을 `scan-mcp` evidence로 분리한다. |
| transcript/log | `examples/agent-transcript.log` | shell/export/delete-style action을 `scan-log` evidence로 확인한다. |
| approval-required record | `examples/approval-required-review.jsonl` | approval-required event가 `REVIEW`인지, approver decision이 필요한지 확인한다. |
| policy file | `examples/agent-policy.yaml` | transcript/log dispute에서 정책 경계를 재현한다. |
| SARIF sample | `examples/agentguard.sarif`, regenerated `agentguard.sarif` | GitHub-compatible reviewer handoff input이다. Upload is a handoff input, not automatic approval. |
| Human report | Markdown report | 한국어 우선 reviewer explanation이다. Machines still read JSON, SARIF, rule IDs, verdict, and locations. |
| Machine report | JSON | CI or harness가 parse할 English-compatible machine contract다. |

## Approver decision record

approver decision은 finding을 삭제하는 행위가 아니다. reviewer가 contested finding을 닫을 때 아래 fields를 남긴다.

| Field | Required content |
|---|---|
| disputed finding | rule ID, surface, location, original verdict: `PASS`, `REVIEW`, or `BLOCK` |
| rerunnable evidence | command, input artifact path, report artifact path, CLI version or git SHA |
| policy version | policy file path plus policy git SHA/hash used for the rerun |
| decision | true false-positive, accepted policy exception, fix required, or rollback required |
| mitigation justification | why the residual risk is acceptable, including compensating control or least-privilege reason |
| approver | named owner or reviewer group responsible for residual risk |
| expiry | date or event when the exception must be rerun |
| rollback trigger | condition that turns `REVIEW` back into `BLOCK` |

Decision examples:

- true false-positive: source-of-record artifact shows the matched text is not secret material, reviewer records reason, and future rerun uses the same artifact boundary.
- accepted policy exception: broad MCP root or approval-required action remains, but owner/expiry/least privilege reason is recorded and the rollout stays `REVIEW`.
- fix required: rerun confirms token, broad writable root, or unapproved action; rollout stays `BLOCK` until code/config/policy changes.

## Policy exception boundaries

policy exception은 product behavior를 바꾸지 않는다. It is an approver-owned decision around a specific source-of-record artifact.

- exception scope: one rule ID, one artifact path, one owner, one expiry.
- least privilege: MCP access should be narrowed before exception approval whenever possible.
- static MCP config evidence: `scan-mcp` reads config text; it does not execute MCP server commands.
- runtime authorization boundary: consent, OAuth/session, redirect, and user authorization decisions stay outside this static docs card.
- SARIF boundary: SARIF upload/code scanning is reviewer handoff input, not automatic approval.
- OWASP boundary: threat/control vocabulary helps explain risk and mitigation; it is not OWASP certification or coverage proof.

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: threat-to-control and mitigation vocabulary for agent autonomy, tool misuse, sensitive data, and human review. | Avoid: OWASP certification, endorsement, full coverage, or external assurance claim. | AgentGuard action: map contested PR diff, MCP config, and transcript/log findings back to a control question and rerunnable evidence. |
| [MCP security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | Borrow: consent, least privilege, token, confused deputy, and session-boundary language. | Avoid: claim that AgentGuard enforces runtime consent, starts MCP servers, manages OAuth, or approves sessions. | AgentGuard action: separate static MCP config evidence from runtime authorization decisions. |
| [GitHub SARIF upload/code scanning docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning) | Borrow: SARIF artifact, rule/result/location, and reviewer handoff workflow language. | Avoid: claim that SARIF upload is automatic approval or that AgentGuard is a native GitHub security product. | AgentGuard action: treat SARIF/Markdown/JSON artifacts as source-of-record handoff inputs for human review. |

## Machine-contract and fake-claim guardrails

- CLI commands stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- Rule IDs, `verdict`, JSON fields, SARIF fields, API fields, and machine fields stay English-compatible.
- Verdict values stay `PASS`, `REVIEW`, `BLOCK`.
- This card makes no scanner behavior changes, no policy engine behavior changes, no package metadata changes, and no dashboard/SaaS/auth claim.
- No fake customer/adoption claim: synthetic fixtures only, no named customer rollout proof.
- No certification claim: no external audit badge, OWASP approval, MCP approval, or GitHub approval claim.
- No product parity claim: AgentGuard is not presented as a replacement for GitHub code scanning, MCP runtime authorization, SAST, or a broad AI red-team platform.
