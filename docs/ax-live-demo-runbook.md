# AX Rollout Guard 라이브 데모 런북

이 런북은 심사위원에게 **회사 문제 → agent/tool surface → risk evidence → BLOCK → 수정/정책/PASS** 흐름을 30초 안에 보여주기 위한 한국어 우선 데모 절차입니다. 현재 저장소에 있는 합성 fixture만 사용하며, 최종 현장 회사 문제가 이미 확정됐다고 말하지 않습니다.

## 준비 / Setup

- 저장소 루트에서 실행합니다.
- Node.js 의존성이 설치돼 있고 `npm run build`가 성공해야 합니다.
- 30초 evidence demo는 top-level fixture인 `examples/risky-pr.diff`, `examples/risky-mcp.json`, `examples/agent-transcript.log`를 기본으로 씁니다.
- 회사 문제 연결은 `examples/enterprise-scenarios/commerce-voc-agent/`를 말로 붙입니다.
- 정책 파일은 `examples/agent-policy.yaml`을 씁니다.
- SARIF artifact는 `.agentguard-demo/agentguard.sarif`에 임시로 만듭니다.

## 30초 토크 트랙

> "커머스 VOC 팀이 환불, 쿠폰, CRM 메모 초안을 AX 에이전트에게 맡기려는 상황입니다. 이때 agent/tool surface는 PR diff, MCP filesystem 권한, agent transcript입니다. AgentGuard는 합성 token-like diff와 넓은 MCP root, 승인 없는 export/삭제성 명령을 risk evidence로 보여주고, 초기 상태를 `BLOCK` 또는 `REVIEW`로 세웁니다. 그 다음 token 제거, MCP root 축소, 승인 정책 추가를 적용하면 같은 명령으로 수정/정책/PASS 증거를 남길 수 있습니다."

## 시나리오 선택

기본 시나리오는 `commerce-voc-agent`입니다. 회사 문제가 재무, HR, 여행/예약에 더 가깝다면 `docs/ax-demo-scenario-matrix.md`에서 가장 가까운 scenario pack을 골라 같은 evidence 흐름으로 말갈이합니다.

| Company problem | agent/tool surface | risk evidence |
|---|---|---|
| 커머스 VOC 운영팀이 환불·쿠폰·CRM 메모 초안을 에이전트에게 맡긴다. | PR diff, MCP config, agent transcript/log | synthetic secret-like token, broad/writable MCP filesystem root, approval-required shell behavior |

## 정확한 실행 명령

```bash
npm run build
mkdir -p .agentguard-demo

node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

CLI가 전역 설치된 환경에서는 같은 입력을 `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`로 바꿔 실행할 수 있습니다. 발표장에서는 `node dist/index.js ...` 명령이 저장소 build 결과와 직접 연결되어 가장 재현하기 쉽습니다.

## 예상 BLOCK/REVIEW evidence

- `scan-diff`: 합성 token-like material이 포함된 PR diff에서 `판정: BLOCK` 또는 `Verdict: BLOCK` evidence를 보여줍니다.
- `scan-mcp`: 넓은 filesystem root, writable path, credential passthrough 같은 MCP permission risk를 `판정: BLOCK` 또는 `Verdict: BLOCK` evidence로 보여줍니다.
- `scan-log --policy`: 승인 없이 export, 삭제성 shell behavior, 민감 경로 접근이 필요한 작업을 `판정: REVIEW` 또는 `Verdict: REVIEW` evidence로 보여줍니다.
- `scan-diff --sarif --out .agentguard-demo/agentguard.sarif`: GitHub code scanning에 올릴 수 있는 SARIF 형태의 CI artifact framing을 보여줍니다.

## 추가 evidence: 로컬 agent config posture와 JSONL transcript

심사자가 "IDE에 붙인 MCP 서버는요?" 또는 "Codex 같은 다른 agent 로그도 되나요?"라고 물으면 같은 저장소 fixture로 바로 보여줍니다. Claude Desktop과 Cursor의 MCP config는 `scan-mcp`에서 동일한 방식으로 `BLOCK` evidence를 만들고, Codex 스타일 JSONL transcript는 `scan-log`에서 `REVIEW` evidence를 만듭니다.

```bash
node dist/index.js scan-mcp < examples/claude-desktop-config.json
node dist/index.js scan-mcp < examples/cursor-mcp.json
node dist/index.js scan-log < examples/codex-transcript.jsonl
```

- `examples/claude-desktop-config.json`: Claude Desktop MCP config evidence for broad filesystem root and credential env passthrough, `판정: BLOCK`.
- `examples/cursor-mcp.json`: Cursor MCP config evidence for the same broad root/credential risk shape, `판정: BLOCK`.
- `examples/codex-transcript.jsonl`: Codex-style JSONL transcript evidence for a leaked OpenAI-format key and an approval-required `deploy` operation, `판정: REVIEW`.

## 수정/정책/PASS 전환

30초 데모에서는 실제 파일을 수정하지 않아도 됩니다. 말로는 아래 순서만 짧게 연결합니다.

1. token-like placeholder를 secret manager 또는 환경 변수 참조로 옮깁니다.
2. MCP filesystem root를 fixture 전용 read-only path로 줄입니다.
3. VOC export, 쿠폰 지급, 환불 처리, 삭제성 shell command를 `examples/agent-policy.yaml` 같은 승인 정책으로 묶습니다.
4. 같은 명령을 재실행해 `PASS` 또는 승인 가능한 `REVIEW` report를 배포 승인 evidence로 남깁니다.

## 정리 / Cleanup

```bash
rm -rf .agentguard-demo
```

## 하지 않는 주장 / Non-claims

- 이 데모는 공개 reference의 문제 framing을 빌려 쓰지만 OWASP, MCP, GitHub, Snyk, Tencent, splx-ai의 검증을 받았다고 말하지 않습니다.
- MCP 표준 적합성이나 공식 검증을 주장하지 않습니다.
- GitHub 보안 제품을 대체한다고 말하지 않습니다. SARIF는 CI artifact와 reviewer-readable evidence 흐름을 보여주는 출력입니다.
- 실제 현장 사용 실적, 운영 데이터, 개인 정보, 실제 credential을 포함하지 않습니다.
- 모든 입력은 synthetic fixture이며 최종 회사 문제는 현장에서 다시 좁힙니다.

## 공개 참고 자료

| Reference | 데모에서 빌릴 framing | 피할 표현 |
|---|---|---|
| AX 인재전쟁 landing page: https://hackathon.jocodingax.ai/ | 심사위원이 바로 이해하는 회사 문제 → 산출물 흐름 | 최종 회사 문제가 이미 확정됐다는 표현 |
| OWASP Agentic AI threats: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ | excessive agency, tool misuse, credential exposure 어휘 | OWASP 검증 또는 승인 표현 |
| MCP Security Best Practices: https://modelcontextprotocol.io/specification/draft/basic/security_best_practices | MCP root, permission, credential exposure remediation | MCP 표준 적합성 주장 |
| GitHub SARIF support: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning | SARIF/CI artifact framing | GitHub 보안 제품 대체 표현 |
| Snyk agent-scan: https://github.com/snyk/agent-scan | agent artifact scanner 비교 surface | 같은 제품 범위라는 표현 |
| Tencent AI-Infra-Guard: https://github.com/Tencent/AI-Infra-Guard | AI infrastructure guardrail 비교 surface | 같은 운영 규모라는 표현 |
| splx-ai agentic-radar: https://github.com/splx-ai/agentic-radar | agent/MCP scanner 비교 surface | 같은 기능 범위라는 표현 |

## 다음 현장 adaptation step

현장에서 회사 문제가 주어지면 `docs/ax-company-problem-intake-kit.md`의 입력 카드로 업무 워크플로, 에이전트/도구 surface, 위험 입력, 승인권자를 5분 안에 채웁니다. 그 다음 `docs/ax-demo-scenario-matrix.md`에서 가장 가까운 scenario pack을 골라 command path만 바꾸고, `BLOCK → 수정/정책/PASS` evidence를 현장 문제 언어로 다시 말합니다.
