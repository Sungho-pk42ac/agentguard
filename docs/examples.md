# Examples

This directory contains intentionally fake sample inputs. They are designed to demonstrate AgentGuard behavior without including real credentials or private data.

## Risky MCP config

```bash
agentguard scan-mcp < examples/risky-mcp.json
```

Expected result: `BLOCK` or `REVIEW` findings for broad filesystem access, writable roots, and credential-like environment passthrough.

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

## Markdown report

```bash
agentguard scan-diff --out agent-risk-report.md < examples/risky-pr.diff
```

A sample report is stored at [`examples/expected-report.md`](../examples/expected-report.md).

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

For a Korean-first competition-rule compliance checklist that separates public facts, current evidence, and gated unknowns, see [AX rule compliance checklist](ax-rule-compliance-checklist.md).

For a tiny Korean before/after MCP rollout approval story, see [AX before/after rollout demo](ax-before-after-rollout-demo.md).

For a one-page Korean judge evidence handoff, see [AX judge evidence index](ax-judge-evidence-index.md).

For a 30-second onsite company-problem pivot into existing evidence commands, see [AX onsite pivot guide](ax-onsite-pivot-guide.md).

## AX company problem intake kit

[AX company problem intake kit](ax-company-problem-intake-kit.md) turns an unknown Korean company problem into a reusable AX Rollout Guard demo plan: business workflow, agent/tool surface, risky inputs, AgentGuard commands, `BLOCK → 수정/정책 → PASS` evidence, approval report, and a 30-second script.

## SARIF

```bash
agentguard scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff
```

A sample SARIF payload is stored at [`examples/agentguard.sarif`](../examples/agentguard.sarif).
