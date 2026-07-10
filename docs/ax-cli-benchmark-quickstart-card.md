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

## Fixture-backed AgentGuard commands

| Surface | Exact command | Fixture path | Evidence intent | Expected reviewer signal |
|---|---|---|---|---|
| Readiness | `node dist/index.js doctor` | fresh clone repo root after `npm run build` | local install/build/readiness review before showing risk evidence | readiness report; not rollout approval |
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | PR change evidence for secret-like or risky shell material | `BLOCK` or `REVIEW` finding output |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | MCP permission evidence for broad filesystem, writable path, and credential-boundary risk | `BLOCK` or `REVIEW` finding output |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | policy-backed agent behavior evidence for approval-required operations | `REVIEW` policy evidence |
| SARIF handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-benchmark-quickstart.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | same PR diff evidence as machine-readable reviewer artifact | SARIF artifact path exists for handoff; scan may still exit non-zero on risky input |

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
