# AX evidence pack exit criteria card

## 목적

한국어 우선 AX Rollout Guard 운영자가 PR diff, MCP config, transcript/log, SARIF artifact evidence pack을 심사위원·보안 approver에게 넘기기 전에 **ACCEPT / RERUN_REQUIRED / BLOCK_HANDOFF** 중 하나로 판정하는 출구 기준입니다. 이 카드는 `source-of-record`가 agent self-report가 아니라 fresh clone에서 재실행 가능한 repo fixture, CLI output, JSON/SARIF artifact, reviewer handoff 기록, 명시된 approval owner의 결정, 그리고 다음 rerun trigger라는 점을 고정합니다.

## Exit decision matrix

| Decision | When to use | Approval owner action | Rerun trigger |
|---|---|---|---|
| `ACCEPT` | 같은 commit에서 fresh clone build와 fixture-backed evidence commands가 재현되고, expected verdict/artifact가 문서와 일치하며, non-claim guardrails가 깨지지 않을 때 | evidence pack을 reviewer handoff로 전달하고 승인/조건부 승인 판단을 기록 | 새 commit, fixture 변경, policy 변경, public-reference refresh |
| `RERUN_REQUIRED` | command가 실행되지 않았거나, artifact hash/freshness가 없거나, SARIF/report가 같은 run의 산출물인지 확인되지 않을 때 | 운영자가 `npm ci && npm run build` 후 exact commands를 다시 실행 | stale artifact, dirty tree, missing build, reviewer non-response |
| `BLOCK_HANDOFF` | secret/PII/dangerous-command/full-access MCP 같은 `BLOCK` finding이 남아 있거나, runtime authorization/automatic upload 같은 미구현 claim이 evidence pack에 섞였을 때 | approver에게 전달하지 말고 fix/policy condition을 먼저 요구 | unresolved `BLOCK`, unsupported claim, source-of-record mismatch |

## Evidence pack checklist

| Surface | Source-of-record | Exit criteria | Approver question |
|---|---|---|---|
| PR diff | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` + `agentguard scan-diff` JSON | finding IDs와 `REVIEW` verdict가 재현된다 | 이 PR diff risk를 정책/코드 수정 조건으로 승인할 수 있는가? |
| MCP config | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` + `agentguard scan-mcp` JSON | broad filesystem/credential passthrough risk가 `BLOCK`으로 보인다 | 이 MCP server 권한을 축소하기 전 rollout을 멈출 것인가? |
| transcript/log | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` + `examples/agent-policy.yaml` | denied command / approval-required action이 `REVIEW`로 route된다 | 사람 승인 없이 실행된 agent action을 어떻게 재승인할 것인가? |
| SARIF artifact | `.agentguard-demo/evidence-pack-exit/agentguard.sarif` | GitHub code scanning handoff가 가능한 SARIF 2.1.0 artifact가 생성된다 | PR reviewer가 SARIF artifact와 Markdown/JSON report를 같이 볼 수 있는가? |

## Exact verification commands

Fresh clone prerequisite:

```bash
npm ci
npm run build
mkdir -p .agentguard-demo/evidence-pack-exit
```

| Surface | Command | Expected result |
|---|---|---|
| PR diff | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Expected verdict: `REVIEW` |
| MCP config | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | Expected verdict: `BLOCK` |
| transcript/log | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | Expected verdict: `REVIEW` |
| SARIF artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/evidence-pack-exit/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Expected artifact: `.agentguard-demo/evidence-pack-exit/agentguard.sarif` |

Risky inputs may return non-zero when `BLOCK`/critical findings are present. Treat a non-zero exit as expected only after checking the JSON/SARIF shape and verdict. Do not treat shell success alone as approval evidence.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [Agentic AI - OWASP Lists Threats and Mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Threat-to-mitigation framing for agentic workflows and guardrail tripwires | Do not claim AgentGuard enforces runtime OAuth, session, or consent controls | Keep evidence pack focused on static PR/MCP/transcript/SARIF proof and explicit human approval conditions |
| [Uploading a SARIF file to GitHub - GitHub Docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Reviewer-visible artifact handoff and code-scanning integration language | Do not claim automatic SARIF upload unless the workflow snippet or CI run actually uploads it | Require SARIF artifact creation plus reviewer handoff wording, not automatic external approval |
| [agent-scan npm registry](https://registry.npmjs.org/agent-scan) — `Detect suspicious AI agents activities on GitHub` | Public scanner category pressure: AI-agent activity scanners are an active market signal | Do not claim customer adoption, certification, parity, replacement, or superior coverage from registry metadata | Differentiate with Korean-first AX rollout approval evidence across PR diff, MCP config, transcript/log, and SARIF |

## Machine-contract boundaries

Preserve English-compatible machine contracts:

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- Flags: `--json`, `--sarif`, `--out`, `--policy`
- Verdicts: `PASS`, `REVIEW`, `BLOCK`
- `JSON/SARIF fields`, `rule IDs`, GitHub Action inputs/outputs, and package metadata remain English-compatible.

## Non-claim guardrails

- no customer/adoption claim
- no external certification
- no scanner parity/replacement claim
- no runtime authorization claim
- no automatic SARIF upload claim

## 대상권 operator line

“이 evidence pack은 회사가 준 미지의 agent workflow를 배포하기 전에 PR diff, MCP 권한, agent transcript, SARIF handoff를 같은 source-of-record로 재현해 `ACCEPT / RERUN_REQUIRED / BLOCK_HANDOFF` 중 하나로 승인 결정을 내리게 합니다.”
