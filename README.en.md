<p align="center">
  <img src="docs/banner.png" alt="AgentGuard" width="840" />
</p>

# AgentGuard

[한국어](README.md)

[![npm](https://img.shields.io/npm/v/%40pk42ac%2Fagentguard)](https://www.npmjs.com/package/@pk42ac/agentguard)
![CI](https://github.com/Sungho-pk42ac/agentguard/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)
![Tests](https://img.shields.io/badge/tests-999%20passing-brightgreen)
![SARIF](https://img.shields.io/badge/SARIF-supported-purple)
![License](https://img.shields.io/github/license/Sungho-pk42ac/agentguard)

Licensed under the [Apache License 2.0](LICENSE).

**Security scanner for AI coding agents, MCP configs, transcripts, and PR diffs.**

AgentGuard helps teams catch leaked secrets, dangerous MCP permissions, unsafe agent shell behavior, and risky PR diffs before they reach production.

As of v0.3.0, AgentGuard delivers **AI coding agent lifecycle security** as a local workflow — an **onboarding inspection** of the AI tools and permissions installed on a new hire's machine, an **offboarding sweep** that finds residual credentials on a departing employee's machine and deletes them only after explicit approval (with an audit report), and an **admin-only local terminal dashboard** (`agentguard`) to run it all. This local workflow runs offline on the target machine with no required web or central server; the v0.5 control plane and web console below are an opt-in hybrid-SaaS layer.

<p align="center">
  <img src="docs/screenshot-overview.png" alt="AgentGuard dashboard terminal screenshot — Overview tab: findings-by-surface bar chart with a PASS/REVIEW/BLOCK verdict badge" width="900" />
</p>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshot-credentials.png" alt="Credentials tab with detail panel" /><br/><sub><b>Credentials</b> — findings explorer + detail (severity rationale, redacted evidence, fix)</sub></td>
    <td width="50%"><img src="docs/screenshot-posture.png" alt="Posture tab" /><br/><sub><b>Posture</b> — over-permissioned MCP/agent config</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshot-agents.png" alt="Agents tab" /><br/><sub><b>Agents</b> — installed AI CLI/tool inventory</sub></td>
    <td width="50%"><img src="docs/screenshot-offboard.png" alt="Offboard tab" /><br/><sub><b>Offboard</b> — approval-gated offboarding sweep</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshot-cli.png" alt="AgentGuard CLI report — doctor and scan-diff" width="860" />
</p>

## Install

```bash
npm install -g @pk42ac/agentguard
```

## Quick start

```bash
# Scan a repo/workspace (default Markdown report is Korean)
agentguard scan-files .

# Check local package/examples/scanner readiness
agentguard doctor

# Check local Claude/Codex/Gemini/MCP agent permission posture
agentguard posture .

# Emit English Markdown reports when needed
agentguard scan-files . --lang en

# Scan a PR diff
git diff origin/main...HEAD | agentguard scan-diff

# Emit SARIF for GitHub code scanning
git diff origin/main...HEAD | agentguard scan-diff --sarif --out agentguard.sarif

# Scan Codex/MCP config
agentguard scan-mcp < ~/.codex/config.toml

# Or pass a file path (for shells without `<` stdin redirection, e.g. PowerShell)
agentguard scan-mcp ~/.codex/config.toml

# Interactive dashboard (TTY): 7 tabs (workflow order) + search/sort/presets/watch/mouse + /offboard sweep
agentguard        # or: agentguard repl
```

Run bare `agentguard` (or `agentguard repl`) in a TTY to open a tokscale-style full-screen admin dashboard. The 7 top tabs are laid out in scan → fix → verify workflow order (Overview/Credentials/Posture/Agents/Baseline/Offboard/Fleet); switch them with `tab`/`←→`, and move through the findings list with `↑↓` (or `j`/`k`) and `enter` for the detail panel — which shows the full path plus a **severity rationale and category-specific remediation guidance**. Keys: `f` severity filter, `g` severity sort, `/` live search (surface·path·evidence), `i` session-hide (writes no file, verdict/aggregate unchanged), `e` open the selected finding in your editor (Credentials/Posture tabs), `1`/`2`/`3` scan presets (Quick/Project/Full — Quick runs immediately, Full asks for confirmation) with live per-surface progress, `w` 30s auto-rescan (watch), `?` full keybind overlay, and mouse support (wheel scroll · tab click). Overview shows a findings-by-surface bar chart and a `PASS/REVIEW/BLOCK` verdict badge; the **Baseline tab snapshots the current scan with `[s]` and shows drift (appeared/disappeared/rotated) vs the last baseline**; the **Fleet tab shows the org-wide control-plane findings summary (by severity, by asset) once logged in**. The bottom bar exposes `[o]` offboarding sweep, `[r]` rescan, and `[q]` quit. In non-TTY contexts (pipes/CI) the usual help text is printed, preserving script backward compatibility. Every cleanup (delete) action applies only after explicit approval (y), and deleted targets are moved to `~/.agentguard/trash` (a recoverable backup) rather than hard-deleted.

## Why

AI agents now connect to codebases, terminals, GitHub, databases, Slack, Drive, and internal tools. Existing SAST tools inspect application code, but they rarely answer:

> “What did the agent read, run, expose, or try to change?”

AgentGuard focuses on **agent behavior risk**: secrets in agent-visible files, risky tool permissions, dangerous shell patterns, and PR changes that deserve human security review.

## What AgentGuard checks

| Surface | Examples |
|---|---|
| Secrets | OpenAI/Anthropic/GitHub/Google-style tokens, credential-shaped environment values |
| Agent logs | risky shell commands, sensitive paths, unsafe operations visible in transcripts |
| PR diffs | newly-added secrets, PII, dangerous commands, agent policy violations |
| MCP/Codex config | broad filesystem roots, writable paths, credential passthrough, full-access servers |
| Policy files | YAML/JSON policy aliases, malformed policy documents, unsafe duplicates |
| Shell rc keys | API keys / credential-named vars exported in `.bashrc`/`.zshrc`/PowerShell `$PROFILE` |
| npm global AI CLIs | globally installed AI coding CLIs (Claude Code/Codex/Gemini/…) as onboarding/offboarding signals |
| AI tool config | residual credentials in `~/.claude`/`~/.codex`, Claude Desktop/Cursor MCP config |

## Example finding

```text
BLOCK  secret.github_token
Found a GitHub token in an agent-visible diff. Evidence is redacted before reporting.

REVIEW  mcp.broad_filesystem_access
MCP configuration exposes a broad filesystem root with write-capable access.
```

Verdicts:

- `PASS`: no findings
- `REVIEW`: non-critical findings, human review recommended
- `BLOCK`: high aggregate risk or critical secret/full-access finding

## Documentation

- [GitHub Actions / SARIF setup](docs/github-action.md)
- [Policy files](docs/policy.md)
- [Rule surfaces](docs/rules.md)
- [Examples](docs/examples.md)
- [AX live demo runbook](docs/ax-live-demo-runbook.md)
- [AX before/after rollout demo](docs/ax-before-after-rollout-demo.md)
- [AX judge evidence index (Korean)](docs/ax-judge-evidence-index.md)
- [AX submission readiness scorecard (Korean)](docs/ax-submission-readiness-scorecard.md)
- [Roadmap](docs/roadmap.md)
- [Development harness](docs/harness-workflow.md)

## Examples

- [`examples/risky-mcp.json`](examples/risky-mcp.json) — risky MCP filesystem config
- [`examples/risky-pr.diff`](examples/risky-pr.diff) — PR diff with fake secret-like material
- [`examples/agent-transcript.log`](examples/agent-transcript.log) — agent transcript with risky shell behavior
- [`examples/expected-report.md`](examples/expected-report.md) — sample markdown report
- [`examples/agentguard.sarif`](examples/agentguard.sarif) — sample SARIF payload

## GitHub code scanning workflow

Copy this workflow into `.github/workflows/agentguard-sarif.yml` to scan pull request diffs, write `agentguard.sarif`, and upload the result to GitHub code scanning. The `scan-diff --sarif --out agentguard.sarif` command matches the implemented CLI flags.

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
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

## GitHub PR comment workflow

Copy this workflow into `.github/workflows/agentguard-pr.yml` to scan pull request diffs, persist the markdown report as an artifact, and post the same report as a PR comment. Critical findings fail the check; review-level findings keep the check green for human review.

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
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
        if: ${{ !cancelled() }}
        uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body-path: agent-risk-report.md
```

## Control Plane (Fleet · Observe)

At org scale, each developer PC and CI reports its local scan results to a central **control plane**, so a security team sees fleet-wide risk on one screen. Core principle: **raw values and secrets never leave the target machine — only redacted metadata and aggregates are transmitted (hybrid).** As of v0.5, Observe (ingest, aggregate, alert) is joined by native session auth, orgs/invites, policy sync, an offboarding webhook, CVE enrichment, and a same-origin management console — see [v0.5 — CLI evolution and the hybrid-SaaS control plane](#v05--cli-evolution-and-the-hybrid-saas-control-plane) below for the full surface.

### report agent — `agentguard report --push`

Redacts and signs local scan results, then sends them to the control plane. Without `--push`, every command behaves byte-identically to before (backward compatible). The payload only carries rule IDs, surface, severity, a home/username-stripped location, redacted evidence, and a fingerprint hash. A redaction guard runs immediately before egress and exits **without any network call** if it finds a raw-secret pattern.

```bash
# CI (OIDC): authenticate with a GitHub/GitLab id-token
git diff origin/main...HEAD | AGENTGUARD_OIDC_TOKEN="$ID_TOKEN" \
  agentguard scan-diff --push --endpoint https://cp.example --org acme

# Developer PC (device token): uses ~/.agentguard/enrollment.json
agentguard scan-files . --push --endpoint https://cp.example
```

### control plane server — `control-plane/`

A separate hybrid-SaaS control-plane package. It ingests redacted findings and serves a per-org aggregation dashboard, risk trend, stale-asset warnings, and critical alerts (Slack/Teams webhook). Storage is a `node:sqlite` (default) / in-memory port for local verification; Postgres is the production adapter.

<p align="center">
  <img src="docs/screenshot-fleet.png" alt="AgentGuard Control Plane fleet dashboard — org-wide findings, severity chart, 30-day risk trend, stale-asset warning" width="900" />
</p>

```bash
cd control-plane
npm install
npm test        # 178 tests: session auth, policy sync, offboarding webhook, CVE, MCP catalog, wire-skew, signature auth, server redaction, multi-tenant isolation, Postgres contract, acceptance E2E
npm start       # http://127.0.0.1:8787
```

| Method · Path | Description |
|---|---|
| `POST /v1/enroll` | Enroll an asset (CI = OIDC, PC = device token) |
| `POST /v1/reports` | Ingest a redacted report (signature + 300s freshness + independent server-side redaction re-check; 422 on violation) |
| `GET /v1/dashboard/summary` | Findings by surface/severity/asset (org-scoped) |
| `GET /v1/dashboard/trend` | 30-day cumulative risk trend |
| `GET /v1/assets` | Asset list + stale warning |
| `GET /v1/findings` | Filterable findings list |
| `GET /?org=<id>` | Admin HTML dashboard (opt-in: `enableHtmlDashboard`; default 404 — pure JSON API) |

Every read endpoint is strictly scoped to the session/token orgId, so there is no cross-tenant path. The server re-checks redaction with a shape+entropy heuristic that is **independent** of the client sweep, and rejects violations with 422 while persisting nothing.
## v0.5 — CLI evolution and the hybrid-SaaS control plane

v0.5 grows along three fronts: **(1) a terminal-first CLI verb system**, **(2) an opt-in hybrid-SaaS control plane**, and **(3) a same-origin web console** on top of it — plus a **pre-commit hook** and a **VS Code extension** that wire it into the dev workflow.

### CLI verb system

```text
agentguard scan files|diff|log|mcp   (legacy: scan-files, scan-diff, scan-log, scan-mcp)
agentguard report [--push …]
agentguard doctor
agentguard posture
agentguard              # or agentguard repl — full-screen dashboard
agentguard open <path[:line]>
agentguard login|logout|enroll
agentguard hook install|uninstall
```

The two-word `scan files`/`scan diff`/`scan log`/`scan mcp` forms are a **declarative alias table** (`src/cli/table.ts`) that sits alongside the existing hyphenated forms (`scan-files`/`scan-diff`/`scan-log`/`scan-mcp`); the legacy hyphenated forms keep working **byte-identically**, including flag/positional parsing — existing scripts and CI workflows need no changes. In the full-screen dashboard (`agentguard`/`agentguard repl`), the Fleet and Offboard tabs surface the control-plane fleet aggregate and the offboarding-webhook workflow, respectively, from the local terminal.

### Control plane growth — native auth, policy, CVE, MCP catalog

The control plane stays **opt-in**: without `--push`, every CLI command behaves exactly as before. v0.5 adds the following on top of the existing device-token/OIDC reporting:

- **Native session auth + orgs/invites.** `POST /v1/auth/register|login|logout`, admin-only `POST /v1/orgs/invites` + `POST /v1/auth/accept-invite`, and a CLI-only **device-authorization flow** (`/v1/auth/device/start|approve|poll`) let `agentguard login`/`enroll` mint a session without a browser. Cookie-based sessions are protected by a CSRF token (`x-agentguard-csrf` header); passwords are stored only as hashes.
- **Policy sync.** Org-scoped policy documents (YAML/JSON) and exception records sync via ETag/`If-None-Match`. Reads are open to any org identity (session or viewer token); writes require an admin session + CSRF.
- **Offboarding webhook.** HR systems can trigger the offboarding workflow (`open → sweeping → done`) via a signed webhook (`x-agentguard-webhook-signature` + timestamp freshness), or an admin can create one directly from a session. Assets are matched by employee label/email.
- **CVE enrichment.** Package-shaped findings (e.g. globally installed npm AI CLIs) are batch-queried against [osv.dev](https://osv.dev) for CVE/GHSA severity. Results are cached with a TTL in a deliberately non-org-scoped (global) `cve_cache`; the ingest path **never awaits** the CVE lookup (fire-and-forget), and a lookup failure degrades quietly to "serve the cached value, mark it stale" — CVE enrichment can never block report ingestion.
- **MCP catalog.** Orgs manage an approval list for locally observed MCP servers (`GET/PUT /v1/mcp/catalog`). New servers seed as `approved:false` (deny-by-default); only an admin can change approval state.

### Web console — `web/`

A Next.js console served from the **same origin** as the control plane. Once logged in, it surfaces a fleet dashboard, a Shadow-AI executive report, and policy, offboarding, CVE, and MCP-catalog pages. Self-hosted deployments build it as a static export (`output: 'export'`) — no Next.js server runtime, no session store, no API pass-through — and because it shares an origin with the API, session/CSRF cookies stay first-party (no cross-site cookies, no CORS).

Below are real screenshots captured from the console after login (demo-org data).

**Login — create org / sign in (same-origin session + CSRF cookies)**

<p align="center">
  <img src="docs/web-login.png" alt="AgentGuard web console login — dark theme, email/password + create org" width="900" />
</p>

**Fleet dashboard — fleet-wide posture (summary / trend / assets / findings)**

<p align="center">
  <img src="docs/web-fleet-live.jpg" alt="AgentGuard web console fleet dashboard — TOTAL/CRITICAL/RISK stats, BLOCK verdict, findings-by-surface and by-asset bars" width="900" />
</p>

<table>
  <tr>
    <td width="50%"><img src="docs/web-report-live.jpg" alt="Shadow-AI executive report — print/PDF friendly" /><br/><sub><b>Shadow-AI executive report</b> — executive summary (verdict, severity breakdown, top findings), print/PDF friendly</sub></td>
    <td width="50%"><img src="docs/web-mcp-live.jpg" alt="MCP catalog management — approval list, risk tags, strict mode" /><br/><sub><b>MCP catalog</b> — deny-by-default approval list, risk tags, strict-mode toggle</sub></td>
  </tr>
</table>

### Dev-workflow integration — pre-commit hook + VS Code extension

- **`agentguard hook install|uninstall`** installs a git pre-commit hook that scans the staged diff and blocks the commit on a critical finding (honors `core.hooksPath`, backs up any existing hook, and uses an agentguard-managed marker for safe reinstall/removal).
- **The VS Code extension** (`editors/vscode/`) runs `agentguard scan-files --json` and publishes findings as native diagnostics (red/yellow squiggles in the Problems panel). It shells out to the `agentguard` CLI on `PATH` rather than bundling it.

### Self-hosting

To run the control plane + web console yourself, see the [self-hosting guide](docs/self-hosting.md) — a Docker Compose template (`deploy/`) that puts Caddy (reverse proxy/TLS), web (static export), api (control-plane), and Postgres behind one origin.
## Local development

```bash
npm install
npm test
npm run typecheck
npm run build

# Example report
node dist/index.js scan-diff --out agent-risk-report.md < examples/risky-pr.diff
```

## Release checklist

Before publishing, verify the npm package contains only the built CLI and intended metadata/assets:

```bash
npm run build
npm pack --dry-run
```

The dry run should list `dist/`, `README.md`, `package.json`, and examples, without `src/` or `test/` files.

- Run `npm test`
- Run `npm run typecheck`
- Run `npm run build`
- Run `npm pack --dry-run`
- Install the packed tarball in a temporary project and run `npx agentguard scan-log`
- Publish with `npm publish --provenance --access public`

See [docs/release-process.md](docs/release-process.md) for the tag-triggered provenance release workflow and token setup.

## MVP scope

This first version is intentionally small:

- deterministic regex/rule scanner
- markdown/JSON report
- SARIF 2.1.0 output for GitHub code scanning
- no external network calls
- no secrets are printed in full

## Roadmap

- MCP permission graph
- runtime guardrails / MCP proxy (detect → prevent; currently observe-only, v0.6+)
