# AX evidence tamper/replay check

한국어 우선 설명으로 AX Rollout Guard 심사자가 "이 증거가 변조되지 않았고 오래된 replay가 아닌가?"를 30초 안에 확인하게 한다. 범위는 현재 repo의 synthetic fixture, exact command, source artifact, artifact hash/freshness cue, approver action을 묶는 docs-contract slice다. Scanner behavior, CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine contracts는 바꾸지 않는다.

## 사용 목적

대상권(상위권/대상 후보) 심사에서는 finding 자체만큼 증적 관리 체인(chain of custody) 질문이 중요하다. AgentGuard demo evidence는 "agent가 말했다"가 아니라 reviewer가 같은 source artifact로 다시 실행할 수 있는 command, hash/freshness cue, approver action을 함께 보여줘야 한다.

이 카드는 tamper/replay 질문에 대한 운영 문장이다: **source artifact + rerun command + artifact hash + freshness condition + approver action**이 없으면 승인 증거가 아니라 조사 clue로 취급한다.

## Tamper/replay checklist

| Check | Korean-first reviewer question | Pass condition |
|---|---|---|
| Source-bound | 원본 source artifact가 repo/CI/host에 남아 있는가? | `examples/...` fixture 또는 CI/host artifact path가 command와 함께 적혀 있다. |
| Rerunnable | reviewer가 같은 저장소 루트에서 다시 실행할 수 있는가? | Exact command가 있고 input path가 존재한다. |
| Tamper cue | artifact hash 또는 commit SHA가 evidence note에 남는가? | Markdown/SARIF/report handoff에 artifact hash, commit SHA, 또는 source hash field를 적는다. |
| Freshness cue | 이 evidence가 아직 fresh한지 판단할 수 있는가? | diff/config/log/policy/SARIF workflow가 바뀌면 rerun trigger가 명시되어 있다. |
| Approver rerun | 승인자가 무엇을 다시 실행해야 하는가? | Approver action이 command rerun, hash compare, freshness decision으로 끝난다. |

## Surface evidence map

| Surface | Source artifact | Rerun command | Hash/freshness cue | Approver action |
|---|---|---|---|---|
| PR diff | `examples/risky-pr.diff` synthetic PR diff 또는 CI diff artifact | `node dist/index.js scan-diff < examples/risky-pr.diff` | artifact hash + commit SHA; diff가 바뀌면 freshness가 만료된다. | Security reviewer가 same-input rerun 후 report hash를 비교하고 merge approval 전 `BLOCK`/`REVIEW` handling을 확인한다. |
| MCP config | `examples/risky-mcp.json` synthetic MCP config 또는 host MCP config artifact path | `node dist/index.js scan-mcp < examples/risky-mcp.json` | config artifact hash; server command, root path, env passthrough, approval policy가 바뀌면 freshness가 만료된다. | Agent platform owner가 source path, command, hash를 확인하고 broad permission finding을 승인/수정/차단한다. |
| transcript/log | `examples/agent-transcript.log` + `examples/agent-policy.yaml` synthetic transcript/log and policy | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | log hash + policy hash; transcript/log 또는 approval-required operation list가 바뀌면 freshness가 만료된다. | Incident reviewer가 same-input rerun으로 unapproved shell evidence를 확인하고 residual-risk note 또는 rerun trigger를 남긴다. |
| SARIF/report | `.agentguard-demo/agentguard.sarif` generated SARIF path 또는 Markdown stdout report handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | SARIF artifact hash + source diff hash; SARIF command, upload workflow, source diff가 바뀌면 freshness가 만료된다. | CI owner가 same-input regeneration으로 SARIF/report artifact hash를 비교하고 code-scanning handoff 여부를 별도로 승인한다. |
| smoke manifest | `.agentguard-demo/ax-evidence-smoke/manifest.json` plus the same directory JSON/SARIF artifacts | `npm run smoke:ax-demo` | manifest hash + referenced artifact hashes + source fixture hashes; any fixture, command, build output, manifest row, JSON/SARIF artifact, or evidence directory change expires freshness. | Reviewer reruns the smoke command, compares same-run manifest/artifact/source hashes, and rejects mixed-run or stale handoff evidence. |

## Exact fixture-backed commands

Fresh clone에서는 먼저 `npm ci && npm run build && mkdir -p .agentguard-demo`를 실행한 뒤 저장소 루트에서 아래 command를 그대로 재현한다. `.agentguard-demo` directory를 만들지 않으면 SARIF `--out` command는 쓰기 실패로 끝날 수 있으므로, reviewer handoff에는 setup command와 rerun command를 함께 남긴다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

Fixture-backed evidence rules:

- `examples/risky-pr.diff` is synthetic PR diff evidence.
- `examples/risky-mcp.json` is synthetic MCP config evidence.
- `examples/agent-policy.yaml` and `examples/agent-transcript.log` are synthetic policy and transcript/log evidence.
- `.agentguard-demo/agentguard.sarif` is a generated SARIF/report artifact path, not a committed upload result.
- Record artifact hash, source hash, freshness, and rerun trigger beside every reviewer handoff.
- Use same-input regeneration before approval: rerun the exact command with the same fixture/source artifact, then compare the report or SARIF artifact hash.
- Smoke manifest replay is hash-backed: rerun `npm run smoke:ax-demo`, then compare `.agentguard-demo/ax-evidence-smoke/manifest.json`, referenced JSON/SARIF artifact hashes, and source fixture hashes from the same run.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) | Borrow: agent/tool risk, sensitive data exposure, supply-chain and governance vocabulary를 빌려 evidence를 control evidence에 묶는다. | Avoid: full OWASP coverage, runtime firewall, external assurance, certification, or complete AI security platform claim. | AgentGuard action: PR diff, MCP config, transcript/log evidence에 source artifact, rerun command, hash/freshness cue, approver rerun을 붙인다. |
| [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) | Borrow: permission, token, consent, redirect, credential-boundary language를 빌려 MCP config evidence를 설명한다. | Avoid: MCP conformance, runtime authorization, OAuth/session enforcement, consent UI, or credential-control implementation claim. | AgentGuard action: MCP config row에 source path, command, artifact hash, and rerun trigger를 요구한다. |
| [GitHub SARIF upload](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/integrate-with-existing-tools/upload-sarif-file) | Borrow: third-party SARIF artifact can be handed to GitHub code scanning when a workflow/user uploads it. | Avoid: saying upload, triage, or approval happens without a configured workflow and owner. | AgentGuard action: require SARIF/Markdown artifact paths, artifact hash, and same-input regeneration note before reviewer handoff. |
| [GitHub SARIF support](https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support) | Borrow: SARIF rule/result/location artifact vocabulary for code-scanning handoff. | Avoid: changing AgentGuard SARIF fields or claiming GitHub-native ownership. | AgentGuard action: keep SARIF/report evidence source-bound and hash-checked without changing CLI/SARIF machine contracts. |

## Non-claim guardrails

- no scanner behavior change: 이 카드는 scanner rules, verdict semantics, severity/blocking policy, CLI commands, rule IDs, JSON fields, SARIF fields를 바꾸지 않는다.
- no automatic SARIF upload: SARIF/Markdown artifact path and hash를 요구하지만 GitHub upload, triage, approval execution을 AgentGuard가 대신한다고 주장하지 않는다.
- no MCP runtime auth/consent enforcement: MCP permission/token/consent language는 evidence framing이며 runtime authorization, OAuth/session enforcement, consent UI 구현 주장이 아니다.
- no external certification: OWASP, MCP, GitHub reference는 borrow/avoid/action framing이며 외부 감사, 인증, 보증, conformance, trust badge가 아니다.
- no real customer/adoption claim: synthetic fixture만 사용하며 실제 구매자, 운영 배포, named deployment, customer data, adoption proof를 주장하지 않는다.
- Human-facing explanation is Korean-first; automation-facing CLI commands, rule IDs, verdict values, JSON, SARIF, API, machine contracts stay English-compatible.
