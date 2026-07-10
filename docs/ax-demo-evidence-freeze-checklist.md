# AX demo evidence freeze checklist

한국어 우선 체크리스트로, AX Rollout Guard 예선/본선 발표 직전에 회사 문제를 받은 뒤 AgentGuard evidence를 10분 안에 고정하고 심사위원에게 재현 가능한 packet으로 넘긴다. 이 문서는 static AgentGuard evidence를 다룬다. AgentGuard는 runtime consent, OAuth, MCP authorization, GitHub upload workflow를 대신 실행하지 않는다.

## 10분 evidence freeze 순서

1. 회사 문제를 한 문장으로 적는다: 어떤 agent가 어떤 tool, PR diff, MCP config, transcript/log를 건드렸는지 먼저 고정한다.
2. 아래 fixture-backed commands를 저장소 루트에서 재실행한다. build된 CLI가 필요하면 먼저 `npm run build`를 실행한다.
3. 각 artifact를 `.agentguard-demo/ax-evidence-freeze/` 아래에 저장했다고 표시한다. 실제 발표에서는 같은 timestamp 또는 같은 terminal session에서 나온 output만 묶는다.
4. 발표 문장을 준비한다: `PASS`는 승인 가능, `REVIEW`는 human approver 보류, `BLOCK`은 차단 또는 수정 후 재실행이다.
5. reviewer에게 source-of-record packet을 넘긴다: PR diff JSON, MCP JSON, transcript/log JSON, SARIF file, smoke manifest command를 한 장에 묶는다.

## Fixture-backed freeze commands

| Evidence surface | Exact command | Fixture path | Freeze artifact | Judge replay note |
|---|---|---|---|---|
| PR diff | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/ax-evidence-freeze/pr-diff-findings.json` | Expected verdict: `BLOCK`; 새 PR diff에 secret-like value나 denied command가 들어오면 승인 전에 수정한다. |
| MCP config | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `.agentguard-demo/ax-evidence-freeze/mcp-config-findings.json` | Expected verdict: `BLOCK`; broad filesystem, writable path, credential-like env passthrough를 human approver 질문으로 올린다. |
| transcript/log | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` plus `examples/agent-policy.yaml` | `.agentguard-demo/ax-evidence-freeze/transcript-log-findings.json` | Expected verdict: `REVIEW`; denied command evidence는 승인, 보류, 차단 중 어느 결정인지 사람이 남긴다. |
| SARIF/report artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-freeze/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/ax-evidence-freeze/agentguard.sarif` | Expected verdict: `BLOCK`; SARIF 2.1.0 file은 GitHub code scanning이나 reviewer archive에 넘길 수 있는 handoff artifact다. |
| smoke manifest | `npm run smoke:ax-demo` | `scripts/ax-demo-smoke.mjs` | `.agentguard-demo/ax-evidence-smoke/manifest.json` | Expected result: manifest includes PR diff, MCP config, transcript/log, and SARIF checks; smoke manifest는 같은 demo surface를 한번에 재생했다는 source-of-record index다. |

Machine-facing spelling은 바꾸지 않는다: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `JSON`, `SARIF`, `rule IDs`, `PASS`, `REVIEW`, `BLOCK`는 CI와 reviewer가 그대로 읽는 contract다.

## Public reference borrow/avoid/action rows

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agentic threat, tool misuse, approval control, evidence control language를 심사위원 설명에 빌린다. | Avoid: OWASP coverage나 full runtime prevention claim. | AgentGuard action: PR diff, MCP config, transcript/log evidence를 static preflight와 human approval checkpoint로 낮춰 보여준다. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) | Borrow: explicit approval, user consent, least privilege, confused deputy framing을 MCP 설명에 빌린다. | Avoid: MCP runtime authorization, OAuth/session enforcement, consent UI ownership claim. | AgentGuard action: `scan-mcp` output으로 broad filesystem and token passthrough risk를 approval question으로 고정한다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF file, code scanning handoff, reviewer artifact vocabulary를 빌린다. | Avoid: SARIF upload가 곧 승인이라는 claim이나 automatic upload scope. | AgentGuard action: `.agentguard-demo/ax-evidence-freeze/agentguard.sarif`를 reviewer-owned upload or archive input으로 둔다. |
| [Snyk CLI docs](https://docs.snyk.io/developer-tools/snyk-cli/snyk-cli) | Borrow: concise CLI onboarding, exact command, local rerun/status wording을 빌린다. | Avoid: Snyk product scope, hosted dashboard, remediation workflow, vendor-scale equivalence claim. | AgentGuard action: fixture-backed AgentGuard command와 expected verdict만 짧게 제시한다. |

## Static evidence and runtime enforcement boundary

- static AgentGuard evidence: 이 checklist는 repository fixture, PR diff, MCP config, transcript/log, SARIF artifact를 재실행 가능한 증거로 묶는다.
- does not enforce runtime consent: AgentGuard는 운영 중 user consent dialog나 tool approval UI를 강제하지 않는다.
- does not enforce OAuth: AgentGuard는 OAuth grant, callback state, token exchange, session lifetime을 처리하지 않는다.
- does not run MCP servers: `scan-mcp`는 config를 정적으로 읽고 MCP server process를 실행하지 않는다.
- does not upload SARIF automatically: SARIF file을 만들 수 있지만 GitHub upload는 reviewer나 CI workflow 소유 step이다.
- no scanner behavior change: 이 문서는 detector logic, default severity, verdict policy를 바꾸지 않는다.
- no CLI command change: CLI commands, command flags, rule IDs, JSON/SARIF fields는 영어 machine contract로 유지한다.
- no verdict policy change: `PASS`, `REVIEW`, `BLOCK` 의미와 non-zero exit handling은 현재 구현을 따른다.
- no package publishing change: npm metadata, version, package files list, release process를 바꾸지 않는다.
- no real credentials: 모든 demo input은 synthetic fixture이며 실제 credential, customer data, logo, deployment evidence를 넣지 않는다.

## Judge replay packet

- PR diff: `pr-diff-findings.json`에서 어떤 줄이 승인 전 수정 대상인지 보여준다.
- MCP config: `mcp-config-findings.json`에서 filesystem scope와 credential-like env passthrough를 보여준다.
- transcript/log: `transcript-log-findings.json`에서 policy-backed `REVIEW` item을 human approver 질문으로 읽는다.
- SARIF/report artifact: `agentguard.sarif`를 reviewer archive 또는 code scanning handoff input으로 둔다.
- smoke manifest: `.agentguard-demo/ax-evidence-smoke/manifest.json`를 같은 surface를 재생한 source-of-record index로 제시한다.
- 발표 문장: "AgentGuard가 대신 승인한 것이 아니라, 정적 evidence를 고정했고 심사위원이 무엇을 승인, 보류, 차단했는지 같은 명령으로 재현할 수 있습니다."
