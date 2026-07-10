# Examples

This directory contains intentionally fake sample inputs. They are designed to demonstrate AgentGuard behavior without including real credentials or private data.

## Risky MCP config

```bash
agentguard scan-mcp < examples/risky-mcp.json
```

Expected result: `BLOCK` or `REVIEW` findings for broad filesystem access, writable roots, and credential-like environment passthrough.

## Claude Desktop MCP config

```bash
agentguard scan-mcp < examples/claude-desktop-config.json
```

Expected result: `BLOCK` or `REVIEW` findings for a broad filesystem root (`/`) and a credential-like `GITHUB_TOKEN` environment passthrough.

`agentguard posture` also detects this surface when `claude_desktop_config.json` sits at the scanned workspace root:

```bash
agentguard posture .
```

Expected result: a `claude desktop config` surface finding for the broad filesystem root and credential env passthrough when `claude_desktop_config.json` is present.

## Cursor MCP config

```bash
agentguard scan-mcp < examples/cursor-mcp.json
```

Expected result: `BLOCK` or `REVIEW` findings for a broad filesystem root (`/`) and a credential-like `GITHUB_TOKEN` environment passthrough.

`agentguard posture` also detects this surface when `.cursor/mcp.json` sits in the scanned workspace:

```bash
agentguard posture .
```

Expected result: a `cursor mcp config` surface finding for the broad filesystem root and credential env passthrough when `.cursor/mcp.json` is present.

## Risky PR diff

```bash
agentguard scan-diff < examples/risky-pr.diff
```

Expected result: findings for newly added secret-like or risky shell material.

## Agent transcript

```bash
agentguard scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

Expected result: findings for operations that should require review under the sample policy.

## JSONL agent transcripts (Codex/Hermes)

`scan-log` also recognizes JSONL agent transcripts (one JSON object per line, as produced by Codex- and Hermes-style agent runners). Each line is scanned as raw text as before, and any string values inside the parsed JSON (including nested `content` arrays) are decoded and scanned too, so secrets split across a JSON escape (e.g. a `\uXXXX` unicode escape) are still caught.

```bash
agentguard scan-log < examples/codex-transcript.jsonl
agentguard scan-log < examples/hermes-transcript.jsonl
```

Expected result: `REVIEW` findings — a critical OpenAI-style API key finding decoded from a JSON-escaped `content` field in the Codex transcript, and a high-severity denied command (`rm -rf`) finding in the Hermes transcript. Plain-text (non-JSONL) input to `scan-log` is unaffected.

## Markdown report

```bash
agentguard scan-diff --out agent-risk-report.md < examples/risky-pr.diff
```

A sample report is stored at [`examples/expected-report.md`](../examples/expected-report.md).

## Interactive session

Run bare `agentguard` (or `agentguard repl`) in a TTY to open the full-screen interactive session:

```bash
agentguard        # or: agentguard repl
```

Slash commands: `/scan [path]`, `/posture [path]`, `/offboard`, `/baseline [--save|--diff] [--track-rotation]`, `/doctor`, `/help`, `/quit`. Findings are browsed as a severity-colored list with ↑↓ navigation, an `f` severity filter, a `/` text filter, and a detail panel.

`/offboard` runs the guided offboarding sweep: pick a scan scope, review residual credentials across shell rc files, AI tool config dirs, agent MCP configs, npm global AI CLIs, and project files, then approve cleanup. Deletions move targets to `~/.agentguard/trash` (recoverable) and write a zod-validated audit report (JSON + Markdown) under `~/.agentguard/reports`.

Boundary: the interactive session runs only in a TTY. In non-TTY contexts (pipes/CI) AgentGuard prints its usual help text, so existing subcommands and scripts are unchanged.

## Enterprise AX rollout scenarios

[`examples/enterprise-scenarios/commerce-voc-agent/`](../examples/enterprise-scenarios/commerce-voc-agent/) contains a synthetic Korean commerce VOC agent rollout demo pack:

- risky PR diff
- risky MCP config
- agent transcript/log
- Korean approval report for `BLOCK → policy/fix conditions → PASS` storytelling

[`examples/enterprise-scenarios/hr-recruiting-agent/`](../examples/enterprise-scenarios/hr-recruiting-agent/) adds the same synthetic AX Rollout Guard demo shape for an HR/recruiting agent workflow: candidate summaries, interview feedback, shortlist/ranking risk, risky MCP permissions, and a Korean approval report.

These scenarios are designed for AX Rollout Guard judge demos without real customer data, credentials, logos, or adoption claims.

For public positioning references, see [AX Rollout references](ax-rollout-references.md).

For a 30-second Korean judge-facing matrix against public agent-security references, see [AX competitive comparison](ax-competitive-comparison.md).

For Korean-first hard objection scripts against public agent-security references, see [AX competitor objection answer card](ax-competitor-objection-answer-card.md).

For a Korean-first SARIF reviewer loop from company problem to evidence command and approval condition, see [AX SARIF reviewer loop card](ax-sarif-reviewer-loop-card.md).

For a Korean-first public AI-agent/MCP scanner ecosystem triage table with Borrow/Avoid/AgentGuard action rows, see [AX public scanner ecosystem triage](ax-public-scanner-ecosystem-triage.md).

For a Korean-first AX CI evidence handoff from company problem to split CI step, preserved artifact, and reviewer approval condition, see [AX CI evidence handoff card](ax-ci-evidence-handoff-card.md).

For a Korean-first public-reference-to-command routing card with exact fixture-backed evidence commands, see [AX reference command routing card](ax-reference-command-routing-card.md).

For a Korean-first MCP consent/token handoff from company problem to exact fixture-backed command, expected verdict, and approval question, see [AX MCP consent/token handoff card](ax-mcp-consent-token-handoff.md).

For a Korean-first authorization callback/state evidence card that separates static AgentGuard evidence from runtime OAuth validation, see [AX authorization callback state card](ax-authorization-callback-state-card.md).

For a Korean-first stakeholder-to-artifact routing card covering Markdown, SARIF/GitHub code scanning, PR/CI artifacts, local operator review, and security approver memos, see [AX reviewer channel routing card](ax-reviewer-channel-routing-card.md).

For Korean-first live-demo failure-mode handling with exact fixture-backed commands and non-claim guardrails, see [AX demo failure mode register](ax-demo-failure-mode-register.md).

For a Korean-first 3-minute live demo rehearsal path with exact exits, artifacts, and fallback wording, see [AX demo operator checklist](ax-demo-operator-checklist.md).

For a Korean-first 90-second judge path from company problem to command, verdict, and approval sentence, see [AX 90-second judge evidence tour](ax-90-second-judge-evidence-tour.md).

For a Korean-first adversarial judge checklist that turns unknown company workflow questions into exact AgentGuard evidence commands, see [AX adversarial judge checklist](ax-adversarial-judge-checklist.md).

For Korean-first POSIX, PowerShell, and GitHub Actions command variants that preserve the same fixture-backed evidence and SARIF artifact path, see [AX cross-shell demo command card](ax-cross-shell-demo-command-card.md).

For a Korean-first competition-rule compliance checklist that separates public facts, current evidence, and gated unknowns, see [AX rule compliance checklist](ax-rule-compliance-checklist.md).

For a tiny Korean before/after MCP rollout approval story, see [AX before/after rollout demo](ax-before-after-rollout-demo.md).

For a one-page Korean judge evidence handoff, see [AX judge evidence index](ax-judge-evidence-index.md).

For a Korean-first crosswalk from AX judging lenses to current AgentGuard evidence commands and public-reference guardrails, see [AX judge rubric crosswalk](ax-judge-rubric-crosswalk.md).

For a Korean-first control map from public threats to AgentGuard surfaces, exact commands, approval conditions, and residual risks, see [AX rollout control map](ax-rollout-control-map.md).

For a Korean-first REAL PROBLEM / REAL JUDGE / REAL OUTPUT map to current fixture-backed commands, see [AX real judge demo map](ax-real-judge-demo-map.md).

For Korean-first prelim judge Q&A scripts with evidence commands and non-claim guardrails, see [AX prelim judge Q&A](ax-prelim-judge-qa.md).

For a 30-second onsite company-problem pivot into existing evidence commands, see [AX onsite pivot guide](ax-onsite-pivot-guide.md).

For a Korean-first onsite decision log that maps company problem, decision, evidence command, verdict, approver/action, and rerun trigger, see [AX onsite decision log](ax-onsite-decision-log.md).

For a Korean-first 6-hour onsite execution board from company problem intake to scan commands, SARIF/Markdown handoff, and judge story, see [AX 6-hour onsite execution board](ax-6-hour-onsite-execution-board.md).

For a Korean-first first-minute evidence priority card that tells operators which fixture-backed proof to show first, see [AX first-60-seconds evidence priority card](ax-first-60-seconds-evidence-priority.md).

## AX company problem intake kit

[AX company problem intake kit](ax-company-problem-intake-kit.md) turns an unknown Korean company problem into a reusable AX Rollout Guard demo plan: business workflow, agent/tool surface, risky inputs, AgentGuard commands, `BLOCK → 수정/정책 → PASS` evidence, approval report, and a 30-second script.

For a Korean-first evidence receipt checklist covering PR diff, MCP, transcript/log, SARIF, and reviewer handoff surfaces, see [AX evidence receipt checklist](ax-evidence-receipt-checklist.md).

For a Korean-first vocabulary map from `PASS` / `REVIEW` / `BLOCK` to judge-facing Korean evidence language, see [AX verdict vocabulary glossary](ax-verdict-vocabulary-glossary.md).

For a Korean-first source-of-record audit card that separates agent self-report from repo/CI/host artifacts plus rerunnable commands, see [AX source-of-record audit card](ax-source-of-record-audit-card.md).

For a Korean-first tamper/replay check that maps PR diff, MCP config, transcript/log, and SARIF/report evidence to source artifact, rerun command, hash/freshness cue, and approver action, see [AX evidence tamper/replay check](ax-evidence-tamper-replay-check.md).

For a Korean-first evidence bundle manifest that groups exact fixture-backed commands, expected artifacts, public-reference borrow/avoid notes, and non-claim guardrails, see [AX evidence bundle manifest](ax-evidence-bundle-manifest.md).

For a Korean-first smoke evidence manifest handoff card that maps `npm run smoke:ax-demo` manifest checks to PR diff, MCP config, transcript/log, and SARIF reviewer artifacts, see [AX smoke evidence manifest handoff card](ax-smoke-evidence-manifest-handoff-card.md).

For a Korean-first 10-minute evidence freeze checklist covering PR diff, MCP config, transcript/log, SARIF/report artifact, and smoke manifest replay, see [AX demo evidence freeze checklist](ax-demo-evidence-freeze-checklist.md).

For a Korean-first final company-problem worksheet with fixture-backed commands and public-reference guardrails, see [AX final company-problem worksheet](ax-final-problem-worksheet.md).

For a Korean-first final submission smoke checklist covering PR diff, MCP config, transcript/log, and SARIF/report artifact checks, see [AX final submission smoke checklist](ax-final-submission-smoke-checklist.md).

For a Korean-first pilot responsibility handoff that assigns business approval, residual risk, rollback, and evidence rerun owners, see [AX pilot responsibility card](ax-pilot-responsibility-card.md).

For a Korean-first approval owner escalation matrix that maps `PASS` / `REVIEW` / `BLOCK` evidence to business/security owner action and rerun responsibility, see [AX approval owner escalation matrix](ax-approval-owner-escalation-matrix.md).

For a Korean-first incident response evidence card mapping AgentGuard `BLOCK` / `REVIEW` findings to triage, containment owner, fix/policy condition, rerun command, and approval/residual-risk sentence, see [AX incident response evidence card](ax-incident-response-evidence-card.md).

For a Korean-first timeboxed escalation drill mapping `PASS` / `REVIEW` / `BLOCK` to owner, timebox, exact evidence command/artifact, and rerun trigger, see [AX timeboxed escalation drill](ax-timeboxed-escalation-drill.md).

For a Korean-first first-run trust path from `agentguard --help` and `agentguard doctor` to fixture-backed PR/MCP/transcript/SARIF evidence, see [AX CLI trust onboarding card](ax-cli-trust-onboarding-card.md).

For a Korean-first change-control evidence card mapping change request to AgentGuard evidence, approver decision, and rollback/rerun, see [AX agent change-control evidence card](ax-agent-change-control-evidence-card.md).

For a Korean-first public-reference delta watch that maps fresh public signals to exact fixture-backed evidence commands without unsupported adoption, endorsement, or scope claims, see [AX public-reference delta watch](ax-public-reference-delta-watch.md).

## SARIF

```bash
agentguard scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff
```

A sample SARIF payload is stored at [`examples/agentguard.sarif`](../examples/agentguard.sarif).
