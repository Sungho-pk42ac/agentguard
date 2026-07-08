# AX 6-hour onsite execution board

이 문서는 AX 현장에서 처음 받은 회사 문제를 6시간 안에 AgentGuard의 기존 evidence로 연결하기 위한 한국어 우선 execution board입니다. 새 scanner behavior를 만들지 않고, 현재 저장소의 synthetic fixture와 CLI commands만 사용합니다.

목표는 `intake -> evidence selection -> scan commands -> fix or policy rerun -> SARIF and Markdown handoff -> Judge story`를 한 장에서 움직이는 것입니다. 설명은 한국어 우선이지만 `PASS`, `REVIEW`, `BLOCK`, CLI commands, rule IDs, JSON, SARIF, API, machine fields는 English-compatible contract로 유지합니다.

## 0-1h Intake

회사 문제를 한 문장으로 줄입니다: "어떤 업무 agent가 어떤 data, tool, repository change를 만지고, 실패하면 어떤 업무 영향이 나는가?"

| Intake question | 기록할 답 |
|---|---|
| Business workflow | 예: VOC 요약, 환불 승인 초안, recruiting shortlist, finance audit packet |
| Agent/tool surface | `PR diff`, `MCP config`, `agent transcript/log`, `SARIF artifact` 중 어디에 증거가 남는지 |
| Risk language | tool misuse, excessive agency, secret exposure, unsafe shell behavior, reviewer handoff |
| Stop condition | gated scoring rule, private company data, 실제 운영 증거가 필요하면 새 claim을 만들지 않고 질문으로 남긴다 |

이 시간의 산출물은 "이 문제는 AgentGuard가 현재 보여줄 수 있는 surface와 그렇지 않은 surface를 분리했다"는 메모입니다.

## 1-2h Evidence selection

아래 표에서 가장 가까운 existing fixture-backed evidence를 고릅니다.

| Company problem signal | AgentGuard surface | Existing path | Expected verdict | Judge-safe use |
|---|---|---|---|---|
| agent-generated PR에 secret-like 값이나 위험 shell material이 들어간다 | `PR diff` | `examples/risky-pr.diff` | `BLOCK` | rollout 전에 stop할 근거로 설명한다 |
| MCP server가 broad filesystem root, writable path, credential passthrough를 노출한다 | `MCP config` | `examples/risky-mcp.json` | `BLOCK` or `REVIEW` | permission/consent/token risk를 승인 경계로 낮춘다 |
| transcript/log에 승인 없는 shell behavior가 남는다 | `agent transcript/log` | `examples/agent-transcript.log` + `examples/agent-policy.yaml` | `REVIEW` | 사람이 확인할 reviewer gate로 설명한다 |
| security reviewer가 machine-readable handoff를 요구한다 | `SARIF artifact` | `examples/agentguard.sarif` | `BLOCK` finding artifact | GitHub-style reviewer handoff로 보존한다 |

## 2-3h Scan commands

Fresh clone에서는 먼저 `npm run build`를 실행한 뒤 아래 commands를 그대로 재현합니다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있습니다. 아래 stdin redirection 예시는 POSIX shell(Bash/Zsh) 기준입니다. PowerShell에서는 `Get-Content examples/risky-pr.diff | node dist/index.js scan-diff`처럼 pipe로 바꿔 실행합니다.

| Surface | Exact command | Expected evidence |
|---|---|---|
| PR diff risk | `node dist/index.js scan-diff < examples/risky-pr.diff` | Expected verdict: `BLOCK`; rollout을 멈추거나 차단할 secret-like PR material 또는 risky shell finding을 보여준다. |
| MCP config risk | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Expected verdict: `BLOCK` or `REVIEW`; broad filesystem access, writable root, credential passthrough를 보여준다. |
| transcript/log risk | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Expected verdict: `REVIEW`; 사람 검토와 승인자 질문으로 넘길 shell behavior를 보여준다. |
| SARIF handoff | `mkdir -p .agentguard-demo && node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | Expected artifact: `.agentguard-demo/agentguard.sarif`; reviewer가 rule/result/location 형태로 읽을 수 있는 SARIF output을 재생성한다. Checked-in sample은 `examples/agentguard.sarif`로만 가리킨다. |

## 3-4h Fix or policy rerun

이 문서의 범위는 scanner behavior 변경이 아니라 현장 실행 board입니다. 따라서 fix는 실제 product code edit이 아니라 발표 중 승인 조건으로 표현합니다.

| Verdict | 현장 의사결정 | Rerun 조건 |
|---|---|---|
| `BLOCK` | 배포나 rollout을 stop한다. secret-like diff, broad write path, credential passthrough를 제거한 뒤 같은 command를 다시 실행한다. | finding이 사라져 `PASS`가 되거나, 남은 finding을 정책 exception으로 문서화한다. |
| `REVIEW` | reviewer가 사람 승인, 제한 rollout, 추가 policy를 결정한다. | `examples/agent-policy.yaml` 같은 policy boundary를 조정하거나 transcript/log behavior를 줄인 뒤 다시 실행한다. |
| `PASS` | 현재 fixture에서는 차단 finding이 없는 후보로 설명한다. | PASS는 production approval이 아니라 "이 fixture command에서 위험 finding이 없는 상태"라고 말한다. |

## 4-5h SARIF and Markdown handoff

현장 handoff는 두 갈래로 고정합니다.

| Handoff target | Artifact language | What to show |
|---|---|---|
| Business judge | Korean Markdown summary | problem sentence, chosen surface, command, `PASS`/`REVIEW`/`BLOCK`, approval condition |
| Security reviewer | JSON/SARIF machine fields | `.agentguard-demo/agentguard.sarif`, `examples/agentguard.sarif`, rule IDs, result locations, command provenance |
| Operator | CLI rerun note | exact command, fixture path, expected verdict, what changed before rerun |

Markdown 설명은 한국어로 해도 됩니다. 단, CLI commands, rule IDs, JSON, SARIF, API, machine fields는 literal value로 둡니다.

## 5-6h Judge story

30초 story는 아래 순서로 말합니다.

1. "회사 문제는 agent가 `PR diff`, `MCP config`, `agent transcript/log` surface를 남기는 rollout risk입니다."
2. "AgentGuard는 새 runtime enforcement를 주장하지 않고, 현재 fixture-backed command로 evidence를 보여줍니다."
3. "`BLOCK`은 rollout stop, `REVIEW`는 사람 승인, `PASS`는 이 fixture command에서 위험 finding이 없는 상태입니다."
4. "SARIF와 Markdown으로 reviewer handoff를 남기고, public reference는 vocabulary와 artifact framing만 빌립니다."

## Public reference borrow/avoid/action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| AX landing page — https://hackathon.jocodingax.ai/ | company problem과 visible output 중심 framing을 빌린다. | gated scoring detail, final problem knowledge, hidden rubric claim. | 6시간 board를 problem-first execution flow로 둔다. |
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, mitigation vocabulary를 빌린다. | OWASP coverage, assurance, or product endorsement claim. | MCP/transcript/log findings를 approval boundary language로 설명한다. |
| OWASP Top 10 for LLM Applications 2025 — https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/ | prompt/tool/data risk vocabulary를 빌린다. | complete LLM security coverage claim. | PR diff, MCP, transcript/log evidence에 맞는 risk words만 사용한다. |
| MCP Authorization — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | authorization, permission, consent, token handling language를 빌린다. | MCP runtime enforcement, OAuth control, or standards compliance claim. | `scan-mcp` evidence를 consent/token review checkpoint로 둔다. |
| MCP security best practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | least privilege and credential exposure framing을 빌린다. | MCP standards-equivalence or security program claim. | broad filesystem and credential passthrough findings를 rerun condition으로 둔다. |
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF artifact upload and reviewer handoff pattern을 빌린다. | automatic triage, GitHub product parity, or substitute claim. | `examples/agentguard.sarif`를 machine-readable handoff sample로 가리킨다. |

## Machine-contract boundaries

- CLI commands: `scan-diff`, `scan-mcp`, `scan-log`, `doctor` names stay English-compatible.
- rule IDs: examples stay English-compatible, such as `secret.github_token`, `mcp.broad_filesystem_access`, `agent.dangerous_shell`.
- Verdicts: `PASS`, `REVIEW`, `BLOCK` stay unchanged for scripts and reviewers.
- JSON, SARIF, API, machine fields: field names stay English-compatible for CI, GitHub code scanning, and parsers.
- Fixture/sample paths: `examples/risky-pr.diff`, `examples/risky-mcp.json`, `examples/agent-policy.yaml`, `examples/agent-transcript.log`, `examples/agentguard.sarif` stay literal; regenerated SARIF output goes under ignored `.agentguard-demo/`.

## Non-claim guardrails

- No fake adoption.
- No customer claim.
- No certification claim.
- No gated scoring claim.
- No claim that AgentGuard replaces OWASP guidance, MCP authorization, GitHub code scanning, SAST, or a broad AI security suite.
- No claim that synthetic fixtures are live production evidence.
- No presentation-only change to CLI commands, rule IDs, JSON, SARIF, API, or machine fields.
