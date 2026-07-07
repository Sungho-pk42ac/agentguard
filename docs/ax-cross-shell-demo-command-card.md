# AX cross-shell demo command card

한국어 우선 운영 카드입니다. CLI commands, rule IDs, JSON/SARIF fields, fixture paths는 그대로 유지하고, POSIX shell, PowerShell, GitHub Actions judging/demo 환경에서 같은 evidence command를 안정적으로 다시 실행하는 데만 씁니다.

## 30초 운영 카드

1. 회사 문제를 하나로 말합니다: "커머스 VOC 에이전트가 읽기/쓰기 권한과 PR diff 위험을 만들었는지 배포 전에 멈춥니다."
2. 같은 fixture로 shell만 바꿔 실행합니다: MCP config, PR diff, SARIF artifact.
3. `BLOCK`은 출시/배포 stop, `REVIEW`는 승인자 검토, `PASS`는 해당 입력에서 finding 없음으로 설명합니다.
4. MCP command output은 runtime enforcement claim이 아니라 business approval / 업무 승인 중단 조건으로만 말합니다.

## POSIX shell

```bash
node dist/index.js scan-mcp < examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json
node dist/index.js scan-diff < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
mkdir -p .agentguard-demo
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
```

## PowerShell

PowerShell에서는 `< file` 리다이렉션 대신 `Get-Content -Raw ... | node ...` 형태를 데모 기본값으로 둡니다. stdin 기반 CLI 계약은 그대로이고, shell 입력 방식만 바꿉니다. 오래된 Windows PowerShell에서 파이프 인코딩/줄바꿈 문제가 보이면 아래 UTF-8 설정을 먼저 적용한 뒤 같은 commands를 다시 실행합니다.

```powershell
# Windows PowerShell에서 encoding/format 문제가 보일 때만 실행
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Get-Content -Raw examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json | node dist/index.js scan-mcp
Get-Content -Raw examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff | node dist/index.js scan-diff
New-Item -ItemType Directory -Force .agentguard-demo
Get-Content -Raw examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff | node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif
```

## GitHub Actions artifact path

Risky fixture는 `BLOCK`으로 0이 아닌 exit가 날 수 있습니다. judging/demo CI에서는 SARIF file을 먼저 보존하고, 위험 exit는 별도 gate로 읽게 합니다.

```yaml
name: AgentGuard demo evidence
on:
  workflow_dispatch:

jobs:
  agentguard-demo:
    runs-on: ubuntu-latest
    defaults:
      run:
        shell: bash
        working-directory: .
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - name: AgentGuard SARIF evidence
        continue-on-error: true
        run: |
          mkdir -p .agentguard-demo
          node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff
      - name: Upload AgentGuard SARIF artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: agentguard-sarif
          path: .agentguard-demo/agentguard.sarif
          if-no-files-found: error
```

Expected artifact: `.agentguard-demo/agentguard.sarif`. 이 파일은 GitHub code scanning에 넘길 수 있는 SARIF shape를 확인하는 evidence artifact이며, AgentGuard가 GitHub-native app이라는 뜻은 아닙니다.

## Expected verdict and exit behavior

| Surface | Command input | Expected verdict | Exit behavior | Business meaning |
| --- | --- | --- | --- | --- |
| MCP config | `examples/enterprise-scenarios/commerce-voc-agent/risky-mcp.json` | `BLOCK` or `REVIEW` | Risky findings can return nonzero / 0이 아닌 exit | 업무 승인 없이 agent/tool rollout 중단 |
| PR diff | `examples/enterprise-scenarios/commerce-voc-agent/risky-pr.diff` | `BLOCK` or `REVIEW` | Risky findings can return nonzero / 0이 아닌 exit | PR merge 전 보안/운영자 검토 |
| SARIF | `.agentguard-demo/agentguard.sarif` | Same findings encoded as SARIF | Artifact can still be preserved by CI when the scan step is risky | reviewer handoff artifact 보존 |
| Clean rerun | fixed or remediated input | `PASS` | Exit 0 when no findings remain | finding 없음 또는 위험 없음 evidence |

## Public reference borrow/avoid notes

| Public reference | Borrow | Avoid | AgentGuard action |
| --- | --- | --- | --- |
| GitHub Actions default shell/workdir docs: https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/setting-a-default-shell-and-working-directory | CI shell and working-directory를 명시합니다. | AgentGuard가 GitHub product이거나 GitHub code scanning을 대체한다고 말하지 않습니다. | `defaults.run.shell: bash`와 `working-directory: .`를 snippet에 고정합니다. |
| PowerShell about_Redirection: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_redirection | shell별 redirection/pipeline 차이를 인정합니다. | Windows 전용 CLI flag를 추가하지 않습니다. | `Get-Content -Raw ... \| node dist/index.js ...` 변형을 문서화합니다. |
| GitHub SARIF support docs: https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support | SARIF는 third-party tool output handoff 형식으로 설명합니다. | SARIF upload가 product parity나 보안 인증이라는 식으로 말하지 않습니다. | `--sarif --out .agentguard-demo/agentguard.sarif` artifact path를 고정합니다. |
| MCP Security Best Practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices | permission, credential, user-consent risk vocabulary를 빌립니다. | protocol-level enforcement를 한다고 말하지 않습니다. | MCP finding을 business approval stop 조건으로 연결합니다. |

## Non-claim guardrails

- No customer claim: 이 card는 synthetic fixture evidence만 다룹니다.
- No certification claim: public references는 borrow/avoid 근거일 뿐 외부 인증이 아닙니다.
- Machine contract names stay fixed: `agentguard`, `node dist/index.js`, rule IDs, JSON, SARIF machine fields는 그대로 둡니다.
- No platform expansion: web console, hosted service, login, real credential handling, runtime MCP enforcement 범위를 추가하지 않습니다.
- No source scanner change: command reliability를 높이는 문서 카드이며 scanner behavior를 바꾸지 않습니다.
