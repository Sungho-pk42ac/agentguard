# Examples

This directory contains intentionally fake sample inputs. They are designed to demonstrate AgentGuard behavior without including real credentials or private data.

## AX judge start route (첫 60초)

AX Rollout Guard 심사자·보안 reviewer가 긴 예시 목록을 읽기 전에 먼저 따라갈 한국어 우선 경로입니다. 새 기능이나 고객 도입을 주장하지 않고, 현재 저장소의 synthetic fixture와 재실행 가능한 명령만 source-of-record로 둡니다.

| Step | Judge question | Start here | Source-of-record command or artifact | Boundary |
| --- | --- | --- | --- | --- |
| 1 | 회사 문제가 오면 무엇부터 구조화하나? | [AX company problem intake kit](ax-company-problem-intake-kit.md) | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | final company problem, customer data, portal-only scoring detail은 안다고 말하지 않는다. |
| 2 | 30초 안에 `BLOCK -> fix/policy -> PASS`를 어떻게 보여주나? | [AX 30-second demo card](ax-30-second-demo-card.md) | `node dist/index.js scan-mcp < examples/risky-mcp.json` | demo fixture는 synthetic rehearsal이며 실제 운영 증거나 인증 증거가 아니다. |
| 3 | Fresh clone reviewer가 같은 결과를 재현할 수 있나? | [AX fresh-clone verifier card](ax-fresh-clone-verifier-card.md) | `npm ci && npm run build` then `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | build/setup failure와 risky finding non-zero exit을 구분한다. |
| 4 | GitHub/SARIF reviewer handoff는 어디에 남기나? | [AX SARIF reviewer loop card](ax-sarif-reviewer-loop-card.md) | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-judge-start-route.sarif < examples/risky-pr.diff` | SARIF artifact는 reviewer-owned handoff이며 automatic approval/upload를 뜻하지 않는다. |
| 5 | 마지막 제출·파일럿 전에 무엇을 receipt로 고정하나? | [AX release attestation receipt](ax-release-attestation-receipt.md) | command output + artifact hash + approver + rerun trigger | npm provenance/SARIF/reference vocabulary는 borrow only; 동급 벤더 범위, adoption, replacement, or 외부 보증을 주장하지 않는다. |

Public reference refresh에서 빌린 언어는 MCP Security Best Practices의 least-privilege/authorization boundary, GitHub SARIF upload docs의 reviewer artifact handoff, npm provenance statements의 reproducible package trust, OWASP LLM/agentic risk framing입니다. AgentGuard의 주장은 항상 위 fixture-backed command와 문서화된 residual-risk boundary에만 묶습니다.

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

For a Korean-first package provenance reviewer handoff that maps fresh clone checks to exact PR diff, MCP config, transcript/log, and SARIF artifact evidence, see [AX package provenance reviewer handoff card](ax-package-provenance-handoff.md).

For a Korean-first release attestation receipt that pins source-of-record commands, expected verdicts, artifacts, hashes, approval owners, and rerun triggers before team pilot or judge handoff, see [AX release attestation receipt](ax-release-attestation-receipt.md).

For a Korean-first AgentGuard GitHub Action first-run decision record that maps action outputs, artifact paths, and required status check context to team owner decisions, see [AX PR gate first-run decision record](ax-pr-gate-first-run-decision-record.md).

For a Korean-first public AI-agent/MCP scanner ecosystem triage table with Borrow/Avoid/AgentGuard action rows, see [AX public scanner ecosystem triage](ax-public-scanner-ecosystem-triage.md).

For a Korean-first public reference validation card that maps OWASP/MCP/SARIF/public scanner signals to exact evidence commands and claim guardrails, see [AX public reference validation card](ax-public-reference-validation-card.md).

For a Korean-first public scanner gap-to-demo checklist with exact fixture-backed PR diff, MCP, transcript/log, and SARIF commands, see [AX public scanner gap checklist](ax-public-scanner-gap-checklist.md).

For a Korean-first public scanner freshness scorecard that maps current public scanner signals to exact AgentGuard PR/MCP/transcript/SARIF evidence actions, see [AX public scanner freshness scorecard](ax-public-scanner-freshness-scorecard.md).

For a Korean-first AX CI evidence handoff from company problem to split CI step, preserved artifact, and reviewer approval condition, see [AX CI evidence handoff card](ax-ci-evidence-handoff-card.md).

For a Korean-first GitHub Action output routing contract that maps `finding-count`, `review-count`, and `block-count` to AX approval owners and branch-protection decisions, see [AX GitHub Action output routing](github-action.md#ax-approval-output-routing).

For a Korean-first public-reference-to-command routing card with exact fixture-backed evidence commands, see [AX reference command routing card](ax-reference-command-routing-card.md).

For a Korean-first public signal to exact proof command queue with next artifact decisions, see [AX public signal-to-proof queue](ax-public-signal-to-proof-queue.md).

For a Korean-first evidence gap burndown queue that maps public reference pressure to the next smallest proof artifact and owner decision, see [AX evidence gap burndown](ax-evidence-gap-burndown.md).

For a Korean-first agent action custody route mapping source artifacts to exact AgentGuard commands, owners, approval decisions, and rerun triggers, see [AX agent action custody route](ax-agent-action-custody-route.md).

For a Korean-first MCP consent/token handoff from company problem to exact fixture-backed command, expected verdict, and approval question, see [AX MCP consent/token handoff card](ax-mcp-consent-token-handoff.md).

For a Korean-first authorization callback/state evidence card that separates static AgentGuard evidence from runtime OAuth validation, see [AX authorization callback state card](ax-authorization-callback-state-card.md).

For a Korean-first MCP authorization proof queue that routes callback/session risk questions to exact `scan-mcp`, `scan-log`, and SARIF reviewer evidence, see [AX MCP authorization proof queue](ax-mcp-authorization-proof-queue.md).

For a Korean-first stakeholder-to-artifact routing card covering Markdown, SARIF/GitHub code scanning, PR/CI artifacts, local operator review, and security approver memos, see [AX reviewer channel routing card](ax-reviewer-channel-routing-card.md).

For Korean-first live-demo failure-mode handling with exact fixture-backed commands and non-claim guardrails, see [AX demo failure mode register](ax-demo-failure-mode-register.md).

For a Korean-first 3-minute live demo rehearsal path with exact exits, artifacts, and fallback wording, see [AX demo operator checklist](ax-demo-operator-checklist.md).

For a Korean-first 90-second judge path from company problem to command, verdict, and approval sentence, see [AX 90-second judge evidence tour](ax-90-second-judge-evidence-tour.md).

For a Korean-first AI/prelim judge evidence manifest with exact fixture-backed commands, public-reference guardrails, and machine-contract boundaries, see [AX AI judge evidence manifest](ax-ai-judge-evidence-manifest.md).

For a Korean-first adversarial judge checklist that turns unknown company workflow questions into exact AgentGuard evidence commands, see [AX adversarial judge checklist](ax-adversarial-judge-checklist.md).

For Korean-first POSIX, PowerShell, and GitHub Actions command variants that preserve the same fixture-backed evidence and SARIF artifact path, see [AX cross-shell demo command card](ax-cross-shell-demo-command-card.md).

For a Korean-first quickstart card that maps public CLI benchmark signals to exact AgentGuard evidence commands, see [AX CLI benchmark quickstart card](ax-cli-benchmark-quickstart-card.md).

For a Korean-first 30-second provenance check on `npm run smoke:ax-demo` manifest fields, artifact paths, hashes, and clean-tree rerun triggers, see [AX smoke provenance quickcheck](ax-smoke-provenance-quickcheck.md).

For a Korean-first competition-rule compliance checklist that separates public facts, current evidence, and gated unknowns, see [AX rule compliance checklist](ax-rule-compliance-checklist.md).

For a tiny Korean before/after MCP rollout approval story, see [AX before/after rollout demo](ax-before-after-rollout-demo.md).

For a one-page Korean judge evidence handoff, see [AX judge evidence index](ax-judge-evidence-index.md).

For a Korean-first crosswalk from AX judging lenses to current AgentGuard evidence commands and public-reference guardrails, see [AX judge rubric crosswalk](ax-judge-rubric-crosswalk.md).

For a Korean-first control map from public threats to AgentGuard surfaces, exact commands, approval conditions, and residual risks, see [AX rollout control map](ax-rollout-control-map.md).

For a Korean-first control-plane CI gate card that maps company problem signals to PR/MCP/transcript/SARIF evidence and approval decisions, see [AX control-plane CI gate card](ax-control-plane-ci-gate-card.md).

For a Korean-first public-reference evidence triage card that turns OWASP/MCP/SARIF reference signals into exact AgentGuard evidence commands, see [AX public-reference evidence triage card](ax-public-reference-evidence-triage.md).

For a Korean-first agentic tool-use approval queue that maps PR/MCP/transcript/SARIF evidence to owner decision and rerun triggers, see [AX agentic tool-use approval queue](ax-agentic-tool-use-approval-queue.md).

For a Korean-first evidence acceptance receipt that maps source evidence to artifact, owner, acceptance condition, and rerun trigger, see [AX evidence acceptance receipt](ax-evidence-acceptance-receipt.md).

For a Korean-first workspace trust approval checklist that maps public agent/MCP/security signals to exact AgentGuard evidence commands, see [AX workspace trust approval checklist](ax-workspace-trust-approval-checklist.md).

For a Korean-first review artifact acceptance checklist that maps PR/MCP/transcript/SARIF evidence bundles to accept, rerun, or block decisions, see [AX review artifact acceptance checklist](ax-review-artifact-acceptance-checklist.md).

For a Korean-first fresh-clone verifier path from `npm ci && npm run build` to exact PR/MCP/transcript/SARIF proof commands, see [AX fresh-clone verifier card](ax-fresh-clone-verifier-card.md).

For a Korean-first threat-to-control traceability card linking public OWASP/MCP/SARIF signals to exact AgentGuard evidence commands, see [AX threat-control traceability card](ax-threat-control-traceability.md).

For a Korean-first acceptance-contract evidence card that maps an unknown company problem to exact rerunnable evidence, approver decision, residual risk, and rerun trigger, see [AX rollout acceptance contract card](ax-rollout-acceptance-contract-card.md).

For a Korean-first REAL PROBLEM / REAL JUDGE / REAL OUTPUT map to current fixture-backed commands, see [AX real judge demo map](ax-real-judge-demo-map.md).

For Korean-first prelim judge Q&A scripts with evidence commands and non-claim guardrails, see [AX prelim judge Q&A](ax-prelim-judge-qa.md).

For a 30-second onsite company-problem pivot into existing evidence commands, see [AX onsite pivot guide](ax-onsite-pivot-guide.md).

For a Korean-first onsite decision log that maps company problem, decision, evidence command, verdict, approver/action, and rerun trigger, see [AX onsite decision log](ax-onsite-decision-log.md).

For a Korean-first 6-hour onsite execution board from company problem intake to scan commands, SARIF/Markdown handoff, and judge story, see [AX 6-hour onsite execution board](ax-6-hour-onsite-execution-board.md).

For a Korean-first first-minute evidence priority card that tells operators which fixture-backed proof to show first, see [AX first-60-seconds evidence priority card](ax-first-60-seconds-evidence-priority.md).

For a Korean-first guardrail/tripwire evidence card that maps public agent guardrail concepts to exact AgentGuard approval evidence, see [AX guardrail tripwire evidence card](ax-guardrail-tripwire-evidence-card.md).

For Korean-first guardrail review checkpoints that map public guardrail/security signals to exact AgentGuard evidence commands and owner decisions, see [AX guardrail review checkpoints](ax-guardrail-review-checkpoints.md).

For a Korean-first agent hook-event approval route that maps hook-style tool events to transcript/MCP/PR/SARIF evidence and approval decisions, see [AX agent hook event approval route](ax-agent-hook-event-approval-route.md).

For a Korean-first agent/tool onboarding readiness card that maps `doctor`, MCP config, transcript/log, PR diff, and SARIF handoff evidence to rollout approval decisions, see [AX agent tool onboarding readiness](ax-agent-tool-onboarding-readiness.md).

For a Korean-first 60-second agent rollout preflight path from `doctor --json` to PR diff, MCP config, transcript/log, and SARIF reviewer evidence, see [AX agent rollout preflight checklist](ax-agent-rollout-preflight-checklist.md).

For a Korean-first public-reference-to-run-decision trace that maps public signals to exact fixture-backed evidence commands, see [AX public reference run trace](ax-public-reference-run-trace.md).

For a Korean-first source-status-to-evidence decision matrix that maps public fetch, WAF/403, registry fallback, auth boundary, and insane-search unavailable states to exact evidence commands, see [AX public reference decision matrix](ax-public-reference-decision-matrix.md).

For a Korean-first public-reference source-status drill that maps `HTTP 200`, `403/WAF`, registry fallback, auth/login boundary, and stale-reference states to exact AgentGuard evidence commands, see [AX public-reference source-status drill](ax-public-reference-source-status-drill.md).

## AX company problem intake kit

[AX company problem intake kit](ax-company-problem-intake-kit.md) turns an unknown Korean company problem into a reusable AX Rollout Guard demo plan: business workflow, agent/tool surface, risky inputs, AgentGuard commands, `BLOCK → 수정/정책 → PASS` evidence, approval report, and a 30-second script.

For a Korean-first evidence receipt checklist covering PR diff, MCP, transcript/log, SARIF, and reviewer handoff surfaces, see [AX evidence receipt checklist](ax-evidence-receipt-checklist.md).

For a Korean-first vocabulary map from `PASS` / `REVIEW` / `BLOCK` to judge-facing Korean evidence language, see [AX verdict vocabulary glossary](ax-verdict-vocabulary-glossary.md).

For a Korean-first source-of-record audit card that separates agent self-report from repo/CI/host artifacts plus rerunnable commands, see [AX source-of-record audit card](ax-source-of-record-audit-card.md).

For a Korean-first tamper/replay check that maps PR diff, MCP config, transcript/log, and SARIF/report evidence to source artifact, rerun command, hash/freshness cue, and approver action, see [AX evidence tamper/replay check](ax-evidence-tamper-replay-check.md).

For a Korean-first public evidence redaction boundary that maps PR diff/MCP/transcript/SARIF handoff to release/redaction rules and approver actions, see [AX public evidence redaction boundary](ax-public-evidence-redaction-boundary.md).

For a Korean-first evidence-to-approver channel map that routes PR diff, MCP config, transcript/log, and SARIF evidence to owner decisions and rerun triggers, see [AX evidence-to-approver channel map](ax-evidence-to-approver-channel-map.md).

For a Korean-first evidence command failure triage card that separates expected risky nonzero exits from build, fixture, stale-artifact, SARIF, and reviewer non-response failures, see [AX evidence command failure triage card](ax-evidence-command-failure-triage.md).

For a Korean-first evidence freshness SLA card that maps PR diff, MCP config, transcript/log, SARIF, and smoke manifest evidence to rerun windows, source-of-record checks, and approval-owner actions, see [AX evidence freshness SLA card](ax-evidence-freshness-sla-card.md).

For a Korean-first evidence pack exit criteria card that maps PR/MCP/transcript/SARIF evidence to accept, rerun, or block handoff decisions, see [AX evidence pack exit criteria card](ax-evidence-pack-exit-criteria.md).

For a Korean-first judging-lens trace card that maps AX 대상권 scoring questions to exact current AgentGuard evidence commands and public-reference guardrails, see [AX judging lens trace card](ax-judging-lens-trace-card.md).

For a Korean-first evidence bundle manifest that groups exact fixture-backed commands, expected artifacts, public-reference borrow/avoid notes, and non-claim guardrails, see [AX evidence bundle manifest](ax-evidence-bundle-manifest.md).

For a Korean-first smoke evidence manifest handoff card that maps `npm run smoke:ax-demo` manifest checks to PR diff, MCP config, transcript/log, and SARIF reviewer artifacts, see [AX smoke evidence manifest handoff card](ax-smoke-evidence-manifest-handoff-card.md).

For a Korean-first 10-minute evidence freeze checklist covering PR diff, MCP config, transcript/log, SARIF/report artifact, and smoke manifest replay, see [AX demo evidence freeze checklist](ax-demo-evidence-freeze-checklist.md).

For a Korean-first evidence freeze sign-off ledger that maps frozen commerce VOC artifacts to approver, sign-off condition, and rerun trigger, see [AX evidence freeze sign-off ledger](ax-evidence-freeze-signoff-ledger.md).

For a Korean-first final company-problem worksheet with fixture-backed commands and public-reference guardrails, see [AX final company-problem worksheet](ax-final-problem-worksheet.md).

For a Korean-first final submission smoke checklist covering PR diff, MCP config, transcript/log, and SARIF/report artifact checks, see [AX final submission smoke checklist](ax-final-submission-smoke-checklist.md).

For a Korean-first pilot responsibility handoff that assigns business approval, residual risk, rollback, and evidence rerun owners, see [AX pilot responsibility card](ax-pilot-responsibility-card.md).

For a Korean-first approval owner escalation matrix that maps `PASS` / `REVIEW` / `BLOCK` evidence to business/security owner action and rerun responsibility, see [AX approval owner escalation matrix](ax-approval-owner-escalation-matrix.md).

For a Korean-first security reviewer question bank that maps workspace trust, least-privilege, agent/MCP surface inventory, and SARIF handoff questions to exact evidence commands, see [AX security reviewer question bank](ax-security-reviewer-question-bank.md).

For a Korean-first human approval gate checklist that maps enterprise security-owner questions to exact `scan-mcp`, `scan-diff`, `scan-log`, and SARIF evidence commands, see [AX human approval gate checklist](ax-human-approval-gate-checklist.md).

For a Korean-first incident response evidence card mapping AgentGuard `BLOCK` / `REVIEW` findings to triage, containment owner, fix/policy condition, rerun command, and approval/residual-risk sentence, see [AX incident response evidence card](ax-incident-response-evidence-card.md).

For a Korean-first finding lifecycle approval card mapping finding, source evidence, owner, fix/policy condition, rerun command/artifact, and approval decision, see [AX finding lifecycle approval card](ax-finding-lifecycle-approval-card.md).

For a Korean-first agent feedback-loop evidence card mapping finding, owner, fix condition, rerun command/artifact, and approval decision, see [AX agent feedback-loop evidence card](ax-agent-feedback-loop-evidence-card.md).

For a Korean-first timeboxed escalation drill mapping `PASS` / `REVIEW` / `BLOCK` to owner, timebox, exact evidence command/artifact, and rerun trigger, see [AX timeboxed escalation drill](ax-timeboxed-escalation-drill.md).

For a Korean-first reviewer non-response fallback card mapping `PASS` / `REVIEW` / `BLOCK` and reviewer non-response to owner, timeout, fallback artifact, rerun command, and residual-risk decision, see [AX reviewer non-response fallback card](ax-reviewer-nonresponse-fallback-card.md).

For a Korean-first first-run trust path from `agentguard --help` and `agentguard doctor` to fixture-backed PR/MCP/transcript/SARIF evidence, see [AX CLI trust onboarding card](ax-cli-trust-onboarding-card.md).

For a Korean-first change-control evidence card mapping change request to AgentGuard evidence, approver decision, and rollback/rerun, see [AX agent change-control evidence card](ax-agent-change-control-evidence-card.md).

For a Korean-first public-reference delta watch that maps fresh public signals to exact fixture-backed evidence commands without unsupported adoption, endorsement, or scope claims, see [AX public-reference delta watch](ax-public-reference-delta-watch.md).

For a Korean-first official public-signal freshness card that separates public AX/security signals from gated portal unknowns and routes them to exact evidence commands, see [AX official public-signal freshness](ax-official-public-signal-freshness.md).

For a Korean-first alert queue runbook mapping finding, queue owner, exact AgentGuard command, expected verdict, decision owner, and rerun trigger, see [AX alert triage queue runbook](ax-alert-triage-queue-runbook.md).

For a Korean-first control objective map that converts unknown company problem signals into exact AgentGuard evidence commands, approver decisions, and rerun/freshness triggers, see [AX control objective map](ax-control-objective-map.md).

For a Korean-first control-plane CI gate card that maps CLI evidence, CI status, SARIF/report artifacts, and control-plane boundaries to rollout approval decisions, see [AX control-plane CI gate card](ax-control-plane-ci-gate-card.md).

For a Korean-first public scanner signal refresh ledger that turns current public scanner/reference cues into Borrow/Avoid/AgentGuard-action rows and exact evidence commands, see [AX public scanner signal refresh ledger](ax-public-scanner-signal-refresh-ledger.md).

For a Korean-first public reference fallback provenance card that labels normal fetch, WAF/403, registry fallback, and unavailable insane-search evidence before routing it to exact AgentGuard commands, see [AX public reference fallback provenance card](ax-public-reference-fallback-provenance.md).

For a Korean-first third-party agent scanner due-diligence card that explains coexistence with Snyk agent-scan, AI-Infra-Guard, agentic-radar, and SARIF handoff without parity or runtime-enforcement claims, see [AX third-party agent scanner due diligence card](ax-third-party-agent-scanner-due-diligence.md).

For a Korean-first emergency stop runbook that maps `BLOCK`/`REVIEW` evidence to rollout pause, recovery action, exact rerun command, and resume condition, see [AX emergency stop runbook](ax-emergency-stop-runbook.md).

For a Korean-first permission-mode exception queue that maps Codex/Claude Code/Cursor/MCP tool permission requests to exact AgentGuard evidence commands and approval owners, see [AX agent permission exception queue](ax-agent-permission-exception-queue.md).

## SARIF

```bash
agentguard scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff
```

A sample SARIF payload is stored at [`examples/agentguard.sarif`](../examples/agentguard.sarif).
