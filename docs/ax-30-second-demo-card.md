# AX 30-second demo command card

이 카드는 AX Rollout Guard를 심사장에서 30초 안에 설명하고 실행하기 위한 한국어 우선 command card입니다. 목적은 **회사 문제 → agent/tool surface → evidence verdict → 업무 승인 게이트**를 한 화면에서 보여주는 것입니다. 모든 입력은 현재 저장소의 합성 fixture만 사용합니다.

## 30초 command card

| Surface | 회사 문제 연결 | exact command | Expected verdict | 업무 승인 문장 |
|---|---|---|---|---|
| PR diff | AX 에이전트가 코드 변경에 secret-like 값이나 위험한 shell material을 추가하면 출시 전 PR 승인에서 멈춰야 한다. | `node dist/index.js scan-diff < examples/risky-pr.diff` | Expected verdict: `BLOCK` | 업무 승인 문장: "PR diff에서 agent rollout 위험이 `BLOCK`으로 확인됐으므로, secret-like material 제거 전에는 배포 승인하지 않습니다." |
| MCP config | MCP filesystem 권한이 넓거나 writable이면 에이전트가 업무 자료와 로컬 파일에 과도하게 접근할 수 있다. | `node dist/index.js scan-mcp < examples/risky-mcp.json` | Expected verdict: `BLOCK` | 업무 승인 문장: "MCP config가 넓은 root와 write-capable 권한을 노출하므로, root 축소와 read-only 전환 전에는 운영 연결을 승인하지 않습니다." |
| transcript/log | 에이전트 transcript/log에 승인 없는 export, 민감 경로 접근, 삭제성 명령이 보이면 사람 승인 조건으로 낮춰야 한다. | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Expected verdict: `REVIEW` | 업무 승인 문장: "transcript/log의 tool misuse 가능성이 `REVIEW`로 남아 있으므로, 정책 승인자 확인 후 제한된 rollout만 허용합니다." |

발표장에서 build 결과와 직접 연결하려면 먼저 `npm run build`를 실행합니다. 위 명령은 POSIX shell(Bash, zsh, Git Bash) 기준의 stdin redirection 예시입니다. CLI가 전역 설치된 환경에서는 같은 입력을 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 바꿔 실행할 수 있습니다.

## Reviewer smoke command

Fresh clone에서 심사자가 한 번에 재현하려면 아래 명령을 실행합니다.

```sh
npm ci
npm run build
npm run smoke:ax-demo
```

이 smoke command는 built CLI인 `node dist/index.js`만 호출하며, PR diff, MCP config, transcript/log JSON evidence와 `agentguard.sarif`, `.agentguard-demo/ax-evidence-smoke/manifest.json`을 `.agentguard-demo/ax-evidence-smoke/` 디렉터리에 남깁니다. 위험 fixture에서 `scan-diff` 또는 `scan-mcp`가 non-zero로 끝나는 것은 expected result일 때만 허용하며, wrapper가 expected rule IDs와 SARIF shape를 확인한 뒤 최종 exit 0을 반환합니다.

## Public confirmed facts

| Reference | 빌릴 점 / Borrow | 피할 점 / Avoid |
|---|---|---|
| https://hackathon.jocodingax.ai/ | 실제 기업 문제를 빠르게 이해시키고, 현업 통과 여부와 성과 증명 중심으로 설명한다. | 비공개 평가표나 gated portal 제출 형식을 확인한 것처럼 말하지 않는다. |
| https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | tool misuse, excessive agency, approval boundary 언어를 빌려 agent rollout 위험을 승인 게이트로 낮춘다고 설명한다. | OWASP 보증이나 완전 대응을 주장하지 않는다. |
| https://github.com/snyk/agent-scan | agent, MCP, skills component scanning category와 inventory framing을 참고한다. | Snyk enterprise platform과 같은 범위라고 말하지 않는다. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF를 developer-facing code scanning evidence handoff로 설명한다. | GitHub native security 기능을 대체한다고 말하지 않는다. |

## Current repo evidence

- `examples/risky-pr.diff`: PR diff surface를 fixture-backed command로 보여준다.
- `examples/risky-mcp.json`: MCP config surface를 fixture-backed command로 보여준다.
- `examples/agent-transcript.log`: transcript/log surface를 fixture-backed command로 보여준다.
- `examples/agent-policy.yaml`: transcript/log command의 approval boundary를 fixture 정책으로 보여준다.
- `docs/github-action.md`와 README의 SARIF workflow는 CI/security-tool friendly evidence handoff를 설명한다.

## Gated unknowns

- 본선 현장 회사 문제, 실제 업무 데이터, 승인권자, 제출 portal 세부 형식은 이 저장소에서 확인하지 않는다.
- 30초 데모는 현재 fixture에 맞춘 evidence verdict만 보여준다. 현장 문제는 `docs/ax-company-problem-intake-kit.md`로 다시 좁힌다.
- 실제 조직의 운영 적용 여부, 내부 보안 정책 승인 여부, 대시보드나 SaaS 운영 범위는 이 카드의 범위가 아니다.

## Non-claims

- 실제 사용자 데이터, credential, private transcript를 포함하지 않는다.
- 외부 보증, 보안 표준 완료 상태, 기관 검토 완료를 주장하지 않는다.
- GitHub, Snyk, OWASP 제품이나 문서를 대신한다고 말하지 않는다.
- AgentGuard의 차별점은 현재 저장소 기준으로 **PR diff + MCP config + transcript/log rollout evidence**를 한 command card로 압축하는 데 있다.
- CLI behavior, package metadata, severity/default policy는 이 문서로 변경하지 않는다.
