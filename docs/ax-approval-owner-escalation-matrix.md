# AX approval owner escalation matrix

한국어 우선 문서다. 이 문서는 AX Rollout Guard 데모에서 unknown company-problem rollout을 받았을 때 AgentGuard evidence verdict를 누가 승인하고, 누가 고치고, 누가 다시 실행해야 하는지 빠르게 나누는 docs-contract다.

## purpose

현장 질문이 "우리 회사 문제에 이걸 어떻게 붙이나요?"로 들어오면 먼저 비즈니스 위험, 보안 위험, 증거 재실행 책임을 분리한다. AgentGuard는 fixture-backed evidence를 보여 주고, owner는 `PASS`, `REVIEW`, `BLOCK` verdict에 따라 승인/보완/재실행을 결정한다.

이 문서는 제품 범위를 넓히지 않는다. scanner behavior, CLI option, policy default, publishing, dashboard, real customer data는 다루지 않는다.

## public reference signals

| Public reference | Borrow | Avoid | AgentGuard use |
| --- | --- | --- | --- |
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | human oversight, mitigation, threat-model framing | OWASP가 AgentGuard를 심사했다는 표현 | `BLOCK`은 사람의 승인 없이 rollout하지 않는 위험 신호로 설명 |
| MCP Security Best Practices: https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | least privilege, consent, control, tool access review | runtime MCP enforcement claim | `scan-mcp` evidence를 security owner의 permission review 입력으로 전달 |
| GitHub SARIF support: https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | `ruleId`, `artifactLocation.uri`, `region.startLine`, artifact handoff field framing | GitHub 보증 또는 제품 기능 비교 표현 | `.agentguard-demo/approval-owner-escalation.sarif`를 reviewer handoff artifact 예시로 사용 |
| Snyk npm public package: https://registry.npmjs.org/snyk | mature CLI, rerunnable evidence, package-distributed command expectation | Snyk와 기능 비교 표현 | AgentGuard CLI evidence도 같은 방식으로 다시 실행 가능한 명령과 artifact를 남긴다고 설명 |
| OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-js/guides/guardrails/ | guardrail input/output check framing, tripwire-before-handoff vocabulary | OpenAI guardrails를 실행한다고 말하지 않는다 | `scan-diff`/`scan-log` evidence를 rollout 전 guardrail checkpoint 질문으로 바꾼다 |
| Anthropic Claude Code security: https://docs.anthropic.com/en/docs/claude-code/security | tool permission review, workspace trust, and human approval boundary framing | Claude Code/Anthropic approval 또는 runtime sandbox 보증 표현 | `scan-mcp`와 transcript evidence를 security owner의 tool permission review 입력으로 전달 |

## verdict-to-owner escalation matrix

| AgentGuard verdict | Business/security meaning | Approval owner | Required action | Rerun condition |
| --- | --- | --- | --- | --- |
| `PASS` | 현재 fixture evidence에서 blocker가 보이지 않음 | business owner + pilot owner | rollout 후보로 승인하되, 실제 회사 데이터/권한은 별도 내부 절차로 확인 | workflow, MCP config, policy, PR diff가 바뀌면 evidence owner가 다시 실행 |
| `REVIEW` | 위험 신호가 있어 사람 검토가 필요함 | security owner | least privilege, consent/control, data exposure를 검토하고 보완 조건 또는 제한 rollout을 결정 | security owner가 보완 조건을 적거나 policy/fixture가 바뀌면 evidence owner가 다시 실행 |
| `BLOCK` | rollout 전에 수정해야 하는 blocker가 있음 | security owner + business owner | rollout 중지, remediation owner 지정, 수정 PR 또는 MCP permission 축소 후 재검사 | remediation owner가 수정 완료를 알리면 evidence owner가 같은 명령을 다시 실행 |
| `ERROR` / `FAIL` | scanner execution failure, malformed input, missing policy file, or build/env error로 evidence가 생성되지 않음 | evidence owner + security owner | 기본값은 `BLOCK`처럼 취급한다. evidence owner가 환경/입력/빌드 문제를 재현하고, security owner가 policy YAML 또는 permission 관련 오류를 검토한다. | 같은 commit/fixture에서 명령이 정상 종료하고 JSON/SARIF artifact가 생성될 때까지 재실행 |

Conflict rule: `BLOCK` 또는 `ERROR`에서 business urgency와 security condition이 충돌하면 security owner가 최종 go/no-go를 보류할 수 있고, business owner는 rollout 지연의 업무 영향을 기록한다.

Static-limit note: static `PASS`는 배포 후보 조건일 뿐 production safety 보증이 아니다. runtime MCP enforcement, feature flag, firewall, rollback은 AgentGuard가 직접 실행하지 않으며 회사의 기존 platform/control-plane owner가 별도로 수행해야 한다.

Owner shorthand:

- business owner: 업무 영향, 고객/직원 커뮤니케이션, rollout go/no-go 책임자
- security owner: 권한, 민감정보, tool access review, residual risk 책임자
- evidence owner: `scan-diff`, `scan-mcp`, `scan-log`, SARIF/JSON artifact 재실행 책임자
- pilot owner: 제한 rollout 일정, rollback, 현장 운영 책임자

## pre-rollout guardrail review checkpoints

이 checkpoint는 AgentGuard가 runtime guardrail, OAuth state validation, MCP enforcement, hosted approval workflow를 새로 수행한다는 뜻이 아니다. 공개 reference에서 빌린 guardrail/security 언어를 현재 fixture-backed evidence command와 owner question으로 연결하는 judge-facing approval checklist다.

| Checkpoint | Owner question | Evidence command | Decision rule |
| --- | --- | --- | --- |
| guardrail input/output check | business owner가 agent-generated PR delta를 업무 rollout 후보로 받을 수 있는가? | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK`이면 rollout 중지, `REVIEW`이면 business owner가 fix/policy 조건을 적고 evidence owner가 재실행 |
| tool permission review | security owner가 MCP/tool permission과 workspace trust boundary를 승인할 수 있는가? | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | broad root, credential passthrough, or risky command surface가 보이면 least-privilege 축소 전까지 `BLOCK` 또는 conditional `REVIEW` |
| least privilege consent review | security owner와 pilot owner가 transcript/log의 승인 필요 행동을 사용자 동의/권한 축소 조건으로 설명할 수 있는가? | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | approval-required operation은 owner, residual risk, rerun trigger가 없으면 rollout 후보로 넘기지 않음 |
| SARIF reviewer handoff | evidence owner가 같은 finding을 reviewer channel artifact로 전달할 수 있는가? | `node dist/index.js scan-diff --sarif --out .agentguard-demo/approval-owner-escalation.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF artifact는 reviewer handoff source-of-record다. 자동 upload, 자동 승인, GitHub 보증을 뜻하지 않음 |

Non-claims: OpenAI guardrails를 실행한다고 말하지 않는다. Claude Code/Anthropic approval을 받은 것처럼 말하지 않는다. MCP runtime authorization, session binding, redirect URI validation, hosted dashboard, customer rollout proof는 이 문서 범위가 아니다.

## fixture-backed evidence commands

모든 명령은 합성 fixture만 사용한다. CLI alias 설명에는 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`를 유지하고, 로컬 검증 명령은 repo build artifact인 `node dist/index.js`를 사용한다.

> [!IMPORTANT]
> 로컬 검증 명령을 실행하기 전에 `npm run build`가 수행되어 `dist/index.js`가 생성되어 있어야 한다. fresh clone에서는 `npm ci && npm run build` 후 아래 명령을 실행한다.

| Surface | Exact command | Expected evidence | Owner question |
| --- | --- | --- | --- |
| risky PR diff | `node dist/index.js scan-diff --json < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | JSON result with English-compatible rule IDs and verdict vocabulary | business owner가 PR delta를 rollout 후보로 받을 수 있는가? |
| risky MCP config | `node dist/index.js scan-mcp --json < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | JSON result showing MCP/tool permission risk | security owner가 permission 축소 또는 제한 실행 조건을 요구하는가? |
| transcript/log | `node dist/index.js scan-log --json --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | JSON result from transcript evidence and policy fixture | evidence owner가 같은 transcript/policy 조합으로 재실행 가능한가? |
| SARIF reviewer handoff | `node dist/index.js scan-diff --sarif --out .agentguard-demo/approval-owner-escalation.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | SARIF file under ignored `.agentguard-demo/` with `ruleId`, `artifactLocation.uri`, and `region.startLine` style fields | reviewer가 artifact를 보고 remediation owner에게 넘길 수 있는가? |

## machine-contract guardrails

- `PASS`, `REVIEW`, `BLOCK`은 영어 machine verdict로 유지한다.
- `scan-diff`, `scan-mcp`, `scan-log`는 CLI/machine command name으로 유지한다.
- `JSON`, `SARIF`, `ruleId`는 artifact contract field로 유지한다.
- 한국어 설명은 사람이 읽는 approval/remediation/rerun 문장에만 쓴다.
- Markdown 문장은 owner escalation을 돕지만 CLI, JSON, SARIF, ruleId field는 그대로 둔다.

## claim guardrails

- public references는 framing source로만 쓴다. vendor 또는 standards body가 AgentGuard를 보증했다는 말을 쓰지 않는다.
- 합성 fixture evidence만 다룬다. 실제 회사 데이터, 실운영 사례, 외부 고객 사례를 암시하지 않는다.
- compliance badge, audit status, standards 인증을 주장하지 않는다.
- GitHub SARIF는 artifact handoff와 reviewer workflow vocabulary를 빌리는 용도다.
- Snyk npm package는 mature CLI와 rerunnable evidence expectation을 빌리는 용도다.
- AgentGuard는 이 문서에서 scanner behavior, runtime MCP control, hosted dashboard, package publishing을 새로 약속하지 않는다.
