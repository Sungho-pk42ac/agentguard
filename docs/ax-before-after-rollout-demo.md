# AX before/after rollout demo

이 문서는 심사위원에게 **회사 문제 → risk evidence → 수정/정책 → PASS 승인**을 30초 안에 보여주기 위한 한국어 우선 before/after 데모입니다. 모든 입력은 합성 fixture이며, 운영 실적·제3자 검증·운영 데이터를 주장하지 않습니다.

## 회사 문제

커머스 VOC 운영팀이 환불, 쿠폰, CRM 메모 초안 작성을 AX 에이전트에게 맡기려 합니다. 승인권자는 먼저 MCP config가 업무 폴더만 읽는지, credential-like 환경 변수를 agent runtime에 넘기지 않는지, 쓰기 가능한 broad root가 없는지 확인해야 합니다.

이 slice는 MCP config 하나만 사용합니다. PR diff, transcript, dashboard, SaaS workflow는 다루지 않습니다.

## Before: 위험 fixture

Risky fixture:

```bash
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
```

Global install 환경에서는 같은 입력을 아래처럼 실행할 수 있습니다.

```bash
agentguard scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/risky-mcp.json
```

예상 evidence:

- `mcp.broad_filesystem_access` / `mcp-filesystem-wide-root`: MCP config가 `/` broad root를 노출합니다.
- `mcp.filesystem_writable_path` / `mcp-filesystem-writable-path`: MCP config가 writable path를 허용합니다.
- credential-like env passthrough: `CRM_ACCESS_TOKEN`, `COUPON_ADMIN_TOKEN` 같은 합성 env key가 agent runtime에 전달됩니다.
- CLI 출력: `**판정:** BLOCK`

## After: 수정/정책 fixture

Fixed fixture:

```bash
node dist/index.js scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
```

Global install 환경에서는 같은 입력을 아래처럼 실행할 수 있습니다.

```bash
agentguard scan-mcp < examples/ax-rollout-before-after/commerce-voc-mcp/fixed-mcp.json
```

수정/정책 설명:

- MCP command를 VOC 읽기 전용 runner로 좁힙니다.
- path를 `examples/ax-rollout-before-after/commerce-voc-mcp/readonly-voc-export` fixture 범위로 제한합니다.
- `readOnly: true`로 쓰기 가능 path를 제거합니다.
- credential-like env passthrough를 제거하고, 실제 배포에서는 secret manager나 승인 workflow가 소유하게 둡니다.
- `agentguard-demo-voc-reader` / `agentguard-demo-voc-runner`는 합성 command 이름입니다. AgentGuard `scan-mcp`는 이 config를 evidence로 파싱할 뿐 데모 command를 실행하거나 binary를 resolve하지 않습니다.
- CLI 출력: `**판정:** PASS`

## 30초 승인 스토리

> "처음 설정은 VOC 에이전트가 넓은 root와 writable path, credential-like env를 받아서 배포 전 BLOCK입니다. 수정 후에는 MCP config가 fixture 전용 read-only path만 읽고 env credential을 받지 않으므로 같은 `agentguard scan-mcp` 증거가 PASS로 바뀝니다. 이 before/after가 AX Rollout Guard의 승인 스토리입니다."

## Machine contract boundary

한국어 설명을 추가해도 CLI와 machine-facing contract는 그대로 둡니다.

- CLI command: `agentguard scan-mcp`
- Node command: `node dist/index.js scan-mcp`
- JSON/SARIF fields and rule IDs stay English-compatible.
- Existing rule ID examples remain stable: `mcp.broad_filesystem_access`, `mcp-filesystem-wide-root`, `mcp.filesystem_writable_path`, `mcp-filesystem-writable-path`.

## 하지 않는 주장 / Non-claims

- 운영 실적이나 외부 reference account를 주장하지 않습니다.
- 제3자 감사, 표준 적합성, 공식 검증을 주장하지 않습니다.
- 범용 보안 제품군이나 모든 MCP 위험을 다루는 도구라고 말하지 않습니다.
- fixture의 token-like 값은 합성 문자열이며 실제 credential이 아닙니다.
