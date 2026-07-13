# AX emergency stop runbook

## 목적

이 카드는 AX Rollout Guard 데모에서 `PASS`가 아닌 신호가 나왔을 때 기업 운영자가 30초 안에 말할 수 있는 비상 정지 절차를 고정한다. 목표는 `AgentGuard가 문제를 찾았다`에서 끝내지 않고, `배포 중지 → 권한 회수/설정 비활성화 → 수정·정책 조건 → 같은 증거 재실행 → 승인 후 재개`까지 이어지는 운영 루프를 보여주는 것이다.

AgentGuard는 현재 PR diff, MCP config, transcript/log, SARIF/report, smoke manifest 같은 **정적·재현 가능한 evidence**를 만든다. 이 문서는 라이브 인증·세션 제어 또는 실제 기업 incident 운영을 구현했다고 말하지 않는다.

## Emergency stop decision table

| Surface | Stop owner | Stop condition | Recovery action | Rerun command / artifact | Resume condition |
|---|---|---|---|---|---|
| PR diff | 개발 리드 + 보안 리뷰어 | `BLOCK` secret, PII, dangerous command, or policy-violating diff | PR merge freeze, secret rotation ticket if needed, remove risky diff or add policy/fix commit | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Same PR evidence rerun shows no critical `BLOCK`; residual `REVIEW` has named approver |
| MCP config | 플랫폼/AgentOps 담당자 | `mcp-filesystem-wide-root`, `mcp-env-token`, broad writable root, or credential passthrough | Disable the MCP server/config, narrow root/path/env allowlist, remove token passthrough | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP evidence rerun shows least-privilege config or explicit human approval condition |
| transcript/log | 운영 리드 + 업무 owner | `denied-command`, approval-required export/delete/deploy action, or sensitive data handling | Pause agent workflow, revoke job token if exposed, add approval checkpoint or policy rule | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | Transcript rerun no longer contains blocked action, or the remaining `REVIEW` action has documented owner/timebox |
| SARIF artifact | 보안 리뷰어 + CI owner | Code scanning / reviewer handoff needs a durable evidence artifact for the blocked PR | Generate a fresh SARIF artifact from current source evidence and attach it to the review channel | `node dist/index.js scan-diff --sarif --out .agentguard-demo/emergency-stop/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF artifact exists for the same evidence source and reviewer channel records accept/request-rerun/block |
| smoke manifest | 발표 operator + PM | Judge asks whether the demo evidence bundle still reproduces from the current build | Run the bundled smoke command and compare manifest provenance/hash fields before demo | `npm run smoke:ax-demo` | Manifest is fresh for current build, expected risky checks are explained, and stale artifacts are discarded |

## Recovery/rerun loop

1. **Detect**: AgentGuard output is the source-of-record for the current surface, not an agent self-report.
2. **Stop**: if the verdict is `BLOCK`, pause the affected PR, MCP server, agent job, or demo handoff before broad rollout.
3. **Recover**: remove the risky diff, narrow MCP permission, rotate exposed credentials where applicable, or add a policy/approval condition.
4. **Rerun**: run the exact command from the table against the same fixture/source surface; generate a fresh Markdown/JSON/SARIF artifact when reviewer handoff needs it.
5. **Resume**: resume only when `BLOCK` is gone, remaining `REVIEW` has a named owner and timebox, and the artifact belongs to the current source evidence.

## Exact evidence commands

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/emergency-stop/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
npm run smoke:ax-demo
```

The smoke command is implemented by `scripts/ax-demo-smoke.mjs`.

Fresh-clone note: commands using `node dist/index.js` assume `npm ci && npm run build` has completed. The SARIF path under `.agentguard-demo/` is demo evidence output, not a committed source artifact.

## Public references: Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| MCP Security Best Practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Consent/control, least privilege, audience/token boundary, and explicit risk before tool access | Live auth/session control claims | Route MCP `BLOCK` to static preflight evidence, config disablement, least-privilege rewrite, and rerun proof |
| GitHub Actions security hardening — https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions | Least-privilege workflow/token posture and secret exposure response mindset | Claims that a docs-only card changes repo permissions or CI token scopes | Make PR diff and SARIF evidence a stop signal for merge freeze and reviewer-owned recovery |
| Snyk fix vulnerabilities workflow — https://docs.snyk.io/scan-with-snyk/snyk-code/manage-code-vulnerabilities/fix-code-vulnerabilities | Triage, fix, retest, and residual-risk language | Substitution or endorsement wording around Snyk | Show `finding → fix/policy → rerun → resume` as the business approval loop |
| GitHub code scanning / SARIF UX — https://github.blog/security/application-security/how-to-use-github-code-scanning-with-your-open-source-software-development/ | Reviewer-visible security artifacts and repeatable evidence handoff | Automatic approval, upload, or reviewer decision claims | Generate SARIF from AgentGuard evidence and make the channel owner decide accept/request-rerun/block |

## Machine contracts

Keep these English-compatible contracts stable for scripts and reviewer tooling:

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `npm run smoke:ax-demo`
- Flags and paths: `--policy`, `--sarif`, `--out`, `.agentguard-demo/emergency-stop/pr-diff.sarif`
- Verdicts: `PASS`, `REVIEW`, `BLOCK`
- Rule IDs: `generic-secret-assignment`, `denied-command`, `mcp-filesystem-wide-root`, `mcp-env-token`
- Artifact fields: `JSON`, `SARIF`, `schemaVersion`, `gitCommitSha`, `sourceSha256`, `artifactSha256`, `ruleId`, `locations`

## Non-claim guardrails

- Synthetic fixtures are demo evidence only; they are not customer adoption proof.
- This card is not SOC 2, ISO 27001, OWASP, MCP, GitHub, or Snyk certification.
- AgentGuard is not positioned here as a replacement, parity clone, or compatible implementation of Snyk, GitHub code scanning, OWASP, MCP, or other public tools.
- This card does not claim complete AI security platform coverage.
- Runtime OAuth/session/token/consent enforcement remains outside this static evidence slice; use the runbook as an approval gate and evidence handoff, not as a runtime control plane guarantee.
