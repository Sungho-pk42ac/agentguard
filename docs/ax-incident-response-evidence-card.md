# AX incident response evidence card

이 문서는 한국어 우선 incident response evidence card입니다. 목표는 AgentGuard의 현재 fixture-backed `BLOCK` / `REVIEW` findings를 **incident triage → containment owner → fix/policy condition → rerun command → approval/residual-risk sentence** 순서로 연결하는 것입니다.

범위는 문서와 기존 evidence commands뿐입니다. Scanner behavior, CLI commands, rule IDs, JSON, SARIF, API, machine fields, product name은 바꾸지 않습니다.

## Incident triage map

| Finding | incident triage | owner/action | command evidence | approval language |
|---|---|---|---|---|
| `BLOCK` PR diff risk with `openai-key`, `anthropic-api-key`, `denied-command`, `mcp-env-token` | incident triage: release stop. Agent-visible diff may expose secret-like material, credential env passthrough, or destructive command text before merge. | containment owner: PR owner plus security reviewer. fix/policy condition: remove secret-like literals, rotate any real credential outside this fixture, and replace risky shell material with scoped workflow text. | rerun command: `node dist/index.js scan-diff < examples/risky-pr.diff` | approval/residual-risk sentence: "PR diff가 `BLOCK`이면 merge를 중단하고, secret-like material 제거와 credential rotation 기록이 끝난 뒤 같은 command를 재실행해 residual risk를 승인자가 문장으로 남깁니다." |
| `BLOCK` MCP config risk with `mcp-filesystem`, `mcp-github`, `mcp-filesystem-wide-root`, `mcp-env-token` | incident triage: tool rollout stop. Broad filesystem roots, sensitive tool surfaces, or credential env passthrough can overexpose company files to an agent/tool surface. | containment owner: MCP/tool owner plus platform/security reviewer. fix/policy condition: narrow filesystem root to the task workspace, prefer read-only access, and remove credential passthrough unless a named approver accepts the residual scope. | rerun command: `node dist/index.js scan-mcp < examples/risky-mcp.json` | approval/residual-risk sentence: "MCP evidence가 `BLOCK`이면 agent/tool 연결을 보류하고, root 축소와 credential passthrough 제거 조건을 확인한 뒤 남는 권한을 승인자가 적습니다." |
| `REVIEW` transcript/log risk with denied commands such as `rm -rf` or `git push --force` | incident triage: human review gate. The transcript shows actions that may be legitimate only with task-specific approval and rollback context. | containment owner: run owner plus incident commander. fix/policy condition: confirm whether the command was blocked, replace it with scoped safer commands, or record a narrow policy exception with approver, expiry, and rollback owner. | rerun command: `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | approval/residual-risk sentence: "transcript/log가 `REVIEW`이면 실행 범위와 rollback owner를 확인하기 전에는 확대 운영하지 않고, 예외 사유와 residual risk를 승인자가 한 문장으로 남깁니다." |
| PR diff SARIF handoff for the same incident | incident triage: machine-readable handoff. Human Markdown and SARIF should point to the same finding family without inventing a new verdict. | containment owner: CI/release owner. fix/policy condition: keep SARIF output as evidence routing for code scanning, while the human owner still decides containment and residual risk. | rerun command: `node dist/index.js scan-diff --sarif --out .agentguard-demo/incident-response.sarif < examples/risky-pr.diff` | approval/residual-risk sentence: "SARIF는 같은 finding을 `ruleId`, result, location 중심으로 보존하고, 승인 여부와 residual risk 문장은 reviewer handoff에 남깁니다." |

## Fixture-backed rerun commands

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/incident-response.sarif < examples/risky-pr.diff
```

Fixtures:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`

These fixtures are synthetic evidence inputs. They demonstrate triage language and rerunnable evidence, not real incident data.

## Public reference grounding

| Public reference | Borrow | Avoid | AgentGuard incident action |
|---|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | 빌릴 점 / Borrow: agentic AI threat, tool misuse, excessive agency, and mitigation vocabulary. | 피할 점 / Avoid: saying this card covers the full threat model or carries external endorsement. | Map `BLOCK` / `REVIEW` findings to stop, contain, fix, rerun, and residual-risk language. |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | 빌릴 점 / Borrow: authorization boundaries, client/server responsibility, and token-handling caution. | 피할 점 / Avoid: treating static MCP config evidence as runtime OAuth validation. | Use MCP findings to require least-privilege tool scope before agent/tool rollout. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | 빌릴 점 / Borrow: SARIF upload and code scanning artifact routing concepts. | 피할 점 / Avoid: saying SARIF replaces human approval or changes the CLI contract. | Keep `scan-diff --sarif --out` as machine-readable evidence for the same incident row. |
| https://github.com/snyk/agent-scan | 빌릴 점 / Borrow: clear agent, MCP server, and tool-risk category framing. | 피할 점 / Avoid: claiming vendor-scale coverage, adoption, or customer proof. | State AgentGuard's narrow current slice: PR diff, MCP config, transcript/log, and SARIF evidence. |
| https://github.com/Tencent/AI-Infra-Guard | 빌릴 점 / Borrow: AI infrastructure guardrail and workflow-risk framing. | 피할 점 / Avoid: claiming broad red-team platform parity. | Keep the card as an incident triage artifact over existing local scanner outputs. |
| https://github.com/splx-ai/agentic-radar | 빌릴 점 / Borrow: agentic workflow, tool, and MCP visibility framing. | 피할 점 / Avoid: claiming dashboard, runtime graph, or hosted observability scope. | Route current command evidence to owner/action language instead of expanding scanner behavior. |

## Machine-contract boundaries

- CLI commands stay English-compatible: `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`.
- rule IDs stay English-compatible: `openai-key`, `anthropic-api-key`, `denied-command`, `mcp-env-token`, `mcp-filesystem`, `mcp-github`, `mcp-filesystem-wide-root`.
- JSON, SARIF, `ruleId`, result, location, and other machine fields stay unchanged for automation and code scanning.
- Human wording may be Korean-first, but terminal commands, flags, fixture paths, and machine fields remain stable.

## Non-claim guardrails

- No fake adoption.
- No customer claim.
- No certification claim.
- No parity claim.
- No product rename.
- No scanner-rule expansion, CLI behavior change, hosted dashboard claim, runtime OAuth validation claim, or production deployment claim.
- Public references are grounding for language and artifact routing only; they do not imply endorsement, coverage equivalence, or operational deployment.
