# GitHub Actions setup

AgentGuard can be used as a team PR gate without copying this repository into the target repo. The recommended workflow below installs the published npm CLI through the reusable action, scans the pull request diff, uploads SARIF, uploads artifacts, and posts the markdown report back to the pull request.

For baseline/noise triage and reviewer handoff, see the [Team rollout baseline guide](team-rollout-baseline-guide.md).

## Recommended team PR gate

Create `.github/workflows/agentguard.yml` in the repository you want to protect:

```yaml
name: AgentGuard PR gate
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  agentguard:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v5
        with:
          node-version: 22

      - name: Run AgentGuard
        id: agentguard
        uses: Sungho-pk42ac/agentguard@main
        with:
          base-sha: ${{ github.event.pull_request.base.sha }}
          head-sha: ${{ github.event.pull_request.head.sha }}
          report-path: agent-risk-report.md
          json-path: agent-risk-findings.json
          sarif-path: agentguard.sarif
          fail-on: block

      - name: Upload AgentGuard SARIF
        if: ${{ !cancelled() && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) }}
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: agentguard.sarif

      - name: Upload AgentGuard artifacts
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: agentguard-pr-evidence
          path: |
            agent-risk-report.md
            agent-risk-findings.json
            agentguard.sarif

      - name: Comment AgentGuard report on PR
        if: ${{ !cancelled() && github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository }}
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body-path: agent-risk-report.md
```

What the team gets on every PR:

- `PASS`, `REVIEW`, or `BLOCK` conclusion in the GitHub job summary.
- A markdown report suitable for PR review comments.
- JSON findings for automation and archival evidence.
- SARIF upload for GitHub code scanning.
- A default fail-closed gate only for `BLOCK` findings, so lower-risk review items do not break adoption on day one.

## Timeout and evidence preservation

`timeout-minutes: 10` is a CI operations guardrail for the required status check that bounds stalled checkout, npm install, SARIF upload, or scanner execution so a PR gate does not hang indefinitely. The timeout does not change `PASS`, `REVIEW`, or `BLOCK` verdict semantics; scanner execution errors still fail the job. Keep artifact upload guarded with `if: ${{ !cancelled() }}` so completed Markdown, JSON, and SARIF evidence is preserved when AgentGuard reports a blocking finding, while a true timeout/cancellation remains visible as a CI failure that should be rerun or investigated.

## Fork PR permission boundary

Public fork PRs usually run with a read-only `GITHUB_TOKEN`. Keep the recommended workflow on the `pull_request` event and treat PR comments and GitHub code scanning upload as same-repository conveniences, not as required evidence. The SARIF upload and comment steps are intentionally guarded by `github.event.pull_request.head.repo.full_name == github.repository`; when that condition is false, the artifact-only fallback is the source of record: job summary, Markdown report, JSON findings, and the generated SARIF file preserved by `actions/upload-artifact`.

Do not switch this workflow to `pull_request_target` just to comment on forks or upload code-scanning results. If a team uses `pull_request_target` for a separate maintainer-owned workflow, do not check out or execute untrusted fork code with write permissions. Safer fork flow: let the fork PR produce artifacts with read-only permissions, then a maintainer can rerun AgentGuard on a same-repository branch if a write-token PR comment or code-scanning upload is required for review.

## Required status check rollout

Start in trial mode with `fail-on: never` or `fail-on: block` so the team can learn the report shape, baseline noise, and fork-permission behavior before blocking delivery. After the workflow has produced stable artifacts on several PRs, make the AgentGuard workflow job a required status check for the protected branch.

Manual rollout path:

1. Keep the workflow on the `pull_request` event and keep artifact upload enabled with `if: ${{ !cancelled() }}` so evidence is preserved even when AgentGuard blocks.
2. In GitHub, go to Settings → Branches → Branch protection rules → Require status checks, then select the AgentGuard job name (for example `agentguard`). Repositories that already use the newer rules UI can do the same under Settings → Rules → Rulesets by adding a required status check rule for the AgentGuard job.
3. Keep `fail-on: block` while teams are still triaging expected `REVIEW` findings.
4. After the baseline/noise process is documented, tighten to `fail-on: review` for repositories that want any non-pass verdict to block merge.

API-oriented teams can review or update branch protection through GitHub's REST endpoint. This example is a GET request to inspect the current branch-protection contract; updating protection requires an explicit PUT/PATCH-style API call with the required contexts payload for your repository policy.

```bash
gh api repos/OWNER/REPO/branches/BRANCH/protection
```

Do not use `pull_request_target` to check out or execute untrusted fork code when making AgentGuard a required check. For public fork PRs, the required check should rely on the read-only `pull_request` run plus uploaded artifacts, or on a maintainer rerun from a same-repository branch when a write-token comment/SARIF handoff is required.

## Action inputs

| Input | Default | Purpose |
|---|---:|---|
| `base-sha` | required | Pull request base commit SHA. |
| `head-sha` | required | Pull request head commit SHA. |
| `report-path` | `agent-risk-report.md` | Markdown report path for comments and artifacts. |
| `json-path` | `agent-risk-findings.json` | Machine-readable findings path. |
| `sarif-path` | `agentguard.sarif` | SARIF path for code scanning upload. |
| `policy-path` | empty | Optional repo-specific AgentGuard policy file. |
| `package-version` | `latest` | npm package version/dist-tag to install. Pin this for regulated teams. |
| `fail-on` | `block` | `block`, `review`, or `never`. |

## Exit behavior

- `fail-on: block` fails the job only when the score-based `BLOCK` verdict is present. Advisory findings are excluded from the gate score.
- `fail-on: review` fails the job on any finding.
- `fail-on: never` always reports artifacts and leaves enforcement to reviewers or branch protection.
- Scanner execution errors still fail the job regardless of `fail-on`.

## SARIF-only local build workflow

If you are developing AgentGuard itself inside this repository, you can still build the local CLI and upload SARIF manually:

```yaml
name: AgentGuard code scanning
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  security-events: write

jobs:
  agentguard-sarif:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Emit AgentGuard SARIF
        run: |
          git diff --unified=0 ${{ github.event.pull_request.base.sha }}...${{ github.event.pull_request.head.sha }} \
            | node dist/index.js scan-diff --sarif --out agentguard.sarif || true

      - name: Upload AgentGuard SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: agentguard.sarif
```

## Legacy local action workflow

This repository also contains `.github/actions/agentguard` for testing the action against the checked-out source tree before a release. External teams should prefer `uses: Sungho-pk42ac/agentguard@main` until the next stable action tag is cut.

```yaml
name: AgentGuard PR scan
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  agentguard:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm

      - name: Run AgentGuard on PR diff
        id: agentguard
        uses: ./.github/actions/agentguard
        with:
          base-sha: ${{ github.event.pull_request.base.sha }}
          head-sha: ${{ github.event.pull_request.head.sha }}
          report-path: agent-risk-report.md

      - name: Upload AgentGuard report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: agentguard-pr-report
          path: agent-risk-report.md

      - name: Comment AgentGuard report on PR
        if: ${{ !cancelled() && github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository }}
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body-path: agent-risk-report.md
```

## Notes

- Use `fetch-depth: 0` so the base and head SHAs are available for diffing.
- Scope workflow permissions to the minimum needed: `contents: read`, plus `pull-requests: write` for comments and `security-events: write` for SARIF.
- Start with `fail-on: block` for low-friction rollout, then move mature teams to `fail-on: review` once baseline noise is understood.
- Public fork pull requests usually receive read-only `GITHUB_TOKEN`; the recommended comment step is intentionally limited to same-repository PRs while SARIF/artifacts still upload when permissions allow.
