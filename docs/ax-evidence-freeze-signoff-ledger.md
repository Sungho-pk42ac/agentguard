# AX evidence freeze sign-off ledger

한국어 우선 sign-off ledger로, enterprise commerce VOC scenario의 frozen evidence를 승인자가 같은 명령으로 재현하고 `PASS`, `REVIEW`, `BLOCK` 판단을 남기게 한다. 목적은 AgentGuard가 대신 승인했다는 claim이 아니라, static AgentGuard evidence를 source artifact, exact command, artifact, approver, sign-off condition, rerun trigger, 재실행 trigger로 묶는 것이다.

## Sign-off ledger

| Evidence surface | Exact command | Fixture path | Freeze artifact | Expected verdict | approver | sign-off condition | rerun trigger |
|---|---|---|---|---|---|---|---|
| PR diff | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/ax-evidence-freeze/pr-diff-findings.json` | `BLOCK` | PR reviewer or release owner | secret-like value, denied command, or risky shell material is removed or explicitly blocked before rollout. | PR diff changes, finding count changes, or `rule IDs` differ from the frozen artifact. |
| MCP config | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `.agentguard-demo/ax-evidence-freeze/mcp-config-findings.json` | `BLOCK` | MCP/tool owner | broad filesystem, writable path, and credential-like env passthrough are narrowed or rejected by the human approver. | MCP server config, env passthrough, filesystem scope, or tool permission text changes. |
| transcript/log | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` plus `examples/agent-policy.yaml` | `.agentguard-demo/ax-evidence-freeze/transcript-log-findings.json` | `REVIEW` | 운영 승인자 or policy owner | denied command evidence is signed as accept, defer, or block with a human reason. | transcript/log, policy file, or denied command wording changes. |
| SARIF/report artifact | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-freeze/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/ax-evidence-freeze/agentguard.sarif` | `BLOCK` | Security reviewer | SARIF is archived or handed to reviewer-owned code scanning flow as evidence, not as approval by itself. | SARIF file, PR diff, or reviewer archive destination changes. |
| smoke manifest | `npm run smoke:ax-demo` | `scripts/ax-demo-smoke.mjs` | `.agentguard-demo/ax-evidence-smoke/manifest.json` | Manifest replay | Demo operator | manifest includes PR diff, MCP config, transcript/log, and SARIF checks from the same evidence freeze. | any freeze command is rerun, any artifact path changes, or the manifest timestamp is stale. |

서명 조건은 machine output을 한국어로 바꾸지 않는다. `agentguard`, `scan-diff`, `scan-mcp`, `scan-log`, `JSON`, `SARIF`, `rule IDs`, `PASS`, `REVIEW`, `BLOCK` spelling은 reviewer와 CI가 읽는 machine contract로 유지한다.

## Public reference borrow/avoid/action rows

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Borrow: agent governance, tool/action risk, human oversight, and evidence control framing. | Avoid: full threat coverage or runtime prevention claim. | AgentGuard action: static findings become approval questions and sign-off rows. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) | Borrow: explicit approval, user consent, least privilege, confused deputy, and token-passthrough vocabulary. | Avoid: runtime MCP authorization, OAuth/session control, or consent UI ownership claim. | AgentGuard action: `scan-mcp` freezes config risk as a reviewer decision input. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF artifact handoff and code scanning archive vocabulary. | Avoid: automatic upload, GitHub-native triage ownership, or approval claim. | AgentGuard action: generated SARIF is a reviewer-owned handoff artifact. |
| [Snyk CLI docs](https://docs.snyk.io/developer-tools/snyk-cli/snyk-cli) | Borrow: exact command, status, and rerun language. | Avoid: hosted dashboard, remediation workflow, or vendor-scale equivalence claim. | AgentGuard action: each row starts with the command a reviewer can rerun. |

## Static evidence boundary

- static AgentGuard evidence: 이 ledger는 repository fixture, PR diff, MCP config, transcript/log, JSON output, SARIF artifact, smoke manifest를 재실행 가능한 sign-off packet으로 묶는다.
- does not enforce runtime consent: AgentGuard는 운영 중 user consent dialog나 tool approval UI를 강제하지 않는다.
- does not enforce OAuth: AgentGuard는 OAuth grant, callback state, token exchange, session lifetime을 처리하지 않는다.
- does not enforce MCP authorization: `scan-mcp`는 MCP config를 정적으로 읽고 MCP server process나 runtime authorization decision을 실행하지 않는다.
- does not upload SARIF automatically: SARIF file을 만들 수 있지만 upload, archive, code scanning import는 reviewer나 CI workflow 소유 step이다.
- no scanner behavior change: 이 문서는 detector logic, default severity, verdict policy를 바꾸지 않는다.
- no real credentials: 모든 input은 synthetic fixture이고 실제 credential을 포함하지 않는다.
- no customer data: 모든 scenario text는 demo fixture이며 private data를 쓰지 않는다.

## Fake-claim guardrails

- No adoption claim: 실제 사용 사례나 상용 rollout 증거로 말하지 않는다.
- No certification claim: 외부 기관이 AgentGuard를 보증했다는 식으로 말하지 않는다.
- No parity claim: hosted security product와 같은 범위라고 말하지 않는다.
- No automatic approval claim: `PASS`, `REVIEW`, `BLOCK`는 reviewer decision을 돕는 evidence vocabulary이며 AgentGuard가 운영 sign-off를 대신하지 않는다.
- No machine-contract rename: CLI commands, flags, `JSON`, `SARIF`, and `rule IDs`는 Korean-first 설명과 분리해서 그대로 둔다.
