# AX CI evidence handoff card

한국어 우선 AX CI evidence handoff card입니다. 회사 문제가 CI step, preserved artifact, reviewer approval condition으로 어떻게 이어지는지 한 장에서 보여줍니다.
CLI commands, rule IDs, JSON, SARIF, GitHub Actions fields, API/machine fields stay English-compatible.

## 사용 목적

한국 팀이 PR diff, MCP config, agent transcript/log를 CI에서 스캔할 때 reviewer가 무엇을 보고 승인해야 하는지 정리합니다. 이 문서는 product behavior를 바꾸지 않고 현재 저장소 fixture와 기존 CLI command만 사용합니다.

핵심 흐름은 artifact-first입니다. 위험 스캔이 `BLOCK` 또는 `REVIEW`를 만들더라도 SARIF와 Markdown report를 먼저 보존하고, reviewer가 preserved artifact를 보고 approval condition과 rerun condition을 남깁니다.

## Artifact-first CI flow

1. 회사 문제를 먼저 쓴다: PR diff, MCP 권한, transcript/log 중 어떤 rollout risk인지 밝힌다.
2. CI step을 분리한다: scan step은 evidence를 만들고, upload step은 `if: ${{ always() }}`로 보존을 담당한다.
3. preserved artifact를 지정한다: `agentguard.sarif`, Markdown report, JSON finding output처럼 reviewer가 다시 열 수 있는 파일을 남긴다.
4. approval condition을 남긴다: `BLOCK`은 merge/rollout 중단, `REVIEW`는 사람 승인 조건 기록, `PASS`는 현재 evidence 기준 진행이다.
5. rerun condition을 남긴다: fixture-backed command 또는 PR diff command를 다시 실행해 같은 rule IDs와 verdict values가 바뀌었는지 확인한다.

## Company problem → CI step → preserved artifact → approval condition

| 회사 문제 | CI step | preserved artifact | approval condition |
|---|---|---|---|
| PR diff에 agent-visible secret-like 값이나 risky shell material이 들어오면 merge 전에 멈춰야 한다. | `agentguard scan-diff` 또는 `node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff` | `agentguard.sarif`, Markdown report, JSON finding output | `secret.github_token` 또는 critical finding이 있으면 `BLOCK`; 제거 후 같은 command를 rerun해서 `PASS` 또는 명시적 `REVIEW`로 바뀐 evidence를 보존한다. |
| MCP config가 broad filesystem root, writable path, credential passthrough를 열면 agent/tool surface가 회사 자료 범위를 넘을 수 있다. | `agentguard scan-mcp` 또는 `node dist/index.js scan-mcp < examples/risky-mcp.json` | Markdown report, JSON finding row, PR comment excerpt | `mcp.broad_filesystem_access`가 남으면 `BLOCK`; root 축소, read-only 조건, credential passthrough 제거를 확인한 뒤 reviewer가 approval condition을 기록한다. |
| transcript/log에 승인 없는 export, 민감 경로 접근, 삭제성 명령이 보이면 운영 담당자 확인이 필요하다. | `agentguard scan-log` 또는 `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | Policy-backed Markdown report와 retained CI artifact | policy finding이 있으면 `REVIEW`; 담당자가 잔여 위험과 rerun condition을 기록해야 다음 rollout gate로 간다. |

## GitHub Actions split-step pattern

아래 pattern은 scan failure와 evidence preservation을 분리합니다. `continue-on-error: true`는 scan step이 finding 때문에 non-zero가 되어도 뒤의 upload steps가 실행되게 하고, `if: ${{ always() }}`는 SARIF와 Markdown artifact 보존을 우선합니다.

```yaml
- name: Emit AgentGuard reports
  id: agentguard_reports
  continue-on-error: true
  run: |
    mkdir -p .agentguard-demo
    git diff --unified=0 "${{ github.event.pull_request.base.sha }}...${{ github.event.pull_request.head.sha }}" > .agentguard-demo/pr.diff
    agentguard scan-diff < .agentguard-demo/pr.diff > agent-risk-report.md
    agentguard scan-diff --sarif --out .agentguard-demo/agentguard.sarif < .agentguard-demo/pr.diff

- name: Upload AgentGuard SARIF
  if: ${{ always() }}
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: .agentguard-demo/agentguard.sarif

- name: Upload AgentGuard evidence artifact
  if: ${{ always() }}
  uses: actions/upload-artifact@v4
  with:
    name: agentguard-ci-evidence
    path: |
      .agentguard-demo/agentguard.sarif
      agent-risk-report.md
```

이 pattern은 GitHub code scanning upload step과 artifact upload step을 보여주는 예시입니다. AgentGuard가 hosted platform, automatic upload, or GitHub App integration을 제공한다는 뜻이 아닙니다.

## Fixture-backed smoke commands

아래 명령은 현재 저장소 fixture에만 의존합니다. 발표나 CI handoff 전에 `npm run build`를 먼저 실행한 뒤 그대로 복사해 사용합니다. Markdown report는 기본 stdout을 파일로 캡처한 artifact이고, SARIF는 `--sarif --out`으로 만든 machine-readable artifact입니다.

```bash
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json > .agentguard-demo/mcp-report.md
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log > .agentguard-demo/transcript-report.md
```

Referenced fixture paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-policy.yaml`
- `examples/agent-transcript.log`

Machine-facing contracts stay English-compatible: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `scan-diff`, `scan-mcp`, `scan-log`, `rule IDs`, `secret.github_token`, `mcp.broad_filesystem_access`, `JSON`, `SARIF`, `PASS`, `REVIEW`, `BLOCK`.

## Public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| GitHub SARIF upload docs — https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | 빌릴 점: split scan/upload step, SARIF file handoff, reviewer alert workflow. | 피할 점: native-hosted integration, platform scope, or automatic upload 범위를 AgentGuard 기능처럼 말하지 않는다. | `agentguard scan-diff --sarif --out .agentguard-demo/agentguard.sarif`로 SARIF를 만들고 reviewer-owned workflow가 업로드한다. |
| MCP Authorization spec — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | 빌릴 점: authorization, token, client/resource separation language for agent/tool access review. | 피할 점: runtime OAuth enforcement, consent UI, session control, or authorization server 범위를 주장하지 않는다. | `agentguard scan-mcp`로 static MCP config risk를 surfaced evidence로 남기고 사람 approval condition으로 연결한다. |
| Snyk CLI docs — https://docs.snyk.io/snyk-cli | 빌릴 점: CLI-first security workflow, CI command framing, developer-readable remediation loop. | 피할 점: vendor-scale coverage, hosted dashboard, or same product scope claim. | 현재 범위를 PR diff, MCP config, transcript/log fixture-backed commands와 preserved artifact handoff로 좁혀 말한다. |

## Non-claim guardrails

- No customer claim: 실제 고객 데이터, 구매자명, 운영 채택, production rollout 근거를 말하지 않는다.
- No certification claim: 외부 감사 badge, SOC/ISO 보증, formal assurance를 말하지 않는다.
- No platform-parity claim: Snyk, GitHub code scanning, MCP runtime authorization, broad AI security suite와 같은 범위라고 말하지 않는다.
- No automatic upload claim: AgentGuard CLI가 GitHub에 자동 업로드한다고 말하지 않는다. 현재 문서는 reviewer-owned workflow pattern만 보여준다.
- No CLI behavior change: CLI commands, rule IDs, JSON fields, SARIF fields, package metadata, verdict values stay English-compatible and unchanged.
