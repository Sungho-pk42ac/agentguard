# AX smoke provenance quickcheck

한국어 우선 AX Rollout Guard reviewer quickcheck입니다. 목적은 `npm run smoke:ax-demo` evidence bundle을 받은 심사자나 보안 reviewer가 30초 안에 **어느 repo / commit / branch / tree state / artifact path**에서 나온 증거인지 확인하게 하는 것입니다. 이 카드는 scanner behavior, CLI flags, SARIF fields, GitHub Action behavior, package publishing, or verdict policy를 바꾸지 않습니다.

## 30초 provenance flow

1. Fresh clone 또는 reviewer workspace에서 먼저 build합니다.

```bash
npm run build
```

2. 같은 repo root에서 smoke bundle을 생성합니다.

```bash
npm run smoke:ax-demo
```

3. 기본 source-of-record manifest를 엽니다.

```text
.agentguard-demo/ax-evidence-smoke/manifest.json
```

4. reviewer는 아래 field를 먼저 확인합니다: `repositoryUrl`, `gitCommitSha`, `gitBranch`, `gitTreeState`, `manifestPath`, `requiredArtifacts`, `evidenceDirectory`, `sourceSha256`, `artifactSha256`, `producerIntent`.

5. `gitTreeState`가 `dirty`이면 최종 handoff로 쓰기 전에 clean tree에서 `npm run smoke:ax-demo`를 다시 실행합니다. `clean`이어도 `gitCommitSha`와 PR/CI SHA가 다르면 같은 evidence로 승인하지 않습니다.

## Exact evidence surfaces

| Surface | Source fixture | Expected handoff check |
|---|---|---|
| PR diff | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `checks[]` row has `surface: pr-diff`, `inputPath`, `sourceSha256`, `artifactSha256`, and `requiredArtifacts` points at the generated JSON artifact. |
| MCP config | `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | Static MCP config evidence only; reviewer checks broad root/env-token findings without claiming runtime OAuth/session enforcement. |
| transcript/log | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` with `examples/agent-policy.yaml` | Reviewer checks policy-backed `denied-command` evidence and treats `REVIEW` as human approval required, not automatic pass. |
| smoke producer | `scripts/ax-demo-smoke.mjs` | `producerIntent` says this is reviewer source-of-record evidence, not approval, automatic upload, certification, scanner parity, or runtime authorization/session enforcement. |

For an explicit SARIF artifact rerun outside the bundled smoke command:

```bash
node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-smoke-provenance/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Expected result: risky fixture evidence exits non-zero and creates `.agentguard-demo/ax-smoke-provenance/agentguard.sarif`; reviewer treats the non-zero result as expected `REVIEW`/`BLOCK` proof only after checking the generated artifact path.

## Reviewer decision rule

| If the quickcheck sees... | Decision language |
|---|---|
| `repositoryUrl` points at the expected AgentGuard repo, `gitCommitSha` matches the reviewed PR/CI SHA, `gitBranch` is expected, `gitTreeState` is `clean`, and all `requiredArtifacts` exist under `evidenceDirectory` | `PASS` for provenance check; still review the findings themselves. |
| `gitTreeState` is `dirty`, artifact paths are missing, or `manifestPath` points outside the evidence directory | `REVIEW`; rerun from clean tree before judge/reviewer handoff. |
| `repositoryUrl`, `gitCommitSha`, or artifact hashes do not match the claimed source | `BLOCK`; do not use that bundle as source-of-record evidence. |

## Public reference Borrow/Avoid/AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Agent/tool misuse, excessive permissions, and credential exposure framing for reviewer language. | Do not claim AgentGuard implements the full OWASP runtime mitigation program. | Tie every risky fixture to `sourceSha256`, `artifactSha256`, and human approval language. |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Least privilege, token, consent, and authorization-boundary vocabulary. | Do not claim static `scan-mcp` performs runtime OAuth/session/consent enforcement. | Keep MCP evidence as static pre-rollout config proof with explicit rerun conditions. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF artifact handoff, upload boundary, and source-location vocabulary. | Do not claim automatic GitHub upload or external approval. | Use `.agentguard-demo/.../agentguard.sarif` as reviewer-owned artifact input. |
| https://vercel.com/docs/cli | CLI-style preflight and reproducible local command UX. | Do not imply hosted dashboard, auth, deploy, or observability features. | Keep the quickcheck local: build, smoke, manifest, artifact paths, hashes, and rerun trigger. |

## Machine-contract and non-claim boundary

Keep English-compatible machine contracts unchanged: `PASS`, `REVIEW`, `BLOCK`, `scan-diff`, `scan-mcp`, `scan-log`, `--sarif`, `--out`, `checks[]`, `requiredArtifacts`, `sourceSha256`, `artifactSha256`, `repositoryUrl`, `gitCommitSha`, `gitBranch`, and `gitTreeState`.

Current boundary phrase from the manifest must stay true: `not approval, automatic upload, certification, scanner parity, or runtime authorization/session enforcement`. This quickcheck is a reviewer/source-of-record handoff, not 고객 도입 evidence, official certification, GitHub replacement, Snyk replacement, or runtime authorization enforcement.
