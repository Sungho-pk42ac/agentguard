# Team rollout baseline guide

한국어 우선 팀 rollout guide입니다. 목적은 첫날 baseline을 만들고, noise와 false-positive를 사람 검토 경계로 다루며, PR reviewer에게 같은 evidence artifact를 반복해서 넘기는 것입니다. 모든 예시는 현재 저장소의 합성 fixture만 사용합니다.

## 첫날 baseline/noise triage

첫날에는 findings를 바로 지우는 작업보다 같은 입력을 반복 실행해 기준선을 고정합니다.

1. `npm run build`로 `dist/index.js`를 최신 상태로 만든다.
2. 아래 fixture-backed command를 실행하고 Markdown, JSON, SARIF 같은 artifact 위치를 기록한다.
3. 같은 finding이 같은 surface, severity, location으로 반복되는지 확인해 baseline 후보로 둔다.
4. 새 finding, severity 상승, artifact 누락은 baseline noise로 닫지 않고 reviewer에게 보낸다.

```bash
node dist/index.js scan-diff < examples/risky-pr.diff
node dist/index.js scan-mcp < examples/risky-mcp.json
node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log
node dist/index.js scan-log --policy examples/agent-policy.team.yaml < examples/agent-transcript.log
node dist/index.js scan-diff --sarif --out .agentguard-demo/agentguard.sarif < examples/risky-pr.diff
```

Referenced safe fixture paths:

- `examples/risky-pr.diff`
- `examples/risky-mcp.json`
- `examples/agent-transcript.log`
- `examples/agent-policy.yaml`
- `examples/agent-policy.team.yaml`

`.agentguard-demo/agentguard.sarif`는 GitHub code scanning handoff를 로컬에서 확인하기 위한 SARIF artifact 경로입니다. risky 입력은 BLOCK으로 non-zero exit가 날 수 있음.

## PASS / REVIEW / BLOCK 운영 기준

| Verdict | 팀 운영 기준 | Reviewer action |
|---|---|---|
| `PASS` | 같은 surface에서 blocking finding이 없고 artifact가 생성됐다. | PR comment 또는 CI summary에 PASS evidence를 남기고 진행한다. |
| `REVIEW` | policy나 업무 맥락이 필요한 advisory finding이 남았다. | 승인권자가 finding, location, artifact를 보고 제한 rollout 여부를 결정한다. |
| `BLOCK` | secret-like material, broad writable MCP access, 위험 shell behavior처럼 rollout을 멈춰야 하는 finding이 남았다. | 원인 제거 전에는 merge나 배포 승인을 하지 않는다. |

## False-positive와 allowlist boundary

현재 boundary는 policy, advisory note, reviewer decision에 있습니다. suppression engine 없음. 새 suppression engine을 제공한다고 말하지 않는다.

- Policy file은 `agentguard scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log`처럼 log 판단에 필요한 승인 문맥을 제공한다.
- `examples/agent-policy.team.yaml`은 첫날 팀 rollout policy 예시이며, `node dist/index.js scan-log --policy examples/agent-policy.team.yaml < examples/agent-transcript.log`로 같은 transcript fixture에 적용해 본다. `~/.ssh/**`와 `.ssh/**`를 함께 적어 홈 디렉터리와 repo-local SSH 흔적을 모두 사람 검토 대상으로 올리고, command deny 예시는 shell 우회까지 완전히 막는 sandbox가 아니라 reviewer가 즉시 멈춰 볼 최소 경계다.
- allowlist 판단은 artifact와 reviewer note에 남긴다. 코드가 자동으로 finding을 숨기는 기능으로 설명하지 않는다.
- false-positive 의심 항목도 rule ID, surface, location, reviewer decision을 함께 남겨 다음 rerun에서 같은 기준으로 비교한다.

## PR reviewer handoff evidence

Reviewer에게는 한 줄 결론보다 재실행 가능한 evidence 묶음을 넘깁니다.

- PR comment: Markdown report의 `PASS`, `REVIEW`, `BLOCK` 결론과 주요 finding location.
- SARIF: `.agentguard-demo/agentguard.sarif` 또는 GitHub Action의 `sarif-path` output.
- Artifact: Markdown report, JSON findings, SARIF file을 같은 CI run에 묶어 보관.
- Rerun command: 위 exact command와 fixture path를 그대로 남겨 같은 입력에서 결과를 다시 만들 수 있게 한다.

## Rerun freshness checklist

- `npm run build` 이후 `node dist/index.js ...` command를 실행했는지 확인한다.
- PR diff는 최신 base/head에서 만든 입력인지 확인한다.
- MCP config와 transcript/log는 이번 review 대상에서 가져온 입력인지 확인한다.
- CI에서는 `fail-on: block`으로 첫 rollout을 시작하고, baseline noise가 줄어든 뒤 더 강한 gate를 검토한다.
- Artifact timestamp, commit SHA, reviewer decision을 같이 남긴다.

## Machine-contract boundaries

Machine-facing names stay English-compatible and stable.

- CLI contract: `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`
- Rule contract: rule IDs such as `secret.github_token` and `mcp.broad_filesystem_access`
- Data contract: JSON, SARIF, machine fields
- GitHub Action inputs: `base-sha`, `head-sha`, `report-path`, `json-path`, `sarif-path`, `policy-path`, `package-version`, `fail-on`
- Recommended first rollout input: `fail-on: block`

이 guide는 새로운 scanner verdict semantics, allowlist storage, or external certification scope를 만들지 않습니다. 현재 구현된 CLI, GitHub Action inputs, PR comment, SARIF, artifact handoff만 설명합니다.
