# AX CLI benchmark quickstart card

한국어 우선 AX CLI benchmark quickstart card입니다. 목적은 AgentGuard를 GitHub CLI, Vercel CLI, Stripe CLI, Sentry CLI, Snyk CLI 같은 public CLI benchmark의 first-minute evidence discipline과 비교하되, 현재 저장소가 실제로 재현할 수 있는 local CLI evidence만 보여주는 것입니다.

범위는 fresh clone에서 build한 AgentGuard CLI, synthetic fixture-backed local commands, SARIF handoff artifact입니다. CLI commands, rule IDs, JSON, SARIF, PASS, REVIEW, BLOCK, machine contracts는 English-compatible 형태로 유지합니다.

## 사용 목적

심사자에게 "AgentGuard도 CLI onboarding, status/readiness, rerun, artifact handoff vocabulary를 갖췄다"는 판단 재료를 준다. 다만 hosted account, deploy, payment, observability, vendor-scale remediation, scanner parity를 주장하지 않는다.

이 카드는 대상권 판단 readiness를 높이는 quickstart입니다. 제품 behavior, scanner severity, package metadata, auth/SaaS/dashboard surface를 바꾸지 않는다.

## Fresh clone quickstart

저장소 루트에서 아래 순서로 실행한다. fresh clone에서는 build artifact가 없으므로 먼저 install/build를 끝낸 뒤 `.agentguard-demo/`에 reviewer handoff artifact를 둔다.

```bash
npm ci
npm run build
mkdir -p .agentguard-demo
```

npm/global install 환경에서는 같은 subcommands를 `agentguard doctor`, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다. 이 문서의 exact commands는 fresh clone reviewer가 재현하기 쉽도록 `node dist/index.js ...` 형태로 고정한다.

## Benchmark signal map

| Public CLI benchmark | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| GitHub CLI manual - https://cli.github.com/manual/ | Borrow: manual surface, command taxonomy, help/status style self-serve verification. | Avoid: GitHub account, auth, repo hosting, or device workflow claims. | Put exact `node dist/index.js doctor` and scan commands where a reviewer can rerun them. |
| Vercel CLI docs - https://vercel.com/docs/cli | Borrow: install/login/status/config vocabulary and first-minute readiness framing. | Avoid: deploy platform, hosted project, cloud status, or account workflow claims. | Frame AgentGuard evidence as local build/readiness plus artifact paths, not hosted platform status. |
| Stripe CLI README - https://raw.githubusercontent.com/stripe/stripe-cli/master/README.md | Borrow: login/help/rehearsal discipline and repeated exact commands for demos. | Avoid: payment, webhook, runtime integration, or account/session claims. | Keep an AX judge rehearsal path with stable CLI commands and synthetic fixture inputs. |
| Sentry CLI docs - https://docs.sentry.io/cli/ | Borrow: release/artifact/CI evidence language for reviewer handoff. | Avoid: production observability, error monitoring, hosted release management, or SaaS triage claims. | Map `.agentguard-demo/ax-cli-benchmark-quickstart.sarif` to reviewer-owned artifact evidence. |
| Snyk CLI docs - https://docs.snyk.io/snyk-cli | Borrow: remediation/rerun language and security CLI proof discipline. | Avoid: vendor-scale scanner parity, hosted remediation workflow, or broad vulnerability coverage claim. | Keep proof limited to fixture-backed local commands, rerun conditions, and honest gaps. |

## Research provenance checked this run

이번 refresh에서는 normal public fetch/public API paths로 확인 가능한 source만 사용했다. insane-search escalation was not required because public fallback fetches returned 200; 이 문구는 insane-search 우회 증거가 아니라 공개 경로가 충분했다는 경계 표시다.

| Source path | Run status | Borrow | Avoid | AgentGuard action |
|---|---|---|---|---|
| https://cli.github.com/manual/ | Public HTML fetch returned 200 for GitHub CLI manual. | status/manual vocabulary, command taxonomy, self-serve help surface. | GitHub account/auth/device-flow/repo-hosting claim. | Keep `doctor → scan-* → SARIF` as local commands a reviewer can rerun without hosted account assumptions. |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Public HTML fetch returned 200 for OWASP Agentic AI threats and mitigations. | agentic risk/mitigation vocabulary: tool misuse, excessive agency, human control. | OWASP endorsement, complete threat coverage, or external assurance. | Explain `scan-diff`, `scan-mcp`, and `scan-log` as stop/fix/approve evidence for an agent rollout. |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Public HTML fetch returned 200 for MCP Security Best Practices. | least privilege, explicit user consent, token and permission-boundary language. | Runtime OAuth/session/consent enforcement claim. | Keep `scan-mcp` positioned as static pre-rollout evidence for MCP roots, writable paths, and credential passthrough. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | Public HTML fetch returned 200 for GitHub SARIF upload docs. | SARIF artifact handoff, rule/result/location reviewer-channel framing. | Automatic upload, automatic triage, or GitHub-native approval claim. | Preserve `.agentguard-demo/ax-cli-benchmark-quickstart.sarif` as local reviewer handoff evidence only. |
| https://api.github.com/repos/snyk/agent-scan | GitHub API returned 200 for Snyk agent-scan metadata. | public scanner category pressure for agent/MCP/skill scanning. | Snyk parity, vendor-scale coverage, market adoption, or replacement claim. | Use the signal to sharpen AgentGuard's Korean-first AX rollout approval story while staying fixture-backed. |
| https://github.com/openai/openai-agents-js | GitHub API returned 200 for OpenAI agents-js metadata. | multi-agent workflow / agent workflow framework vocabulary for judging the workflow that generates PR diff, MCP config, and transcript evidence. | OpenAI runtime control, hosted agent platform, tracing, guardrail execution, or SDK compatibility claim. | Route the signal to AgentGuard's reviewer-owned evidence ladder: `doctor → scan-diff → scan-mcp → scan-log → SARIF`. |

## Fixture-backed AgentGuard commands

| Surface | Exact command | Fixture path | Evidence intent | Expected reviewer signal |
|---|---|---|---|---|
| Readiness | `node dist/index.js doctor` | fresh clone repo root after `npm run build` | local install/build/readiness review before showing risk evidence | readiness report; not rollout approval |
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | PR change evidence for secret-like or risky shell material | `BLOCK` or `REVIEW` finding output |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP permission evidence for broad filesystem, writable path, and credential-boundary risk | `BLOCK` or `REVIEW` finding output |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | policy-backed agent behavior evidence for approval-required operations | `REVIEW` policy evidence |
| SARIF handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-benchmark-quickstart.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | same PR diff evidence as machine-readable reviewer artifact | SARIF artifact path exists for handoff; scan may still exit non-zero on risky input |

## Agentic guardrail evidence ladder

Agentic guardrail reference는 이 quickstart의 evidence ladder를 `doctor → scan-diff → scan-mcp → scan-log → SARIF` 순서로 읽게 만드는 근거입니다. `doctor`는 fresh-clone readiness를 확인하고, `scan-diff`는 agent가 만든 PR change evidence를 확인하며, `scan-mcp`는 MCP config의 permission boundary를 static pre-rollout evidence로 확인하고, `scan-log`는 agent transcript/log의 승인 필요 행동을 reviewer에게 넘깁니다. 마지막 SARIF handoff는 같은 point-in-time evidence를 reviewer channel에 전달하는 artifact일 뿐, 자동 승인이나 runtime enforcement가 아닙니다.

| Public agentic guardrail reference | Borrow | Avoid | AgentGuard evidence action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Borrow: tool misuse, excessive agency, human control, mitigation vocabulary. | Avoid: OWASP endorsement, complete threat coverage, external assurance, or live runtime control claim. | Tie `scan-diff`, `scan-mcp`, and `scan-log` output to reviewer-owned stop/fix/approve decisions. |
| MCP Authorization guidance — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | Borrow: authorization, token, session, permission boundary, and consent vocabulary for MCP rollout questions. | Avoid: MCP standard-compliance claim, runtime OAuth/session enforcement, consent UI, or live MCP server control claim. | Keep `scan-mcp` as static pre-rollout config evidence for broad filesystem, writable path, and credential-boundary review. |
| GitHub SARIF support — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | Borrow: SARIF result/artifact/channel framing that reviewers can inspect. | Avoid: automatic upload, native GitHub code scanning integration, or alert triage/remediation workflow claim. | Use `.agentguard-demo/ax-cli-benchmark-quickstart.sarif` as a local reviewer handoff artifact with command and fixture path. |
| OpenAI agents-js — https://github.com/openai/openai-agents-js | Borrow: multi-agent workflow framing that makes the upstream agent/tool workflow explicit before judging outputs. | Avoid: OpenAI runtime control, tracing, hosted guardrail, SDK compatibility, or live agent execution claim. | Keep AgentGuard as the local reviewer gate over the artifacts an agent workflow leaves behind: PR diff, MCP config, transcript/log, and SARIF. |

## First-minute transcript checklist

이 checklist는 AX judge가 첫 60초에 terminal transcript에서 무엇을 봐야 하는지 고정한다. GitHub CLI/Vercel CLI에서 빌린 self-serve readiness habit은 `doctor`로 시작하고, OWASP/MCP/GitHub SARIF reference에서 빌린 reviewer handoff habit은 risky evidence와 artifact lane을 분리한다. 모든 command는 fresh clone에서 `npm ci && npm run build && mkdir -p .agentguard-demo` 이후 실행한다.

| Minute | What the judge sees | Exact command or artifact | Expected signal | Borrowed benchmark habit |
|---|---|---|---|---|
| 00:00-00:15 | readiness before risk evidence | `node dist/index.js doctor` | Local CLI readiness report; not rollout approval. | GitHub/Vercel-style status or readiness before risky operations. |
| 00:15-00:30 | risky PR diff is reviewer evidence | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `REVIEW`/`BLOCK`-style finding output tied to PR diff evidence. | OWASP-style agentic risk explanation with exact rerun command. |
| 00:30-00:45 | MCP permission boundary is static pre-rollout evidence | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | Broad filesystem/env-token risk stays static evidence until an owner narrows scope. | MCP least-privilege and explicit-consent vocabulary without live runtime enforcement claims. |
| 00:45-01:00 | SARIF handoff is an artifact lane, not automatic approval | `.agentguard-demo/ax-cli-benchmark-quickstart.sarif` from `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-benchmark-quickstart.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | Reviewer-owned artifact exists for archive/upload decision; risky input may still exit non-zero. | GitHub/Sentry-style artifact handoff while avoiding automatic approval, upload, or triage claims. |

## SARIF handoff contract

SARIF는 reviewer가 다시 열 수 있는 artifact evidence입니다. `--sarif --out .agentguard-demo/ax-cli-benchmark-quickstart.sarif`는 파일을 만드는 handoff path를 보여주지만, GitHub upload, alert triage, remediation closure를 자동 수행한다고 말하지 않는다.

Handoff 메모에는 command, fixture path, SARIF artifact path, owner, rerun condition을 같이 둔다. risky finding 때문에 CLI가 non-zero로 끝날 수 있으므로 artifact creation과 rollout approval을 분리한다.

## Machine contracts

- CLI commands: `agentguard doctor`, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`.
- Output contracts: Markdown report, JSON, SARIF, rule IDs, PASS, REVIEW, BLOCK.
- Artifact contract: `.agentguard-demo/ax-cli-benchmark-quickstart.sarif` is a local reviewer handoff artifact.
- Fresh clone contract: `npm ci`, `npm run build`, `mkdir -p .agentguard-demo`, then run exact `node dist/index.js ...` commands.
- Honest gaps: this is fixture-backed local commands only; no hosted auth, no dashboard, no customer deployment evidence, no scanner parity, no certification.

## Non-claim guardrails

- No adoption claim: 실제 고객, 운영 배포, 구매자, customer reference, adoption metric을 주장하지 않는다.
- No certification claim: 외부 인증, 공식 승인, 표준 준수 완료를 주장하지 않는다.
- No hosted auth claim: GitHub/Vercel/Stripe/Sentry/Snyk account login, device flow, OAuth/session behavior를 AgentGuard 기능처럼 말하지 않는다.
- No dashboard claim: 이 quickstart card를 hosted SaaS dashboard, cloud status page, hosted triage workflow로 말하지 않는다.
- No scanner parity claim: Snyk, GitHub code scanning, Sentry, SAST, broad AI security scanner와 동등하거나 대체한다고 말하지 않는다.
- No product rename: AgentGuard, AX Rollout Guard positioning, CLI commands, rule IDs, JSON fields, SARIF fields, and machine contracts stay unchanged.
- No scanner behavior change: severity, verdict, default policy, SARIF schema, package metadata를 이 문서로 바꾸지 않는다.
