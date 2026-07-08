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
        if: ${{ !cancelled() }}
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
        if: ${{ !cancelled() && github.event.pull_request.head.repo.full_name == github.repository }}
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
        if: ${{ !cancelled() && github.event.pull_request.head.repo.full_name == github.repository }}
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
