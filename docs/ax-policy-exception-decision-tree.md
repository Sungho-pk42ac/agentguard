# AX policy exception decision tree

## Purpose

이 문서는 대상권 심사자가 AgentGuard의 **AX Rollout Guard**를 30초 안에 "기업이 에이전트를 업무에 넣기 전 어떤 예외/승인 결정을 해야 하는가"로 이해하도록 돕는 정책 예외 결정 트리입니다.

범위는 문서와 증거 계약입니다. AgentGuard의 CLI behavior, rule IDs, verdict logic, dashboard, auth, SaaS, scanner coverage를 바꾸지 않습니다. 현재 slice는 PR diff, MCP config, transcript evidence를 승인 조건으로 묶어 설명합니다.

## Decision tree

1. **위험 evidence가 있는가?** PR diff, MCP config, transcript 중 하나라도 `secret.github_token`, `mcp.broad_filesystem_access`, 위험한 shell/export/delete action을 보이면 다음 단계로 갑니다.
2. **업무 투입 전 차단해야 하는가?** secret-like material, broad writable filesystem, credential passthrough, 승인 없는 데이터 export는 기본적으로 `BLOCK`입니다.
3. **정책 예외로 승인 가능한가?** 업무상 필요가 명확하고, permission narrowing, least privilege, human approval 조건을 문서화할 수 있으면 `REVIEW` 예외 후보입니다.
4. **수정/승인 조건이 fixture-backed evidence로 재현되는가?** 같은 command로 재실행했을 때 위험 입력 제거, MCP root 축소, 승인 필요 action 정책화가 report에 남아야 합니다.
5. **machine contract가 유지되는가?** `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `SARIF`, `JSON`, `rule IDs`는 English-compatible 계약으로 유지합니다.
6. **최종 판단**: 수정 없이 위험이 남으면 `BLOCK`, 사람이 승인해야 할 조건이 남으면 `REVIEW`, finding이 없거나 승인 조건이 충족되면 `PASS`로 설명합니다.

## BLOCK/REVIEW/PASS exception matrix

| Verdict | 정책 예외 판단 | 승인 조건 | AX Rollout Guard evidence |
|---|---|---|---|
| `BLOCK` | 업무 투입 전 중단 | secret 제거, broad/writable MCP root 축소, credential passthrough 제거 | PR diff, MCP, transcript에서 배포 중단 사유를 보여줍니다. |
| `REVIEW` | 제한적 예외 후보 | permission narrowing, least privilege, human approval, 승인권자/만료일 기록 | 예외를 허용해도 되는 이유와 남은 위험을 Markdown report에 기록합니다. |
| `PASS` | 예외 불필요 또는 조건 충족 | 같은 fixture-backed command로 재실행해 위험 evidence가 사라졌거나 승인 조건이 충족됨 | `BLOCK → 수정/정책 → PASS` 흐름을 대상권 심사자가 확인할 수 있습니다. |

## Fixture-backed evidence commands

아래 명령은 저장소 fixture만 사용하는 합성 fixture-backed evidence입니다. 실제 고객 데이터, 실제 운영 adoption, 보안 인증을 주장하지 않습니다.

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

- `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`: PR diff evidence for secret-like material and `secret.github_token` style rollout decisions.
- `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`: MCP evidence for broad filesystem and `mcp.broad_filesystem_access` style permission decisions.
- `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`: transcript evidence for approval-required agent actions.
- `examples/agent-policy.yaml`: policy evidence for transcript approval boundaries.
- `agentguard.sarif`: SARIF artifact name for GitHub-compatible handoff; the product behavior and schema stay unchanged.
- Markdown report: reviewer-readable approval artifact for `BLOCK`, `REVIEW`, and `PASS` explanation.

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Threat-to-control mapping for agent autonomy, tool use, and mitigation vocabulary. | OWASP 인증, 검증, full coverage claim. | Findings map to controls and rollout decisions: stop, review exception, or pass after mitigation. |
| [Claude Code Security](https://code.claude.com/docs/en/security) | Least privilege, managed permissions, explicit approval framing. | AgentGuard가 Claude Enterprise settings를 관리한다는 표현. | Approval conditions mention permission narrowing, least privilege, and human approval without claiming to configure Claude. |
| [GitHub SARIF support](https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support) | Machine-readable artifact framing around rule, result, location, and SARIF handoff. | GitHub product parity or replacement claims. | Keep CLI/SARIF/report artifacts English-compatible and route evidence to existing code-scanning formats. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Agent, skill, and MCP security category framing. | Vendor-scale coverage or scanner-only positioning. | Emphasize PR diff plus MCP plus transcript evidence for enterprise rollout. |
| [ShipSafe MCP](https://github.com/asamassekou10/ship-safe) | Public ecosystem signal that MCP and agent-written code are security surfaces. | Product parity, replacement, or adoption claims. | Explain AgentGuard as a rollout guard over repository evidence, not a universal security platform. |

## Machine-contract boundaries

- Product name remains `AgentGuard`.
- CLI commands remain `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- Rule IDs remain English-compatible, including `secret.github_token` and `mcp.broad_filesystem_access`.
- Report artifacts remain English-compatible where machines read them: `SARIF`, `JSON`, `rule IDs`, `verdict`, file locations, and command flags.
- Korean-first copy explains the business decision, but it does not rename CLI, SARIF, JSON, API, machine fields, or rule IDs.

## Non-claim guardrails

- fake adoption: 금지. 이 문서는 synthetic fixtures and docs-contract evidence만 말합니다.
- certification: 금지. Listed public references의 official approval이나 formal validation을 주장하지 않습니다.
- product parity: 금지. GitHub code scanning, Snyk, ShipSafe, Claude Code, MCP ecosystem tools와 동급/대체재라고 말하지 않습니다.
- broad-platform claim: 금지. AgentGuard 설명은 PR diff + MCP + transcript rollout gate로 제한합니다.
- customer proof: 금지. 운영 실적, external reference account, deployment-complete 표현을 사용하지 않습니다.
