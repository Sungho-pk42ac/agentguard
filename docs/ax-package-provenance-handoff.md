# AX package provenance reviewer handoff card

한국어 우선 카드입니다. fresh clone이나 package-style demo를 보는 reviewer에게 AgentGuard가 지금 제공하는 재실행 가능한 evidence와 public reference에서 빌린 신뢰 언어를 한 장으로 연결합니다.

## 사용 목적

대상권 reviewer가 "이 결과를 다시 만들 수 있나?", "package trust/provenance 이야기가 실제 evidence와 연결되나?", "MCP/SARIF는 어디까지 현재 구현인가?"를 물을 때 이 카드만 보여줍니다.

- 목표: PR diff, MCP config, transcript/log, SARIF artifact를 같은 fixture-backed command 흐름으로 묶어 reviewer handoff를 빠르게 만든다.
- 현재 범위: static scanner evidence, Markdown/SARIF artifact handoff, reviewer approval condition.
- 범위 밖: package release workflow 변경, npm token 사용, runtime MCP authorization/session control, GitHub SARIF upload 실행.

## Fresh clone/package readiness story

1. Reviewer는 fresh clone에서 `npm run typecheck`, `npm test`, `npm run build`를 먼저 봅니다.
2. 그 다음 아래 fixture-backed commands로 AgentGuard evidence가 다시 만들어지는지 확인합니다.
3. package provenance 질문에는 "현재 package trust story는 테스트-전-릴리스와 재실행 가능한 evidence handoff까지이며, release/publish workflow는 이 카드에서 바꾸지 않는다"라고 답합니다.
4. SARIF 질문에는 "AgentGuard는 SARIF artifact를 만들 수 있고, repository owner가 workflow/API를 구성해야 GitHub code scanning으로 넘어간다"라고 답합니다.

## Fixture-backed evidence commands

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

| Evidence surface | Fixture path | Expected reviewer use |
| --- | --- | --- |
| PR diff | `examples/risky-pr.diff` | `secret.github_token` 같은 PR diff finding이 reviewer에게 보이는지 확인합니다. |
| MCP config | `examples/risky-mcp.json` | `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path` 같은 least privilege 위반을 static preflight evidence로 확인합니다. |
| transcript/log | `examples/agent-transcript.log`, `examples/agent-policy.yaml` | `generic-secret-assignment` 같은 transcript/log finding과 policy context를 함께 봅니다. |
| SARIF artifact | `.agentguard-demo/agentguard.sarif` | third-party SARIF artifact handoff 파일을 남기고, upload는 repository owner workflow/API 책임으로 둡니다. |

## Reviewer handoff table

| Reviewer question | Show this evidence | Approval condition |
| --- | --- | --- |
| Fresh clone에서 같은 결과가 나오나? | `npm run typecheck && npm test && npm run build` 뒤 fixture-backed commands를 재실행합니다. | command exit와 Markdown/SARIF artifact가 같은 finding family를 보여주면 reviewer handoff 완료. |
| PR diff secret risk가 package readiness와 무슨 관련인가? | `node dist/index.js scan-diff < examples/risky-pr.diff` | release 전 테스트/검토 문턱에서 `secret.github_token` finding을 사람이 볼 수 있으면 보류/수정 판단 가능. |
| MCP tool risk는 runtime control인가? | `node dist/index.js scan-mcp < examples/risky-mcp.json` | AgentGuard evidence는 static `scan-mcp` boundary입니다. runtime MCP authorization, session control, consent UI는 claim하지 않습니다. |
| SARIF는 GitHub에 올라가나? | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | SARIF artifact가 생성됩니다. GitHub upload는 owner가 workflow/API를 구성할 때만 다음 단계입니다. |

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| OWASP Agentic AI threats and mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic threat-model, mitigation, evidence/control language | OWASP coverage or endorsement claim | PR diff/MCP/transcript evidence를 threat-to-control handoff 문장으로 설명합니다. |
| MCP Security Best Practices: https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, token passthrough, confused deputy, SSRF, session, tool risk framing | runtime MCP authorization/session enforcement claim | static `scan-mcp` evidence와 reviewer approval boundary를 분리합니다. |
| GitHub Node.js package publishing: https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages | CI/tests-before-release, package trust/provenance vocabulary | npm publishing, token setup, release workflow change claim | package readiness story를 `typecheck → test → build → evidence commands` 순서로 둡니다. |
| GitHub SARIF upload: https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file | third-party SARIF artifact handoff and owner workflow language | GitHub upload already happens, code scanning owner configuration claim | exact SARIF artifact command를 제시하고 upload responsibility를 repository owner에게 둡니다. |

## Machine-contract boundaries

- Human-facing 설명은 한국어 우선이지만 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log` command names는 바꾸지 않습니다.
- `rule IDs`, `JSON`, `SARIF`, `API`, machine fields는 English-compatible contract로 유지합니다.
- 이 카드가 언급하는 rule IDs: `secret.github_token`, `mcp.broad_filesystem_access`, `mcp.filesystem_writable_path`, `generic-secret-assignment`.
- CLI output, SARIF schema, API names, exit-code semantics stay stable under this document.

## Non-claim guardrails

- production user logos, paid deployment proof, external buyer proof를 말하지 않습니다.
- OWASP, MCP, GitHub의 보증/인증/검증을 받았다고 말하지 않습니다.
- npm release, token, package publish workflow를 바꾸거나 설정했다고 말하지 않습니다.
- GitHub code scanning upload는 owner workflow/API 설정 전에는 handoff artifact까지만 말합니다.
- AgentGuard가 runtime MCP authorization, session control, consent UI를 제공한다고 말하지 않습니다.
- broad security-suite scope나 all-threat scope라고 말하지 않습니다.
