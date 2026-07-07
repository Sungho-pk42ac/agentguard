# AX agent permission review packet

한국어 우선으로 기업 보안 담당자와 승인권자가 AI agent 권한을 30초 안에 검토할 수 있게 만드는 정적 handoff packet입니다.
CLI commands, rule IDs, JSON, SARIF, API machine fields stay English-compatible.

## 사용 목적

AgentGuard를 AX Rollout Guard 예선/대상권 관점에서 설명할 때, "agent가 무엇을 읽고, 무엇을 실행하고, 무엇을 내보낼 수 있는지"를 회사 문제와 승인 조건으로 바로 연결합니다.
이 packet은 현재 저장소 fixture와 현재 CLI surface만 사용합니다. CLI behavior, default severity, rule IDs, SARIF schema, JSON/API fields, product naming stay unchanged.

Fresh clone에서는 먼저 `npm ci && npm run build`를 실행한 뒤 아래 `node dist/index.js ...` commands를 그대로 재현합니다. npm/global 설치 환경에서는 같은 subcommands를 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 실행할 수 있습니다.

## 30초 permission review flow

1. Company problem: 커머스 VOC agent가 PR diff, MCP config, transcript/log를 통해 고객 데이터 처리, 파일 접근, shell 실행, 외부 export를 남길 수 있습니다.
2. Permission question: reviewer는 `read`, `execute`, `export` 권한을 분리해서 "업무 범위에 필요한가, 최소권한인가, 사람 승인이 필요한가"를 묻습니다.
3. Evidence command: 아래 exact AgentGuard command를 실행하고 fixture-backed report 또는 SARIF artifact를 확인합니다.
4. Expected verdict: `BLOCK`은 rollout 중지와 수정, `REVIEW`는 명시적 잔여위험 승인, `PASS`는 현재 evidence 기준 다음 gate 진행입니다.
5. Approval condition: 수정 후 같은 command를 다시 실행해 verdict와 조치 조건을 한 줄로 남깁니다.

## Company problem → permission surface → command → verdict → approval condition

| Company problem | Agent permission surface | Exact AgentGuard command | Expected verdict | Approval condition |
|---|---|---|---|---|
| PR diff가 agent-visible token, risky shell, 외부 artifact export를 추가한다. | PR diff에서 `read` 가능한 secret-like material, `execute` 가능한 shell command, `export` artifact handoff. | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `REVIEW` with expected nonzero exit and SARIF error-level results | secret-like material과 위험한 command를 제거하고, SARIF `ruleId`, `result`, `location`, `artifact` handoff를 reviewer가 확인한 뒤 재스캔한다. |
| MCP config가 broad filesystem root, writable path, credential passthrough를 노출한다. | MCP config의 `read` 범위, write-capable tool access, inherited token/secret environment. | `node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `REVIEW` | filesystem root를 업무 전용 read-only path로 줄이고 credential passthrough를 제거하거나 최소권한 token으로 바꾼 뒤 `PASS` 또는 명시적 `REVIEW`를 받는다. |
| transcript/log가 승인 없는 export, 삭제성 shell, 배포성 작업을 남긴다. | transcript/log의 `execute` history, approval-required operation, exported file path evidence. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | `REVIEW` | `denied-command`와 `approval-required` finding을 담당자가 검토하고, 미승인 작업은 rollback 또는 policy update 후 재실행한다. |

## Public reference borrow / avoid / action notes

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| OWASP Agentic AI threats and mitigations — https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, mitigation vocabulary로 agent 권한 질문을 설명한다. | OWASP endorsement, full threat coverage, external assurance처럼 말하지 않는다. | PR diff, MCP config, transcript/log evidence를 `read`, `execute`, `export` permission review로 좁힌다. |
| MCP security best practices — https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | least privilege, token passthrough, confused deputy/SSRF-style risk framing을 빌린다. | MCP spec-compatibility, runtime authorization, consent UI, OAuth/session control claim을 하지 않는다. | `agentguard scan-mcp`로 broad filesystem access와 credential passthrough를 rollout approval condition에 연결한다. |
| GitHub SARIF code scanning — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | `ruleId`, `result`, `location`, `artifact` 중심의 reviewer-readable handoff를 빌린다. | SARIF가 사람 approval을 대체한다거나 GitHub native app/product parity가 있다고 말하지 않는다. | `agentguard scan-diff --sarif --out agentguard.sarif` artifact를 PR reviewer handoff로 남긴다. |
| Snyk agent-scan — https://github.com/snyk/agent-scan | AI-agent, MCP, workflow scanner category clarity를 빌린다. | vendor-scale parity, customer adoption, market leadership claim을 하지 않는다. | AgentGuard 범위를 Korean-first PR diff + MCP config + transcript/log rollout evidence로 설명한다. |
| Tencent AI-Infra-Guard — https://github.com/Tencent/AI-Infra-Guard | AI infra guardrail category clarity를 빌린다. | 전체 AI infra security suite나 platform coverage처럼 말하지 않는다. | 현재 fixture-backed command와 approval condition만 보여준다. |
| splx-ai agentic-radar — https://github.com/splx-ai/agentic-radar | agentic workflow attack-surface category clarity를 빌린다. | runtime monitoring, attack simulation, vendor replacement claim을 하지 않는다. | deterministic scanner evidence를 rollout permission review packet으로 한정한다. |

## English-compatible machine contracts

한국어 설명은 reviewer presentation layer입니다. 아래 machine-facing 계약은 영어 그대로 유지합니다.

- CLI commands: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `node dist/index.js scan-diff`, `node dist/index.js scan-mcp`, `node dist/index.js scan-log`
- Rule IDs and finding IDs: `secret.github_token`, `github-token`, `mcp.broad_filesystem_access`, `denied-command`, `approval-required`
- Verdicts: `BLOCK`, `REVIEW`, `PASS`
- SARIF fields and concepts: `SARIF`, `ruleId`, `result`, `location`, `artifact`, `agentguard.sarif`
- Machine contracts: `JSON`, `API`, CLI flags, fixture paths, and SARIF fields stay English-compatible.

## Non-claim guardrails

- No real secrets, customer data, customer logo, named buyer, rollout-finished, or adoption claim.
- No external audit badge, standards badge, spec-compatibility badge, or formal assurance claim.
- No statement that AgentGuard replaces OWASP guidance, MCP authorization, GitHub code scanning, SAST, or a broad AI security platform.
- No product rename and no alteration to CLI commands, rule IDs, JSON, SARIF, API, package metadata, default severity, or blocking policy.
- Synthetic fixtures remain synthetic and fixture-backed: `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff`, `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json`, `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log`, and `examples/agent-policy.yaml`.
