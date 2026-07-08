# AX final submission smoke checklist

한국어 우선 최종 제출 직전 smoke checklist입니다. 목적은 심사자가 볼 수 있는 한 줄 개선을 과장 없이 보여주는 것입니다: 회사 문제를 정하고, 저장소 fixture로 AgentGuard를 다시 실행하고, `PASS` / `REVIEW` / `BLOCK` 판정과 report artifact를 제출 패키지에 붙입니다.

범위는 로컬 정적 smoke입니다. AgentGuard가 전체 런타임 관찰 도구라고 말하지 않습니다. GitHub code scanning이나 SARIF 업로드 문서는 reviewer-visible artifact handoff 언어를 빌리는 참고자료이며, 이 로컬 smoke는 산출물을 외부 서비스로 전송하지 않습니다. CLI commands, rule IDs, JSON/SARIF, machine contracts는 English-compatible 계약으로 유지합니다.

## 10-minute final smoke path

0. Fresh clone 또는 새 CI workspace라면 먼저 `npm ci && npm run build`로 `dist/index.js`를 만듭니다.
1. 회사 문제 한 줄을 먼저 고릅니다.
   - 예: "커머스 VOC 에이전트가 고객 로그와 MCP filesystem tool을 보면서 PR을 만들 때, 비밀 값과 과도한 파일 접근을 제출 전에 막아야 한다."
   - 제출 문구는 "합성 fixture로 재현한 AX Rollout Guard smoke"라고 씁니다.
2. PR diff surface를 확인합니다.

   ```bash
   node dist/index.js scan-diff < examples/risky-pr.diff
   ```

3. MCP config surface를 확인합니다.

   ```bash
   node dist/index.js scan-mcp < examples/risky-mcp.json
   ```

4. transcript/log surface를 policy와 함께 확인합니다.

   ```bash
   node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
   ```

5. SARIF/report artifact surface를 만듭니다.

   ```bash
   node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff
   ```

6. 최종 제출 패키지에는 명령, verdict, artifact path, 한 줄 승인 조건만 남깁니다.
   - 예: "`BLOCK`이면 merge 전 secret 제거 또는 MCP root 축소가 필요하다."
   - 예: "`REVIEW`이면 담당자가 residual risk를 승인해야 한다."
   - 예: "`PASS`이면 현재 합성 fixture 기준 추가 finding이 없다."

PowerShell 환경에서 `<` 리다이렉트가 맞지 않으면 같은 surface를 파이프로 실행합니다: `Get-Content examples/risky-pr.diff -Raw | node dist/index.js scan-diff`.

## Surface checks

| Surface | Exact command | Existing fixture | Operator check |
| --- | --- | --- | --- |
| PR diff | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` | 새 secret-like material, PII, unsafe shell fragment가 judge-visible finding으로 나오는지 본다. |
| MCP config | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` | broad filesystem root, writable path, credential passthrough가 `BLOCK` 또는 `REVIEW`로 설명되는지 본다. |
| transcript/log | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`, `examples/agent-transcript.log` | agent shell action이 policy 조건과 함께 설명되는지 본다. |
| SARIF/report artifact | `node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/risky-pr.diff` | `examples/risky-pr.diff` | `agentguard.sarif`가 reviewer handoff용 machine artifact로 생성되는지 본다. |

## Expected verdicts and artifacts

- `BLOCK`: critical secret, full-access MCP, or high aggregate risk. 제출 문구는 "merge 전 수정 또는 정책 예외 승인이 필요하다"로 씁니다.
- `REVIEW`: 사람이 residual risk를 검토해야 하는 finding. 제출 문구는 "자동 차단이 아니라 담당자 검토 조건"으로 씁니다.
- `PASS`: 현재 입력에서 AgentGuard finding이 없습니다. 제출 문구는 "이 fixture 기준"으로 제한합니다.
- SARIF/report artifact: `agentguard.sarif` 또는 Markdown/terminal report를 제출 패키지에 붙입니다. GitHub SARIF upload 문서는 code-scanning artifact handoff 표현을 참고하는 자료입니다.
- English-compatible machine contracts: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `secret.github_token`, `mcp.broad_filesystem_access`, `JSON`, `SARIF`, `rule IDs`.

## Judge wording guardrails

| Public reference | Borrow | Avoid | AgentGuard wording |
| --- | --- | --- | --- |
| [OWASP Agentic AI threats/mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Agent/tool misuse, excessive permission, and mitigation framing. | Do not claim live production observation or complete coverage of every OWASP category. | "AgentGuard checks local agent-visible diff, MCP config, and transcript/log evidence before submission." |
| [GitHub SARIF upload docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) | Reviewer-visible artifact and code-scanning handoff language. | Do not claim this local smoke sends artifacts to GitHub by itself. | "AgentGuard can emit a SARIF/report artifact that a reviewer can attach or route into an existing workflow." |
| [Snyk agent-scan](https://github.com/snyk/agent-scan) | AI-agent security category clarity. | Do not claim the same product scope. | "AgentGuard is a small local Korean-first smoke scanner for PR diff, MCP config, and agent logs." |
| [splx-ai agentic-radar](https://github.com/splx-ai/agentic-radar) | Agentic security category naming and MCP awareness. | Do not claim same feature breadth. | "AgentGuard keeps final submission evidence compact and fixture-backed." |
| [Tencent AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard) | AI infrastructure security category clarity. | Do not claim infrastructure-platform breadth. | "AgentGuard focuses on local pre-submission evidence, not enterprise infrastructure governance." |

Unsupported final-submission wording categories to avoid:

- Customer-proof language unless the evidence packet contains real, approved customer material.
- Third-party audit badge language unless the project has the matching audit artifact.
- Same-scope vendor comparison language against public agent-security tools.
- Hidden judge-rule certainty or private portal scoring certainty.
- Claims beyond local static smoke evidence.
