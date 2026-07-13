# AX agent rollout preflight checklist

한국어 우선 운영 카드입니다. 목적은 본선에서 처음 받은 회사 문제를 Codex/Cursor/Claude Code/MCP 기반 agent workflow로 옮기기 전에, **source-of-record evidence**를 1분 안에 모아 `PASS` / `REVIEW` / `BLOCK` 결정을 내리게 하는 것입니다.

이 문서는 구현 범위를 넓히지 않습니다. AgentGuard는 여기서 OAuth/session/consent 런타임 집행, hosted review service, or SARIF 업로드 자동화를 수행한다고 말하지 않습니다. 모든 항목은 현재 repo fixture와 CLI command로 재실행 가능한 static preflight / reviewer handoff입니다.

## 60-second preflight flow

| Step | Exact command | Source evidence | Expected decision | Rerun / block trigger |
| --- | --- | --- | --- | --- |
| 0. Fresh-clone readiness | `node dist/index.js doctor --json` | `package.json` plus package/action/readiness contract from the local checkout | `PASS` only when required local contract checks are green | package metadata, action contract, or dist build changes |
| 1. PR diff risk | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` | `BLOCK` for secret-like PR diff or dangerous agent-written change | diff, policy, or reviewer owner changes |
| 2. MCP tool boundary | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | `REVIEW` / `BLOCK` for broad filesystem, credential env, or unsafe tool scope | MCP server, root path, env, auth scope, or consent boundary changes |
| 3. Agent transcript/log approval | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | `REVIEW` when approval-required or denied commands need a human owner | transcript source, policy YAML, rollback owner, or exception expiry changes |
| 4. SARIF reviewer handoff | `mkdir -p .agentguard-demo/agent-rollout-preflight && node dist/index.js scan-diff --sarif --out .agentguard-demo/agent-rollout-preflight/agentguard.sarif < examples/risky-pr.diff` | generated `.agentguard-demo/agent-rollout-preflight/agentguard.sarif` plus `examples/risky-pr.diff` | reviewer can accept the artifact, request rerun, or block rollout | SARIF file missing, stale, or generated from a different source artifact |

30초 발표 문장:

> 회사가 새 agent/tool workflow를 주면 먼저 `doctor --json`으로 repo/CI handoff 준비도를 확인하고, PR diff / MCP config / transcript를 각각 재실행 가능한 evidence로 검사합니다. `BLOCK`이면 rollout을 멈추고 fix/policy를 요구하고, `REVIEW`이면 승인자·잔여위험·재실행 조건을 남긴 뒤 진행 여부를 결정합니다.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | agent autonomy, tool-use, mitigation vocabulary for threat-to-control mapping | endorsement, certification, or full coverage language | map PR/MCP/transcript findings to stop, review, or pass decisions before rollout |
| [MCP Authorization specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) | authorization, session, consent, and trusted callback boundary language for MCP-style tools | runtime OAuth/session/consent enforcement claims | keep `scan-mcp` as static preflight evidence and require human approval for residual MCP tool risk |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | SARIF artifact handoff and code-scanning review workflow language | automatic SARIF upload or repository security-alert claims without a configured workflow | generate local SARIF with `--sarif --out` so reviewers can attach or upload it through their own CI/review channel |
| [Snyk CLI help docs](https://docs.snyk.io/cli-ide-and-ci-cd-integrations/snyk-cli/commands) | product-grade CLI flow: auth/readiness checks, direct scan command, report artifact | scanner parity or replacement claims | make AgentGuard's first-minute path explicit: `doctor --json` → exact scan command → evidence artifact → approval decision |

## Approval decision checklist

- `PASS`: the exact command was rerun from the current source artifact, no blocking finding remains, and the approver knows which artifact/hash/fixture was reviewed.
- `REVIEW`: the evidence is valid but rollout needs a named owner, residual-risk note, policy exception scope, expiry, or rollback condition.
- `BLOCK`: secret-like data, unsafe MCP scope, dangerous command, stale/missing artifact, or unverifiable agent self-report prevents rollout.

## Machine-contract boundaries

Keep these machine-facing contracts English-compatible: `PASS`, `REVIEW`, `BLOCK`, `scan-diff`, `scan-mcp`, `scan-log`, `doctor --json`, `JSON`, `SARIF`, `ruleId`, `--policy`, `--sarif`, and `--out`.

Human-facing Markdown can be Korean-first. CLI command names, verdict values, rule IDs, JSON fields, SARIF shape, and GitHub Action behavior must not be renamed by this checklist.

## Claim guardrails

- No customer adoption, paid pilot, or enterprise deployment claim is made by this checklist.
- No OWASP/MCP/GitHub/Snyk certification or formal assurance claim is made.
- No same-scope parity/replacement claim against Snyk, GitHub code scanning, or other scanners is made.
- No runtime-auth enforcement, OAuth session validation, consent capture, or automatic SARIF upload claim is made.
- The source of record is the rerunnable command and artifact, not an agent self-report.
