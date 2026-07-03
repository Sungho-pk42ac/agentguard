# AX evidence bundle manifest

AX 인재전쟁 제출/현장 설명에서 AgentGuard의 현재 증거를 흩어진 링크가 아니라 하나의 재현 가능한 bundle로 보여주기 위한 Korean-first manifest입니다. 목적은 `real AI talent`와 `onsite evidence` 프레이밍에 맞춰 현재 repo가 실제로 재실행할 수 있는 PR diff, MCP config, transcript/log, SARIF, review handoff 증거를 정리하는 것입니다.

## 사용 목적

- 대상: AX Rollout Guard를 처음 보는 심사자 또는 리뷰어.
- 쓰임: 회사 문제를 받은 뒤 "어떤 agent risk를 어떤 명령으로 확인하고, 어떤 rollout controls로 승인/차단하는가"를 1장으로 설명합니다.
- 경계: 숨겨진 포털 rubric, 상용 사용자 사례, 외부 기관 인증, vendor급 범위는 주장하지 않습니다.

## Bundle contents

| Bundle item | Repo evidence | Judge-visible use |
|---|---|---|
| PR diff risk | `examples/risky-pr.diff` | 새 secret/PII/위험 shell material을 `REVIEW` 또는 `BLOCK` 근거로 보여줍니다. |
| MCP config risk | `examples/risky-mcp.json` | broad filesystem, writable path, credential passthrough 같은 agent 권한 위험을 보여줍니다. |
| transcript/log risk | `examples/agent-transcript.log` + `examples/agent-policy.yaml` | 운영자가 정책으로 검토해야 하는 shell behavior를 설명합니다. |
| SARIF handoff | `examples/agentguard.sarif` sample + `.agentguard-demo/agentguard.sarif` generated output | GitHub code scanning으로 넘길 수 있는 machine-readable 보안 artifact 예시와 재생성 경로입니다. |
| Review handoff | `docs/ax-ci-reviewer-handoff.md` | CI/PR comment/approval note로 사람이 최종 판단하는 흐름을 연결합니다. |

## Fixture-backed commands

사전 준비: fresh clone이면 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`로 `dist/index.js`와 임시 artifact directory를 만듭니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

이 명령들은 fixture-backed evidence만 사용합니다. CLI, JSON, SARIF, rule ID, machine field 계약은 English-compatible 형태로 유지합니다.

## Expected verdicts and artifacts

| Surface | Expected signal | Artifact |
|---|---|---|
| PR diff | `REVIEW` 또는 `BLOCK` finding with `secret.github_token` style evidence | Markdown report |
| MCP config | `BLOCK` 또는 `REVIEW` finding with `mcp.broad_filesystem_access` | Markdown report |
| transcript/log | policy-driven `REVIEW` finding | Markdown report |
| SARIF | code-scanning upload-ready JSON/SARIF artifact | `.agentguard-demo/agentguard.sarif` generated output; `examples/agentguard.sarif` static sample |
| reviewer loop | 사람이 확인할 approval condition and residual risk | approval note |

`PASS`는 finding이 없는 입력 또는 수정/정책 반영 후 재실행에서만 말합니다. 이 manifest는 실제 judge run을 대신하지 않고, 현재 repo evidence를 빠르게 재현하는 색인입니다.

## Public reference borrow/avoid notes

| Public reference | Borrow | Avoid | Manifest use |
|---|---|---|---|
| `https://hackathon.jocodingax.ai/` | `real AI talent`, onsite evidence framing | gated portal details or final hidden rubric claims | 현재 repo에서 재현 가능한 evidence bundle만 말합니다. |
| `https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/` | agentic risk to mitigation/control language | OWASP coverage or external endorsement claims | findings를 rollout controls와 residual risk로 연결합니다. |
| `https://github.com/snyk/agent-scan` | agent/MCP component scanning category | vendor-scale, vendor-equivalent, or broad platform claims | AgentGuard scope를 PR/MCP/transcript evidence로 제한합니다. |
| `https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github` | machine-readable SARIF handoff shape | GitHub security product substitute claims | SARIF artifact command와 reviewer handoff만 설명합니다. |

## Non-claim guardrails

- 상용 사용자 사례, production adoption, reference customer를 말하지 않습니다.
- 공식 인증, 외부 기관 검증 완료, SOC 2/ISO 27001 준수 상태를 말하지 않습니다.
- 외부 보안 제품 수준의 범위나 보증을 말하지 않습니다.
- 완전한 플랫폼, 전면 보안 커버리지, 전체 위협 커버리지를 말하지 않습니다.
- Human-facing explanation만 Korean-first이고 machine contracts는 그대로 유지합니다.

## English-compatible machine contracts

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- Rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`
- Artifacts: Markdown report, JSON, SARIF, `agentguard.sarif`
- Human layer: Korean-first review handoff, approval note, rollout controls, residual risk
