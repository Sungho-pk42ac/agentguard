# AX Rollout Guard 규정 대응 체크리스트

이 문서는 AX Rollout Guard 예선 제출 전에 심사자가 물을 수 있는 규정/근거 질문을 한 페이지에서 점검하기 위한 Korean-first checklist입니다. 공개로 확인한 사실, 현재 저장소 evidence, gated/unknown 항목, 그리고 말하지 말아야 할 non-claims를 분리합니다.

## 판정

현재 판정은 "예선 제출 가능, 단 gated portal 세부 규정은 제출 직전 재확인 필요"입니다.

- 제출 가능한 근거: AgentGuard CLI, synthetic AX rollout fixtures, docs 계약 테스트, 기존 smoke commands가 저장소 안에 있습니다.
- 제출 전 보류 항목: 대회 portal의 최종 제출 형식, 파일 수/용량, 영상/링크 허용 방식, 팀/개인 정보 입력란은 공개 문서만으로 확정하지 않습니다.
- 방어 원칙: 확인된 공개 사실은 사실로, 현재 evidence는 현재 evidence로, gated/unknown은 unknown으로 말합니다.

## 공개 확인 사실

| 공개 신호 | borrow | avoid |
|---|---|---|
| OWASP Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | agentic risk, excessive agency, tool misuse framing을 빌려 AX agent rollout risk를 설명합니다. | OWASP certification, OWASP official approval, 전체 항목 대응 완료처럼 들리는 표현은 피합니다. |
| Snyk agent-scan: https://github.com/snyk/agent-scan | AI-agent/GitHub activity scanning이라는 좁은 비교 축을 빌려 "agent activity evidence를 본다"는 범주를 설명합니다. | Snyk와 broad platform parity가 있다는 표현, GitHub 전체 보안 제품 대체 표현은 피합니다. |
| Tencent AI-Infra-Guard: https://github.com/Tencent/AI-Infra-Guard | AI infra guard category가 공개 repo로 존재한다는 competitor-category framing을 빌립니다. | AgentGuard가 full AI infra/red-team platform coverage를 제공한다는 표현은 피합니다. |
| splx-ai agentic-radar: https://github.com/splx-ai/agentic-radar | agentic-radar류 점검 도구와 같은 문제 공간을 다룬다는 category framing을 빌립니다. | red-team platform, SaaS dashboard, infra-wide scanner처럼 범위를 넓히는 표현은 피합니다. |

## 게이트/미확인 체크

제출 직전에 사람 검토가 필요한 gated/unknown 항목입니다.

- 대회 portal 제출 필드: 제목, 설명, 링크, 영상, 첨부 파일 형식.
- company problem 세부 조건: 현장에서 공개되는 업무 도메인, 입력 데이터 형태, 평가 기준.
- 외부 링크 허용 여부: GitHub repo, npm package, SARIF artifact, demo video link.
- 실시간 데모 가능 여부: 인터넷, npm install, 터미널 실행, 사전 빌드 artifact 허용.
- 개인정보/회사 정보 입력: 팀명, 연락처, 소속, 외부 공개 범위.

## 현재 AgentGuard 증거

현재 제출 설명에 사용할 수 있는 저장소 내 evidence입니다.

- CLI surface: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `--sarif`, `--out`.
- Risk vocabulary: `secret.github_token`, `mcp.broad_filesystem_access`, risky shell/transcript policy findings.
- Synthetic AX scenario: `examples/enterprise-scenarios/commerce-voc-agent/` 아래 fake PR diff, MCP config, transcript/log.
- Rollout story: 위험 입력은 현재 CLI verdict에 맞춰 `BLOCK` 또는 `REVIEW`로, 수정/정책 적용 뒤 재검증은 `PASS`로 설명합니다.
- Reviewer docs: `docs/ax-prelim-submission-pack.md`, `docs/ax-demo-scenario-matrix.md`, `docs/ax-competitive-comparison.md`, `docs/ax-judge-evidence-index.md`.
- Machine-compatible evidence: Markdown report, SARIF output, npm scripts, TypeScript contract tests.

## Fit/risk table

| AX 심사 질문 | 현재 fit | 남은 risk | 제출 답변 방식 |
|---|---|---|---|
| 회사 문제 적응성 | PR diff + MCP config + transcript/log를 어떤 업무 agent에도 붙일 수 있는 rollout gate로 설명 가능 | 실제 company problem 세부 항목은 gated/unknown | "문제 공개 후 fixture를 해당 업무 용어로 바꾸고 같은 commands로 evidence를 남깁니다." |
| 구현 결과물성 | CLI와 fixture-backed smoke commands가 있음 | dashboard/SaaS는 없음 | "현재 제출물은 deterministic CLI gate와 evidence docs입니다." |
| 보안/신뢰성 | secret exposure, tool misuse, excessive agency를 공개 reference vocabulary로 설명 가능 | 외부 기관 보증 없음 | "OWASP vocabulary를 참고했지만 certification은 주장하지 않습니다." |
| 차별성 | Korean-first AX rollout storytelling과 GitHub/activity evidence 중심 | broad AI security platform으로 보이면 과장 | "agent rollout approval evidence에 집중합니다." |
| 발표 방어 | non-claims와 unknowns를 문서에 명시 | portal detail 질문에는 즉답 불가 | "현재 공개 정보로 확인한 범위와 미확인 범위를 분리했습니다." |

## Exact smoke commands

저장소 루트에서 아래 순서로 실행합니다.

```bash
npm run build
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
node dist/index.js scan-diff --sarif --out agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

설치된 CLI를 보여줄 때는 같은 surface를 짧게 말합니다.

```bash
agentguard scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
agentguard scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
agentguard scan-log --policy examples/agent-policy.yaml < examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log
```

## Fixture-backed evidence

| Fixture path | 기대 evidence |
|---|---|
| `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `secret.github_token` 등 secret-like PR diff risk가 `BLOCK` 또는 review evidence로 남습니다. |
| `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | 현재 CLI에서는 filesystem integration과 credential env passthrough를 `mcp-risk` evidence로 보여주며, 관련 rule vocabulary는 `mcp.broad_filesystem_access`까지 포함합니다. |
| `examples/enterprise-scenarios/commerce-voc-agent/agent-transcript.log` | 승인 없는 shell/export/delete성 agent action을 policy review 대상으로 설명합니다. |
| `examples/agent-policy.yaml` | `scan-log`가 어떤 command를 review 대상으로 볼지 정하는 sample policy입니다. |

## 제출 전 수정

- README/docs index에 이 checklist 링크가 있는지 확인합니다.
- smoke commands가 clean checkout에서 실행되는지 확인합니다.
- generated artifact가 필요하면 `agentguard.sarif`나 Markdown report를 새로 만들고 날짜/환경을 기록합니다.
- portal 문구에는 gated/unknown 항목을 confirmed fact처럼 쓰지 않습니다.
- "fake adoption", "certification", "final company problem certainty", "real customer data", "broad platform claims"는 금지 문구로 보고 제거합니다.

## 심사 방어 문구

- "AX Rollout Guard는 AgentGuard를 AX agent 배포 승인 gate로 쓰는 예선 패키지입니다."
- "현재 evidence는 synthetic fixture와 CLI smoke output입니다. 실제 고객/회사 데이터를 쓰지 않습니다."
- "OWASP 자료에서는 agentic risk, excessive agency, tool misuse 표현을 빌렸고, OWASP 보증이나 인증을 주장하지 않습니다."
- "Snyk agent-scan은 AI-agent/GitHub activity scanning 비교 축으로만 참고했고, broad platform parity를 말하지 않습니다."
- "Tencent AI-Infra-Guard와 splx-ai agentic-radar는 competitor category framing으로만 참고했고, AgentGuard를 full AI infra/red-team platform이라고 부르지 않습니다."
- "portal 세부 규정과 회사 문제 세부 항목은 gated/unknown으로 분리해 제출 직전에 확인합니다."
