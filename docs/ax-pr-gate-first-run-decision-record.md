# AX PR gate first-run decision record

한국어 우선 팀 도입 카드입니다. 목적은 AgentGuard GitHub Action을 처음 붙인 PR에서 **무엇을 source-of-record로 남기고, 어떤 owner가 어떤 결정을 해야 하는지**를 한 장으로 고정하는 것입니다. 이 카드는 현재 구현된 reusable action, Markdown/JSON/SARIF artifact, PR comment, required status check 운영만 다룹니다.

## When to fill this out

다음 상황에서 PR reviewer 또는 rollout owner가 이 record를 채웁니다.

1. 팀 repo에 `Sungho-pk42ac/agentguard@main` workflow를 처음 붙였다.
2. AgentGuard job이 `PASS`, `REVIEW`, `BLOCK` 중 하나를 냈고 Markdown/JSON/SARIF artifact가 생성됐다.
3. branch protection의 required status check로 올릴지, trial mode로 둘지, owner remediation을 요구할지 결정해야 한다.

## Source-of-record fields

| Field | Record value | Why it matters |
|---|---|---|
| PR / commit | PR number, base SHA, head SHA, workflow run URL | 같은 diff를 다시 실행할 수 있는 기준점입니다. |
| Required status check | AgentGuard job name and current branch protection state | `conclusion`이 merge gate에 실제로 연결됐는지 구분합니다. |
| Action outputs | `conclusion`, `finding-count`, `advisory-count`, `review-count`, `block-count` | owner routing과 fail-on 정책을 같은 숫자로 설명합니다. |
| Artifacts | `report-path`, `json-path`, `sarif-path` | Markdown review, JSON automation, SARIF/code scanning handoff의 source-of-record입니다. |
| Reviewer note | accepted, rerun required, fix required, or rollout stop | agent self-report가 아니라 reviewer decision을 남깁니다. |

## Output-to-owner routing

| Action output | Team owner decision |
|---|---|
| `conclusion=pass` and `finding-count=0` | Service owner can keep the required status check green, then record residual risk as none observed for this diff. |
| `advisory-count>0` | Reviewer records advisory-only context separately; advisory findings are excluded from gate scoring but still part of the evidence packet. |
| `conclusion=review` or `review-count>0` | Service owner and security reviewer decide whether the finding is expected, needs a policy note, or requires a fix before rollout. |
| `conclusion=block` or high `block-count` | Rollout owner stops merge until the risky diff, MCP config, or transcript/log evidence is fixed and rerun. `block-count` is a weighted risk score, not a literal finding count. |
| Markdown `report-path` exists | PR reviewer reads the human report and records the decision in the PR thread or release receipt. |
| JSON `json-path` exists | Automation owner can archive exact rule IDs, severities, and redacted evidence. |
| SARIF `sarif-path` exists | Security tooling owner can hand off GitHub code scanning evidence without changing scanner verdict semantics. |

Decision rule: `fail-on: block` only decides whether the GitHub Action job fails. It does not change the meanings of `PASS`, `REVIEW`, `BLOCK`, `finding-count`, `advisory-count`, `review-count`, `block-count`, JSON, SARIF, or the Markdown report.

## Fixture-backed smoke commands

Run these from a fresh clone after `npm ci && npm run build`. The inputs are synthetic repository fixtures; they do not contain real customer data or credentials.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/pr-gate-first-run.sarif < examples/risky-pr.diff
```

Expected behavior:

- PR diff smoke should show `BLOCK` or `REVIEW` evidence for synthetic risky added material.
- MCP smoke should show broad filesystem/env passthrough style evidence from the synthetic scenario.
- Transcript/log smoke should show policy-routed risky command evidence.
- SARIF smoke should create `.agentguard-demo/pr-gate-first-run.sarif` for reviewer handoff. Keep `.agentguard-demo/` ignored or temporary; it is evidence output, not product source.

## Decision record template

```markdown
## AgentGuard first PR-gate decision
- PR / run:
- Base SHA / head SHA:
- Required status check context:
- `conclusion`:
- `finding-count` / `advisory-count` / `review-count` / `block-count`:
- Markdown `report-path`:
- JSON `json-path`:
- SARIF `sarif-path`:
- Owner decision: accept / rerun / fix required / rollout stop
- Owner and expiry:
- Rerun command or workflow URL:
- Residual risk note:
```

## Boundaries

- This card does not add suppression storage, allowlist storage, or new scanner verdict semantics.
- This card does not make AgentGuard an external observability service or outside compliance authority.
- Reviewer decisions must be tied to source artifacts: PR diff, Markdown report, JSON findings, SARIF, and workflow run URL.
- Secrets remain redacted. If a real credential is suspected, rotate or revoke it outside this document and record only redacted evidence plus remediation owner.
