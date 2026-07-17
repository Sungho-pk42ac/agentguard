# AX release attestation receipt

## 사용 목적

이 문서는 AX Rollout Guard를 팀 파일럿, 심사자 데모, 또는 보안 reviewer에게 넘기기 직전에 남기는 한국어 우선 **release attestation receipt**입니다. 핵심은 에이전트의 자기보고나 터미널 스크린샷이 아니라, 현재 저장소에서 다시 실행 가능한 source-of-record command, 입력 fixture, expected verdict, SARIF/Markdown artifact, hash, approver, rerun trigger를 한 줄 receipt로 고정하는 것입니다.

이 receipt는 scanner behavior, CLI commands, rule IDs, verdict names, severity defaults, JSON fields, SARIF fields, API, policy behavior를 바꾸지 않습니다. `PASS` / `REVIEW` / `BLOCK` machine contract는 English-compatible로 유지합니다.

## Release receipt checklist

| Receipt field | What to write | Required source-of-record |
| --- | --- | --- |
| Company problem | unknown company problem을 한 문장으로 적습니다. | 발표/심사자가 준 문제 statement 또는 현장 intake note |
| Surface | PR diff, MCP config, transcript/log, SARIF handoff 중 하나를 고릅니다. | 아래 exact fixture-backed evidence commands |
| Command | 복사/재실행 가능한 `node dist/index.js ...` 명령을 그대로 붙입니다. | fresh clone에서 `npm ci && npm run build` 후 실행 |
| Expected verdict | `PASS`, `REVIEW`, `BLOCK` 중 기대 verdict를 적습니다. | CLI/JSON/SARIF output |
| Artifact/hash | Markdown/SARIF/JSON artifact path와 `sha256sum` 값을 붙입니다. | `.agentguard-demo/...` 아래 생성 artifact |
| Approval owner | security reviewer, business owner, CI owner, rollout lead 중 책임자를 고릅니다. | 조직의 실제 승인자 또는 데모 역할 |
| Rerun trigger | source fixture, policy, package-lock, CLI version, workflow, reviewer channel이 바뀌면 재실행합니다. | git SHA + artifact SHA |

## Exact fixture-backed evidence commands

PR diff risk를 Markdown/terminal report로 확인합니다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
```

Expected exit: `1`; Expected verdict: `BLOCK`; Fixture: `examples/risky-pr.diff`; Reviewer note: critical secret-shaped diff material blocks rollout until removed/rotated; risky shell material also needs explicit approval or safer scope.

MCP config risk를 승인 질문으로 바꿉니다.

```bash
node dist/index.js scan-mcp < examples/risky-mcp.json
```

Expected exit: `1`; Expected verdict: `BLOCK`; Fixture: `examples/risky-mcp.json`; Reviewer note: broad filesystem access and credential passthrough become least-privilege / explicit-user-consent / token-boundary approval questions.

Transcript/log risk를 policy와 함께 확인합니다.

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
```

Expected exit: `0`; Expected verdict: `REVIEW`; Fixture: `examples/agent-transcript.log`; Reviewer note: approval-required operations stay human-owned; current CLI exit semantics allow non-critical `REVIEW` findings to exit `0`, so the receipt must preserve the observed verdict and owner decision.

SARIF handoff artifact를 생성합니다.

```bash
mkdir -p .agentguard-demo/release-attestation && node dist/index.js scan-diff --sarif --out .agentguard-demo/release-attestation/agentguard.sarif < examples/risky-pr.diff
```

Expected exit: `1`; Expected artifact: `.agentguard-demo/release-attestation/agentguard.sarif`; Expected SARIF shape: `version: 2.1.0`, `runs[]`, `tool.driver.rules[]`, `results[]`, `ruleId`, `locations`.

Artifact hash를 receipt에 붙입니다.

```bash
sha256sum .agentguard-demo/release-attestation/agentguard.sarif
```

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | least privilege, explicit user consent, token audience / token-boundary questions | live OAuth/session control, runtime MCP consent UI, token enforcement claim | `scan-mcp` output을 approval question과 rerun trigger로 연결합니다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF artifact and reviewer handoff vocabulary | automatic SARIF upload, automatic GitHub triage, code-scanning approval, GitHub-native product parity | `scan-diff --sarif --out` artifact와 owner-operated upload/handoff를 분리합니다. |
| https://docs.snyk.io/developer-tools/snyk-cli/commands/monitor | recurring snapshot / monitored evidence mindset | hosted continuous monitoring, Snyk service parity, external assurance claim | current local/static AgentGuard result에 timestamp, git SHA, artifact hash, owner, rerun trigger를 붙입니다. |
| https://owasp.org/www-project-top-10-for-large-language-model-applications/ | LLM/agent risk vocabulary for prompt/tool/data exposure | OWASP certification, complete coverage, security-program replacement | PR diff, MCP config, transcript/log, SARIF source-of-record commands로만 risk story를 증명합니다. |

## Approval owner map

| Finding/verdict | Owner | Approval condition | Rerun trigger |
| --- | --- | --- | --- |
| `BLOCK` secret or broad MCP root | security reviewer | secret removed, root narrowed, or deployment blocked | source fixture, policy, scanner version, MCP server permission changes |
| `REVIEW` risky shell/transcript operation | rollout lead + business owner | operation reason, rollback owner, and manual approval path documented | transcript/log, workflow, or approval owner changes |
| SARIF artifact handoff | CI/security reviewer | SARIF artifact path/hash is attached and generated from same git SHA | SARIF workflow, artifact path, rule output, or reviewer channel changes |
| `PASS` after fix/policy | rollout lead | fixed fixture and risky fixture are both shown as before/after evidence | policy/fix diff, package-lock, build, or source-of-record command changes |

## Receipt template

```text
Company problem: <unknown company problem / team workflow>
Git SHA: <git rev-parse HEAD>
Surface: PR diff | MCP config | transcript/log | SARIF handoff
Command: <exact command copied from this card>
Input fixture: <path>
Expected verdict: PASS | REVIEW | BLOCK
Observed artifact: <Markdown/JSON/SARIF path or stdout capture>
Artifact sha256: <sha256sum output>
Approval owner: security reviewer | business owner | CI owner | rollout lead
Approval condition: <fix/policy/residual-risk condition>
Residual risk: <what AgentGuard does not prove>
Rerun trigger: <source/policy/package/workflow/reviewer change>
```

## Machine-contract and non-claim boundaries

- CLI commands, command flags, rule IDs, severity names, verdict values, JSON, SARIF, API, and package metadata stay English-compatible.
- This receipt does not claim hosted monitoring, runtime OAuth enforcement, live MCP consent enforcement, automatic SARIF upload, automatic triage, Snyk/GitHub/OWASP parity, certification, endorsement, adoption, or customer proof.
- Public references are direction and vocabulary, not implementation proof.
- AgentGuard evidence here is static/local source-of-record evidence from synthetic fixtures unless a human explicitly attaches a real approved company artifact.
- If a reviewer asks for source-of-record proof, rerun the command from a fresh clone/build and attach command output plus artifact hash instead of relying on agent self-report.
