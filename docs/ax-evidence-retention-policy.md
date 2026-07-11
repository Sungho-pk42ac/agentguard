# AX evidence retention policy card

한국어 우선 운영 카드입니다. AgentGuard가 만든 Markdown report, JSON findings, SARIF, PR comment, GitHub Actions artifact를 팀 reviewer가 바로 보존·만료·재실행 판단에 연결하도록 정리합니다. 이 문서는 retention SaaS나 법무 정책을 새로 제공한다고 주장하지 않고, 현재 CLI와 GitHub Action evidence를 source-of-record로 다루는 운영 기준만 설명합니다.

## 사용 목적

- 팀 도입 첫날에 `PASS`, `REVIEW`, `BLOCK` evidence를 어디에 남길지 정한다.
- reviewer가 agent self-report 대신 rerunnable command와 artifact를 source-of-record로 보게 한다.
- stale evidence를 발견하면 같은 git SHA, policy version, rule IDs 기준으로 fresh evidence를 다시 만들게 한다.
- compliance나 legal retention을 대체하지 않는다. 조직별 보존 기간은 Approver와 Security reviewer가 내부 기준으로 확정한다.

## Retention policy matrix

| Evidence artifact | Source of record | Retention owner | Suggested retention window | Expiry/rerun trigger |
|---|---|---|---|---|
| Markdown report | `agent-risk-report.md`, PR comment, or GitHub Actions artifact | Security reviewer | 30 days for normal PR review, longer only if an internal incident ticket says so | PR diff, policy version, rule IDs, or scanner package version changed |
| JSON findings | `agent-risk-findings.json` artifact from the GitHub Action or local CLI | Security reviewer + automation owner | 90 days for rollout audit sampling | JSON schema, verdict calculation, or finding severity changed |
| SARIF | `agentguard.sarif` or `.agentguard-demo/retention/agentguard.sarif` | Security reviewer + code scanning owner | 90 days or the repository code-scanning evidence window | SARIF upload failed, alert state changed, or the reviewed git SHA changed |
| PR comment | Same Markdown report copied into the pull request | PR Approver | Until PR merge/close plus the team’s normal PR retention | comment is missing, truncated, or no longer matches the artifact |
| GitHub Actions artifact | Uploaded Markdown/JSON/SARIF bundle | CI owner | Repository artifact retention setting, often 30 days | artifact expired, run was re-run, or the target branch changed |

Retention owner means “who reruns and signs off on evidence freshness,” not who stores secrets. AgentGuard reports are designed to be redacted; never preserve raw credentials as evidence.

## Source-of-record artifacts

Use repository evidence in this order:

1. Same commit SHA local rerun command output.
2. GitHub Actions artifact bundle with Markdown report, JSON findings, and SARIF.
3. PR comment only if it matches the Markdown artifact.
4. Human summary or agent chat only as a pointer to rerun evidence, never as the final source-of-record.

A finding is fresh only when the artifact names the same git SHA or the reviewer can prove it was produced from the same diff and policy version. If the team cannot prove this, mark the decision `REVIEW` and rerun AgentGuard.

## Fixture-backed rerun commands

Run from a fresh clone after `npm ci && npm run build` when using `node dist/index.js`. `.agentguard-demo/` is gitignored scratch space for generated evidence:

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
mkdir -p .agentguard-demo/retention
node dist/index.js scan-diff --sarif --out .agentguard-demo/retention/agentguard.sarif < examples/risky-pr.diff
```

Expected contract:

- `examples/agentguard.sarif` is the checked-in sample SARIF handoff artifact for reviewer orientation.
- `PASS` means no blocking finding is present for that surface.
- `REVIEW` means a human approver must record residual risk or a policy exception before rollout.
- `BLOCK` means rollout stops until the finding is removed or a safer fixture/policy proves the risk is gone.
- `scan-diff`, `scan-mcp`, `scan-log`, `JSON`, `SARIF`, verdict, rule IDs, and API/machine fields stay English-compatible.

## Expiry and rerun triggers

Rerun evidence when any of these change:

- target git SHA, base/head diff, or branch protection status;
- `agent-policy.yaml` contents, org baseline, or policy version;
- scanner package version, rule IDs, severity scoring, or report format;
- GitHub Actions artifact retention expiration;
- PR comment was edited manually or no longer matches the Markdown report;
- reviewer sees stale artifact timestamps, missing SARIF, or a JSON findings file from another run.

When evidence expires, keep the old artifact as context if the organization needs it, but do not use it as the active approval basis. Create fresh evidence with the same fixture-backed command shape and record the new git SHA.

## Reviewer handoff checklist

- [ ] Artifact bundle contains Markdown report, JSON findings, and SARIF when SARIF is relevant.
- [ ] The artifact is tied to the same git SHA and policy version being approved.
- [ ] `PASS` / `REVIEW` / `BLOCK` is copied exactly from AgentGuard output.
- [ ] Security reviewer records owner, decision, retention window, and rerun trigger.
- [ ] Approver does not accept screenshots, chat summaries, or agent self-report without rerunnable evidence.
- [ ] No raw credential or unredacted secret is preserved in the evidence bundle.

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow | GitHub Actions artifact handoff is a practical review surface. | Do not assume artifacts live forever or replace internal retention policy. | Keep Markdown/JSON/SARIF artifact names explicit and rerunnable from fixture commands. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF is useful as reviewer handoff and code-scanning evidence. | Do not claim SARIF upload equals business approval. | Pair SARIF with JSON findings and a human approver decision for `REVIEW`/`BLOCK`. |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Treat agent/tool evidence as repeatable control proof, not agent self-report. | Do not overclaim runtime enforcement or complete agent-security coverage. | Preserve source-of-record commands and rerun stale evidence before approval. |

## Machine-contract and fake-claim guardrails

- Do not rename or translate CLI commands, rule IDs, JSON keys, SARIF fields, verdict values, or API/machine fields.
- Do not claim hosted retention, cloud archival, legal hold, customer deployment, official certification, or scanner parity from this card.
- This card documents a reviewer workflow over current AgentGuard artifacts; it does not implement new storage, runtime authorization, OAuth/session enforcement, or a legal retention engine.
- If the team needs formal legal retention, open a separate issue for organization policy and keep this card as technical evidence handoff only.
