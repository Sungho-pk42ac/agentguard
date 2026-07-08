# AX CLI trust onboarding card

한국어 우선 trust onboarding 카드입니다. 목적은 심사자와 enterprise reviewer가 AgentGuard를 처음 켤 때 무엇을 확인하고, 어떤 증거를 남기며, 누가 후속 판단을 소유하는지 한 장에서 보게 하는 것입니다.

범위는 현재 저장소의 synthetic fixture와 구현된 CLI evidence뿐입니다. CLI commands, rule IDs, JSON, SARIF, machine contracts는 English-compatible 형태로 유지합니다.

## 사용 목적

첫 실행에서 바로 "보안 플랫폼을 샀다"는 식으로 말하지 않는다. 대신 `agentguard --help`, `agentguard doctor`, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `scan-diff --sarif --out` 순서로 reviewer가 다시 실행 가능한 evidence intent를 고정한다.

이 카드는 trust onboarding을 설명하지만 trust를 자동 부여하지 않는다. 팀은 command output, fixture path, owner, non-claim을 함께 보고 rollout 여부를 판단한다.

## First-run trust path

1. `agentguard --help`로 local CLI surface와 command names를 확인한다.
2. `agentguard doctor`로 install/readiness review를 먼저 수행한다.
3. PR diff, MCP config, transcript/log surface를 각각 synthetic fixture로 실행한다.
4. SARIF artifact를 별도로 만들어 reviewer handoff가 가능한지 확인한다.
5. 결과를 운영 승인, 외부 인증, vendor parity로 확대해서 말하지 않는다.

## Evidence intent and owner table

| Step | Exact command | Evidence intent | Expected verdict | Owner | Do not claim |
|---|---|---|---|---|---|
| Help surface | `agentguard --help` | first-run CLI commands and flags are visible evidence for onboarding. | help text visible | AgentGuard operator | Do not claim a security review happened from help text alone. |
| Readiness | `agentguard doctor` | install/readiness review before rollout or demo. | readiness review | Tooling owner | Do not claim production approval or runtime enforcement. |
| PR diff | `agentguard scan-diff` | PR change evidence for secret-like, PII-like, or risky shell material. | BLOCK or REVIEW depending on finding severity | PR owner + security reviewer | Do not claim full code security coverage. |
| MCP config | `agentguard scan-mcp` | MCP permission evidence for broad filesystem, writable path, and credential-boundary risk. | BLOCK or REVIEW depending on config | Agent platform owner + security reviewer | Do not claim MCP conformance or runtime authorization. |
| transcript/log | `agentguard scan-log` | agent behavior evidence for approval-required actions and tool misuse review. | REVIEW when policy-relevant behavior appears | Workflow owner + incident reviewer | Do not claim runtime containment or complete incident response. |
| SARIF handoff | `agentguard scan-diff --sarif --out .agentguard-demo/ax-cli-trust-onboarding.sarif` | machine-readable reviewer handoff artifact for the same PR diff evidence. | SARIF artifact created | CI owner + security reviewer | Do not claim automatic GitHub upload or triage completion. |

## Fixture-backed commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

아래 examples는 POSIX shell/Bash/Zsh/Git Bash 기준의 stdin redirection입니다. PowerShell에서는 `<` 대신 `Get-Content -Raw -Encoding utf8 <fixture> | node dist/index.js <subcommand>` 형태를 사용합니다. `.agentguard-demo/`는 generated handoff artifact 경로이며 저장소에 커밋하지 않습니다.

| Surface | Exact command | Fixture path | Evidence intent | Expected verdict |
|---|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | agent-visible PR diff risk evidence | `BLOCK` or `REVIEW` finding output |
| MCP config | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | least-privilege and credential-boundary evidence | `BLOCK` or `REVIEW` finding output |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | approval-required agent behavior evidence | `REVIEW` policy evidence |
| SARIF handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-cli-trust-onboarding.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | same PR diff evidence as SARIF reviewer artifact | SARIF artifact created |

## SARIF reviewer handoff

SARIF는 reviewer-visible artifact routing을 위한 machine-readable output입니다. GitHub code scanning에 올릴 수 있는 형식과 vocabulary를 빌리지만, 이 카드만으로 upload workflow, alert triage, risk closure가 자동 수행된다고 말하지 않습니다.

Handoff 기록에는 command, input fixture path, output SARIF path, owner, rerun condition을 함께 둡니다. 위험 finding은 SARIF file을 쓰면서도 CLI exit이 non-zero일 수 있으므로, artifact creation과 rollout approval을 분리합니다.

## Public reference grounding

| Public reference | Borrow | Avoid | AgentGuard onboarding action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agentic threat, control, mitigation ownership vocabulary. | Avoid: OWASP coverage, external assurance, or broad agent-security-suite claim. | Map PR diff, MCP config, and transcript/log checks to evidence owner and rerun command. |
| [MCP security best practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) | Borrow: least privilege, user consent, token handling, confused deputy framing. | Avoid: MCP conformance, runtime auth, OAuth/session enforcement, or consent UI implementation claim. | Use `agentguard scan-mcp` as local readiness evidence before rollout. |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | Borrow: public agent component, inventory, security scan category language. | Avoid: vendor-scale coverage, market adoption, or same-scope enterprise scanner claim. | Keep AgentGuard onboarding scoped to local CLI evidence and fixture-backed commands. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF upload, artifact routing, reviewer handoff vocabulary. | Avoid: automatic GitHub upload, alert ownership, or code-scanning closure claim. | Generate `.agentguard-demo/ax-cli-trust-onboarding.sarif` as a handoff artifact only. |

## Non-claim guardrails

- No adoption claim: 실제 고객, 운영 배포, 구매자, customer reference, adoption metric을 주장하지 않는다.
- No certification claim: 외부 인증, 공식 승인, 표준 준수 완료, security badge를 주장하지 않는다.
- No MCP conformance claim: MCP spec 적합성, runtime authorization, OAuth/session enforcement, consent UI 구현을 주장하지 않는다.
- No platform parity claim: 외부 scanner, code-scanning product, broad security platform과 동등하거나 대체한다고 말하지 않는다.
- No automatic GitHub upload claim: SARIF file 생성과 GitHub upload workflow, alert triage, risk closure를 같은 것으로 말하지 않는다.
- No product rename, no CLI behavior change, no rule/severity/default policy change, no SaaS/auth/dashboard claim.
- CLI commands, rule IDs, verdict values, JSON fields, SARIF fields, API fields, and machine contracts stay English-compatible.
