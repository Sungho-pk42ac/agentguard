# AX smoke evidence manifest handoff card

한국어 우선 설명으로 `npm run smoke:ax-demo`가 남기는 evidence manifest를 심사자와 reviewer에게 넘기는 방법을 정리한다. 이 카드는 scanner behavior, CLI commands, rule IDs, JSON/SARIF field names, package publishing config, verdict policy를 바꾸지 않는다.

## 사용 목적

`npm run smoke:ax-demo`는 fresh clone에서 build된 CLI가 PR diff, MCP config, transcript/log, SARIF surface를 실제로 재생했는지 확인하는 smoke command다. 기본 output은 `.agentguard-demo/ax-evidence-smoke/manifest.json`이며, 같은 run의 JSON/SARIF evidence artifact를 reviewer가 따라갈 수 있게 묶는다.

이 manifest는 agent self-report가 아니라 **source-of-record reviewer handoff artifact**다. reviewer는 말로 된 요약보다 `manifest.json`의 `checks[]` row, artifact path, fixture path, rerunnable command, expected exit/verdict를 먼저 본다.

## Source-of-record handoff

1. 저장소 루트에서 `npm run build`를 먼저 실행한다.
2. 같은 루트에서 `npm run smoke:ax-demo`를 실행한다.
3. 기본 manifest path는 `.agentguard-demo/ax-evidence-smoke/manifest.json`이다.
4. 격리된 evidence directory가 필요하면 `AGENTGUARD_AX_DEMO_EVIDENCE_DIR=/tmp/agentguard-ax-smoke npm run smoke:ax-demo`처럼 override한다.
5. PR comment, reviewer note, 발표 리허설에서 같은 evidence bundle을 짧게 지칭해야 하면 `AGENTGUARD_AX_DEMO_RUN_ID=cron:20260713T130000Z.issue-537 npm run smoke:ax-demo`처럼 stable `runId`를 주입한다.
6. reviewer에게 manifest와 같은 directory의 JSON/SARIF artifact를 함께 넘긴다.

`manifest.json`의 machine contract는 기존 `checks[]`, `surface`, `command`, `exitCode`, `acceptedNonZero`, `durationMs`, `artifact`, `ruleIds`를 그대로 두고, top-level reviewer identifier인 `runId`, bundle-level replay argv인 `replayCommandArgs`, bundle-level repo-root replay metadata인 `replayWorkingDirectory`, quick coverage metadata인 `evidenceSurfaces`, evidence bundle root인 `evidenceDirectory`, source-of-record manifest locator인 `manifestPath`, required bundle file list인 `requiredArtifacts`, repository source metadata인 `repositoryUrl`, `gitCommitSha`, `gitBranch`, `gitTreeState`, provenance-only `sourceSha256`, `artifactSha256`, 필요 시 `policySha256`를 additive field로 더한다. `replayCommandArgs`는 reviewer/CI가 `replayCommand` prose를 shell-parse하지 않고 `['npm', 'run', 'smoke:ax-demo']` 형태로 전체 evidence bundle 재실행 범위를 확인하기 위한 metadata이며 approval, sandbox, authorization, protected-branch proof가 아니다. `replayWorkingDirectory`는 reviewer가 `npm run smoke:ax-demo`와 row별 `command`를 저장소 루트에서 재실행해야 함을 보여주는 provenance metadata이며 approval, sandbox, authorization, protected-branch proof가 아니다. `manifestPath`는 reviewer가 같은 run의 manifest file 자체를 JSON/SARIF artifact와 함께 식별하기 위한 handoff metadata이며 approval, 보안 서명, 또는 artifact attestation이 아니다. `evidenceSurfaces`는 `checks[]`의 `surface` 순서에서 파생되며 reviewer가 PR diff, MCP config, transcript/log, SARIF evidence coverage를 한눈에 확인하기 위한 metadata다. `gitBranch`는 같은 commit evidence가 `main`, issue branch, detached CI ref 중 어디에서 생성됐는지 reviewer가 구분하기 위한 handoff metadata일 뿐 승인, 배포 안전성, 또는 GitHub protected-branch evidence가 아니다. `gitTreeState`는 smoke 실행 시 tracked source tree가 `clean`인지 `dirty`인지 보여주는 provenance metadata이며, `dirty`는 승인 실패를 자동 의미하지는 않지만 최종 reviewer handoff 전에는 clean tree에서 다시 `npm run smoke:ax-demo`를 실행해야 한다. 각 row는 같은 SHA evidence가 비어 있거나 잘못 잘린 artifact인지 빠르게 확인하도록 `sourceBytes`, `artifactBytes`, 필요 시 `policyBytes`도 함께 제공한다. 이 byte count는 reviewer sanity-check metadata일 뿐 cryptographic proof, GitHub artifact attestation, 또는 보안 서명이 아니다. Top-level `summary`는 `checks[]`에서 파생된 `total`, `pass`, `review`, `block`, `acceptedNonZero` counts를 제공해 reviewer/CI가 row를 다시 계산하지 않고도 evidence bundle의 전체 verdict 분포를 확인하게 한다. 각 row는 사람이 복사하는 `command` 문자열과 별도로 파싱 없이 재실행 범위를 확인하는 `commandArgs`, repo-root replay working directory를 뜻하는 `cwd`를 제공한다.

Top-level `producerIntent` states the bundle is a reviewer source-of-record handoff for rerunnable AX smoke evidence, not approval, automatic upload, certification, scanner parity, or runtime authorization/session enforcement. Use it as a machine-readable boundary before copying the bundle into a PR comment, reviewer note, or demo rehearsal.

Hash-backed replay/freshness for the smoke manifest: treat `.agentguard-demo/ax-evidence-smoke/manifest.json` as fresh only when the reviewer can rerun `npm run smoke:ax-demo`, record the manifest hash plus each referenced JSON/SARIF artifact hash, source fixture hash, and byte-size metadata, and confirm the hashes and byte counts come from the same evidence directory and run. If any fixture, command, build output, manifest row, JSON/SARIF artifact, or `AGENTGUARD_AX_DEMO_EVIDENCE_DIR` changes, freshness expires and the smoke command must be rerun before handoff.

## Manifest check map

| Reviewer surface | Manifest `surface` | Rerunnable command | Fixture path | Artifact path | Expected result |
|---|---|---|---|---|---|
| PR diff | `pr-diff` | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/ax-evidence-smoke/pr-diff-findings.json` | Expected exit: `1`; Expected verdict: `REVIEW`; expected rule IDs include `generic-secret-assignment`, `denied-command`; `acceptedNonZero` is `true`. |
| MCP config | `mcp-config` | `node dist/index.js scan-mcp --json < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json` | `.agentguard-demo/ax-evidence-smoke/mcp-config-findings.json` | Expected exit: `1`; Expected verdict: `BLOCK`; expected rule IDs include `mcp-filesystem-wide-root`, `mcp-filesystem-writable-path`, `mcp-env-token`; `acceptedNonZero` is `true`. |
| transcript/log | `transcript-log` | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` plus `examples/agent-policy.yaml` | `.agentguard-demo/ax-evidence-smoke/transcript-log-findings.json` | Expected exit: `0`; Expected verdict: `REVIEW`; expected rule IDs include `denied-command`; `acceptedNonZero` is `false`. |
| SARIF | `sarif-artifact` | `node dist/index.js scan-diff --sarif --out .agentguard-demo/ax-evidence-smoke/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `.agentguard-demo/ax-evidence-smoke/agentguard.sarif` | Expected exit: `1`; Expected verdict: `REVIEW`; SARIF version stays `2.1.0`; expected result rule IDs include `generic-secret-assignment`, `denied-command`; `acceptedNonZero` is `true`. |

## Reviewer handoff checklist

- PR diff row: compare `pr-diff` manifest row with `.agentguard-demo/ax-evidence-smoke/pr-diff-findings.json`; confirm `exitCode: 1`, `acceptedNonZero: true`, and the expected `ruleIds`.
- MCP config row: compare `mcp-config` manifest row with `.agentguard-demo/ax-evidence-smoke/mcp-config-findings.json`; confirm broad filesystem and env-token rule IDs are present.
- transcript/log row: compare `transcript-log` manifest row with `.agentguard-demo/ax-evidence-smoke/transcript-log-findings.json`; confirm policy-backed `denied-command` evidence remains a reviewer approval item.
- SARIF row: compare `sarif-artifact` manifest row with `.agentguard-demo/ax-evidence-smoke/agentguard.sarif`; confirm SARIF carries the same PR diff finding set for reviewer or CI handoff.
- Manifest row: keep `.agentguard-demo/ax-evidence-smoke/manifest.json` with the artifacts from the same run. Confirm top-level `runId` matches the PR comment/reviewer note when `AGENTGUARD_AX_DEMO_RUN_ID` is supplied, confirm top-level `replayCommandArgs` is `['npm', 'run', 'smoke:ax-demo']`, confirm top-level `replayWorkingDirectory` is `.` for repo-root replay, confirm top-level `evidenceSurfaces` matches `checks[].surface` coverage for PR diff, MCP config, transcript/log, and SARIF, confirm top-level `requiredArtifacts` matches every `checks[].artifact` path in order, confirm top-level `evidenceDirectory` is the source-of-record directory that contains `manifest.json` and all referenced JSON/SARIF artifacts, confirm top-level `repositoryUrl` matches the expected GitHub repository origin for this evidence bundle, confirm top-level `gitTreeState` is `clean` or `dirty`, confirm each row has both human-readable `command` and machine-readable `commandArgs`/`inputPath`, confirm every row has positive `sourceBytes`/`artifactBytes`, and confirm transcript/log rows keep `policyPath` with `policySha256` and `policyBytes`. Do not mix artifacts from a previous build, a different repository origin, or a different `AGENTGUARD_AX_DEMO_EVIDENCE_DIR`.
- Dirty tree provenance row: if `gitTreeState` is `dirty`, treat it as local provenance metadata and rerun `npm run smoke:ax-demo` from a clean tree before final reviewer handoff; do not claim commit-backed final evidence from a dirty manifest alone.
- Hash-backed replay/freshness row: rerun `npm run smoke:ax-demo`, compare the manifest hash plus referenced JSON/SARIF artifact hashes and source fixture hashes, and reject handoff packages that mix directories, builds, or previous runs.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | Borrow: prompt/tool misuse, sensitive information disclosure, and agent risk vocabulary를 reviewer language로 빌린다. | Avoid: OWASP coverage, formal assurance, or full threat-program claim. | AgentGuard action: PR diff, MCP config, transcript/log smoke rows를 current fixture evidence와 approval condition으로 낮춘다. |
| [MCP security best practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) | Borrow: least privilege, token, consent, authorization, and tool-boundary framing을 MCP config review language로 빌린다. | Avoid: MCP conformance, runtime authorization, OAuth/session enforcement, consent UI implementation claim. | AgentGuard action: `mcp-config` manifest row와 `.agentguard-demo/ax-evidence-smoke/mcp-config-findings.json`을 static config evidence로 넘긴다. |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Borrow: SARIF file handoff, code scanning upload workflow, and reviewer artifact vocabulary를 빌린다. | Avoid: GitHub-native integration ownership, security-events workflow ownership, or automatic upload scope claim. | AgentGuard action: `sarif-artifact` manifest row와 `.agentguard-demo/ax-evidence-smoke/agentguard.sarif`를 reviewer-owned upload or archive step의 input으로 둔다. |
| [npm registry `agent-scan`](https://registry.npmjs.org/agent-scan) | Borrow: npmjs web page returned 403 in this environment, so registry JSON public fallback showed a public category-pressure signal for “Detect suspicious AI agents activities on GitHub”; this is not insane-search evidence. | Avoid: scanner parity, replacement, first-mover, adoption, or package-quality claim from registry metadata alone. | AgentGuard action: use the smoke manifest’s PR diff, MCP config, transcript/log, and SARIF rows to show current fixture-backed rollout evidence rather than claiming equivalence with public agent scanners. |

## Machine-contract and non-claim boundaries

- no scanner behavior change: 이 카드는 현재 `scripts/ax-demo-smoke.mjs` output을 설명할 뿐 detector logic을 바꾸지 않는다.
- no CLI command change: `npm run smoke:ax-demo`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log` spelling을 바꾸지 않는다.
- no rule ID change: `generic-secret-assignment`, `denied-command`, `mcp-filesystem-wide-root`, `mcp-filesystem-writable-path`, `mcp-env-token` 이름을 바꾸지 않는다.
- no JSON/SARIF field name change: `checks[]`, `surface`, `command`, `exitCode`, `acceptedNonZero`, `startedAt`, `completedAt`, `durationMs`, `artifact`, `ruleIds`, SARIF `ruleId`는 machine-facing contract다.
- no package publishing change: npm package metadata, files list, scripts, version, release process를 바꾸지 않는다.
- no verdict policy change: `PASS`, `REVIEW`, `BLOCK` 의미와 non-zero handling policy를 바꾸지 않는다.
- no external certification: 외부 감사, 보증, 표준 인증, security badge를 주장하지 않는다.
- no MCP conformance/runtime auth: MCP 적합성, runtime authorization, OAuth/session enforcement, consent UI 구현을 주장하지 않는다.
- no automatic SARIF upload: 이 smoke command는 SARIF artifact를 만들지만 GitHub upload를 자동 수행하지 않는다.
- no real customer/adoption claim: 실제 고객, 운영 배포, 도입 실적, named deployment를 주장하지 않는다.
