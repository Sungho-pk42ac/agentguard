# AX guardrail tripwire evidence card

한국어 우선 evidence card입니다. 본선에서 회사 문제가 바뀌어도, 기업 승인자가 “이 agent workflow를 계속 실행해도 되는가?”를 30초 안에 판단하도록 `tripwire` 신호를 AgentGuard의 재실행 가능한 source-of-record evidence로 연결합니다.

이 문서는 static pre-rollout evidence를 다룹니다. AgentGuard는 OpenAI Agents SDK guardrail runtime, MCP OAuth/session/token enforcement, consent UI, automatic tool interception, GitHub SARIF upload approval workflow를 구현한다고 말하지 않습니다.

## 목적

- 회사 문제를 받은 뒤 agent/tool workflow의 위험 입력을 `PASS` / `REVIEW` / `BLOCK` 승인 언어로 압축합니다.
- OpenAI guardrail/tripwire, MCP authorization boundary, GitHub SARIF handoff, OWASP agentic AI threat framing을 현재 AgentGuard 명령으로 라우팅합니다.
- 심사위원에게 “generic scanner”가 아니라 **기업 배포 전 agent rollout gate**라는 차이를 보여줍니다.
- CLI commands, rule IDs, JSON, SARIF, `ruleId`, `locations` 같은 machine fields는 English machine contract로 유지합니다.

## Tripwire decision table

| Tripwire signal | AgentGuard evidence | Approval decision | Rerun trigger |
|---|---|---|---|
| PR diff에 secret-like token 또는 위험 shell 변경이 추가됨 | `agentguard scan-diff` / `node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK`: secret 제거 또는 policy/fix 없이는 rollout 중지 | 수정 diff를 같은 command로 재실행하고 `generic-secret-assignment` / `denied-command` finding이 사라졌는지 확인 |
| MCP config가 broad filesystem root, writable path, credential passthrough를 노출함 | `agentguard scan-mcp` / `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `REVIEW` 또는 `BLOCK`: MCP owner가 root/path/env scope를 줄이거나 승인 조건을 남김 | MCP config 수정 후 `mcp-filesystem-wide-root`, `mcp-env-token` finding과 verdict를 재확인 |
| Agent transcript/log가 approval-required operation이나 dangerous command를 보여줌 | `agentguard scan-log --policy examples/agent-policy.yaml` | `REVIEW`: 운영자/보안 reviewer가 실행 근거, 사용자 승인, rollback 조건을 확인 | 같은 transcript class의 fixed/replayed log를 다시 scan |
| Reviewer가 GitHub/code-scanning artifact를 요구함 | `agentguard scan-diff --sarif --out ...` | `REVIEW`: SARIF/Markdown evidence를 reviewer channel에 handoff하되 자동 승인이라고 말하지 않음 | 같은 source diff에서 SARIF를 재생성하고 artifact hash 또는 path를 evidence receipt에 기록 |
| Finding이 모두 제거되었거나 허용된 residual risk만 남음 | `PASS` / `REVIEW` / `BLOCK` verdict and report | `PASS` 또는 conditional `REVIEW`: business owner가 residual risk와 rerun trigger를 승인 | company problem, policy, fixture, 또는 diff가 바뀌면 다시 실행 |

## Exact fixture-backed commands

Fresh clone 또는 발표 리허설에서는 먼저 빌드합니다.

```bash
npm ci
npm run build
```

PR diff tripwire:

```bash
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

MCP authorization boundary / token passthrough tripwire:

```bash
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
```

Transcript/log tool-use approval tripwire:

```bash
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

SARIF reviewer handoff artifact:

```bash
node dist/index.js scan-diff --sarif --out .agentguard-demo/guardrail-tripwire/pr-diff.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

Expected semantics:

- risky fixture commands may exit non-zero when verdict is `BLOCK`; that is expected evidence, not smoke failure by itself.
- Markdown/JSON/SARIF reports must redact secret evidence and preserve English-readable `ruleId`, `locations`, severity, `PASS`, `REVIEW`, `BLOCK` contracts.
- The approval sentence must name the next owner/action; it must not claim automatic remediation, automatic SARIF upload, or runtime guardrail enforcement.

## Observed smoke contract

이 표는 발표 리허설이나 fresh-clone 검증에서 “명령이 non-zero로 끝났는데 실패인가?”를 바로 구분하기 위한 source-of-record contract입니다. 위험 fixture가 `REVIEW`/`BLOCK`을 만들면 non-zero exit is expected evidence이며, runner가 멈춘 것이 아니라 rollout gate가 작동한 것입니다.

| Evidence lane | Expected exit | Expected verdict | Source-of-record meaning |
|---|---:|---|---|
| PR diff | `1` | `REVIEW` | `generic-secret-assignment` / `denied-command`가 risky diff를 포착했음을 보여주며, 수정 diff로 재실행해야 합니다. |
| MCP config | `0` | `REVIEW` | `mcp-filesystem-wide-root` / `mcp-env-token`이 broad root와 token passthrough를 승인 검토해야 하는 조건입니다. 더 강한 위험 fixture나 aggregate policy에서는 `BLOCK`으로 승격될 수 있습니다. |
| Transcript/log | `0` | `REVIEW` | `denied-command`가 정책 검토 대상임을 보여주며, 사람 owner가 실행 근거와 rollback 조건을 확인합니다. |
| SARIF artifact | `1` | `REVIEW` | `SARIF 2.1.0` 파일을 생성해 reviewer가 확인할 수 있게 넘기지만, automatic upload 또는 자동 승인을 의미하지 않습니다. |

## Public references: Borrow / Avoid / AgentGuard action

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OpenAI Agents SDK Guardrails — https://openai.github.io/openai-agents-python/guardrails/ | `input guardrails`, `output guardrails`, `tool guardrails`, `tripwire` vocabulary for when a workflow should stop or require review. | OpenAI Agents SDK integration, runtime tool interception, automatic guardrail enforcement, or same-level SDK claims. | Translate tripwire language into static PR/MCP/transcript/SARIF evidence and human `approval decision` rows. |
| MCP Authorization spec — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | authorization, session, token, and resource-boundary questions for MCP owners. | Runtime OAuth/session/token validation, consent UI, authorization server, or MCP spec-coverage claims. | Route broad filesystem and env-token findings to MCP owner questions using `scan-mcp` source-of-record output. |
| GitHub SARIF support — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF field and code-scanning artifact vocabulary that reviewers already understand. | Saying AgentGuard replaces CodeQL/GitHub code scanning or guarantees native approval. | Preserve SARIF machine contracts such as `ruleId` and `locations` while explaining the human approval boundary in Korean. |
| GitHub SARIF upload — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | Reviewer-facing handoff pattern for generated SARIF artifacts. | Automatic upload, external approval, or branch-protection enforcement claims in this docs slice. | Provide an exact `--sarif --out` command that creates the artifact path the reviewer can inspect. |
| OWASP Agentic AI threats — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | Agentic AI threat framing around tool misuse, data exposure, and workflow control. | OWASP endorsement, official validation, broad all-risk security-suite wording, or all-threat coverage claims. | Use threat language to explain why PR diff + MCP config + transcript/log must be checked before rollout. |

## Machine contracts

Keep these strings and concepts English-readable for CI, shell, JSON, SARIF, and global security tooling:

- `agentguard scan-diff`
- `agentguard scan-mcp`
- `agentguard scan-log`
- `--policy`
- `--sarif`
- `--out`
- `PASS`
- `REVIEW`
- `BLOCK`
- `generic-secret-assignment`
- `denied-command`
- `mcp-filesystem-wide-root`
- `mcp-env-token`
- `JSON`
- `SARIF`
- `ruleId`
- `locations`

한국어로 바꾸는 것은 business approval sentence, operator 설명, reviewer handoff 문장입니다. CLI flags, rule IDs, SARIF/API fields, package metadata는 바꾸지 않습니다.

## Non-claim guardrails

- no customer/adoption claim: synthetic fixtures만 사용하며 실제 고객사 도입, active users, production case study를 주장하지 않습니다.
- no certification claim: SOC 2, ISO 27001, OWASP/MCP/GitHub/OpenAI 공식 인증이나 검증 완료를 주장하지 않습니다.
- no parity/replacement claim: Snyk, CodeQL, GitHub code scanning, OpenAI Agents SDK, OWASP, MCP, public tools를 대체하거나 동등하다고 말하지 않습니다.
- no runtime enforcement claim: runtime guardrail, tripwire, OAuth, authorization, session, consent, token, or tool interception enforcement는 이 문서의 구현 범위가 아닙니다.
- no automatic upload/remediation claim: SARIF generation은 artifact handoff이며 automatic upload, automatic approval, or automatic remediation이 아닙니다.
