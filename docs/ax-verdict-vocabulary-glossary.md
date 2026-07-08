# AX verdict vocabulary glossary

이 문서는 AX Rollout Guard 심사자와 reviewer가 AgentGuard verdict와 evidence language를 같은 뜻으로 읽게 만드는 **한국어 우선** glossary입니다. 범위는 설명 언어뿐이며, machine-facing CLI command names, verdict values, rule IDs, JSON/SARIF fields, package metadata는 English-compatible contract로 그대로 둡니다.

## Glossary

| Term | 심사자에게 설명할 한국어 의미 | Evidence cue | Public reference influence | Non-claim |
|---|---|---|---|---|
| `PASS` | 현재 fixture와 policy 기준으로 차단 finding이 없거나 위험이 승인 조건 안으로 줄어든 상태입니다. 운영 승인이 자동으로 끝났다는 뜻은 아닙니다. | rerun condition과 residual risk를 같이 적습니다. | GitHub SARIF handoff 언어처럼 machine-readable result를 reviewer에게 넘기는 표현을 빌립니다. | No automatic approval claim |
| `REVIEW` | 사람 reviewer 또는 evidence owner가 배포 전 맥락, consent, residual risk를 확인해야 하는 상태입니다. | approval owner, evidence owner, rerun condition을 붙입니다. | MCP Security Best Practices의 user consent, least privilege, confused-deputy framing을 빌립니다. | No runtime consent validation claim |
| `BLOCK` | 현재 fixture evidence 기준으로 rollout, merge, 또는 tool permission 부여를 멈춰야 하는 상태입니다. | blocking rule ID, risky surface, required fix/policy condition을 붙입니다. | OWASP Agentic AI threats/mitigations의 agent/tool risk와 mitigation/control vocabulary를 빌립니다. | No OWASP coverage claim |
| `PR diff` | agent가 바꾸려는 코드 변경에서 secret-like material, risky shell behavior, policy bypass를 찾는 evidence surface입니다. | `scan-diff` command, diff fixture, rule ID, reviewer question | Snyk `agent-scan`의 AI-agent inventory/security scan category language 중 code/change surface framing을 참고합니다. | No vendor-scale parity claim |
| `MCP config` | agent tool permission, filesystem scope, token passthrough 같은 MCP permission risk를 보는 evidence surface입니다. | `scan-mcp` command, MCP config fixture, least privilege question | MCP Security Best Practices의 least privilege, user consent, token handling wording을 빌립니다. | No MCP spec-coverage claim |
| `transcript/log` | agent가 실제로 남긴 command, tool call, approval-required action을 reviewer가 추적하는 evidence surface입니다. | `scan-log --policy` command, policy fixture, transcript/log fixture | OWASP와 MCP의 tool misuse, confused deputy, human-in-the-loop vocabulary를 빌립니다. | No runtime monitoring claim |
| `SARIF` | CI/security reviewer에게 넘기는 machine-readable handoff artifact입니다. Markdown 설명을 대신하지 않고 같은 finding을 route하는 형식입니다. | `scan-diff --sarif --out ...` command, SARIF artifact path, rule IDs | GitHub SARIF upload docs의 artifact, upload, code scanning handoff vocabulary를 빌립니다. | No automatic SARIF upload claim |
| `evidence owner` | command를 재실행하고 artifact를 reviewer에게 설명할 책임자입니다. | owner name/role, exact command, artifact path | MCP consent framing처럼 권한 부여와 검토 책임을 분리합니다. | No SaaS workflow claim |
| `residual risk` | `PASS` 또는 승인 뒤에도 fixture 한계, 운영 데이터 차이, permission scope 때문에 남는 위험입니다. | residual risk sentence, approval condition | OWASP mitigation/control vocabulary를 빌려 "고친 뒤에도 남는 것"을 말합니다. | No zero-risk claim |
| `rerun condition` | 수정, policy change, permission narrowing 뒤 어떤 command를 다시 실행해야 하는지 적은 조건입니다. | exact command, expected verdict, artifact path | GitHub SARIF와 scanner handoff language처럼 rerunnable artifact를 남기는 표현을 빌립니다. | No continuous platform claim |

## Fixture-backed evidence commands

아래 command는 모두 현재 저장소의 합성 fixture만 사용합니다. 발표 전 `npm run build` 후 저장소 루트에서 실행합니다.

| Surface | Exact command | Fixture path | Judge-facing wording |
|---|---|---|---|
| PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` | "이 PR diff는 reviewer가 merge 전에 봐야 할 risky change evidence입니다." |
| MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | "이 MCP config는 least privilege와 token handling 관점에서 permission review가 필요합니다." |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | "이 transcript/log는 approval-required action을 evidence owner가 확인해야 합니다." |
| SARIF | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff` | "같은 PR diff finding을 SARIF handoff artifact로 reviewer channel에 넘깁니다." |

## Public reference influence

| Public reference | Borrow | Avoid | AgentGuard wording |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Agent autonomy, tool misuse, sensitive data, mitigation/control vocabulary를 빌릴 점으로 둡니다. | OWASP certification, complete threat coverage, external assurance처럼 말하지 않습니다. | "agent/tool risk", "mitigation/control", "residual risk" |
| MCP Security Best Practices: https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | Least privilege, user consent, token handling, confused-deputy framing을 빌릴 점으로 둡니다. | MCP spec coverage, runtime consent enforcement, token broker 기능처럼 말하지 않습니다. | "least privilege", "permission review", "user consent question" |
| Snyk `agent-scan`: https://github.com/snyk/agent-scan | Public AI-agent inventory/security scan category language를 빌릴 점으로 둡니다. | Vendor-scale parity, product replacement, enterprise coverage처럼 말하지 않습니다. | "agent inventory surface", "scanner surface", "fixture-backed evidence" |
| GitHub SARIF upload docs: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF artifact, upload, code scanning, machine-readable reviewer handoff vocabulary를 빌릴 점으로 둡니다. | Automatic upload, alert resolution, GitHub security product coverage처럼 말하지 않습니다. | "SARIF handoff artifact", "machine-readable reviewer handoff" |

## Machine-contract boundaries

- Keep `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `scan-diff`, `scan-mcp`, `scan-log` as command names and subcommand names.
- Keep verdict values as `PASS`, `REVIEW`, `BLOCK`.
- Keep rule IDs such as `generic-secret-assignment` and `mcp.broad_filesystem_access`.
- Keep JSON and SARIF fields as machine fields; Korean prose explains them outside the artifact.
- Keep package metadata, npm names, shell flags, and GitHub Actions identifiers as English-compatible identifiers.

## Non-claim guardrails

- No customer claim: 이 문서는 synthetic fixture evidence를 설명하며 real deployment, adoption, reference account를 주장하지 않습니다.
- No certification claim: OWASP, MCP, GitHub, Snyk는 vocabulary reference이며 external assurance가 아닙니다.
- No platform-parity claim: AgentGuard를 Snyk, GitHub code scanning, broad red-team product, dashboard, auth, SaaS product와 같은 범위로 말하지 않습니다.
- No automatic SARIF upload claim: `--sarif --out`은 local handoff artifact를 만들 뿐이며 upload, alert resolution, code scanning setup을 대신하지 않습니다.
- No machine-contract rewrite: Korean-first docs는 reviewer comprehension을 돕는 layer이고 CLI behavior, scanner logic, severity/default policy, JSON/SARIF output, package metadata를 바꾸지 않습니다.
