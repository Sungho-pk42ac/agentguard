# AX fresh-clone verifier card

한국어 우선 fresh-clone 검증 카드입니다. 목적은 AX 인재전쟁 / AX Rollout Guard 심사자가 agent self-report나 발표 문구가 아니라, 깨끗한 checkout에서 재현 가능한 명령과 artifact로 AgentGuard 증거를 accept / request rerun / block 할 수 있게 하는 것입니다.

범위는 docs-contract slice입니다. Scanner behavior, CLI command spelling, rule IDs, verdict values, JSON, SARIF, API, machine fields는 바꾸지 않습니다.

## Fresh-clone verification flow

| Verification step | Exact command | Expected evidence | Reviewer decision | Rerun / block trigger |
|---|---|---|---|---|
| Install/build from a clean checkout | `npm ci && npm run build` | `package.json` / lockfile 기준으로 `dist/index.js`가 생성되고 build가 끝난다. | accept only if a fresh clone can reproduce the CLI binary used below. | build 실패, lockfile mismatch, generated artifact missing이면 request rerun. |
| Local readiness JSON | `node dist/index.js doctor --json` | JSON readiness output; machine-readable `doctor --json` contract remains English-compatible. | accept if JSON parses and shows local example/scanner readiness evidence. | JSON parse failure or missing readiness checks blocks reviewer trust. |
| PR diff risk proof | `node dist/index.js scan-diff < examples/risky-pr.diff` | `examples/risky-pr.diff` 기반 `BLOCK`/`REVIEW` evidence; `agentguard scan-diff` semantics are unchanged. | accept if the command reports rerunnable diff risk without raw secret leakage. | empty stdout, wrong verdict, or fixture path drift means rerun. |
| MCP config risk proof | `node dist/index.js scan-mcp < examples/risky-mcp.json` | `examples/risky-mcp.json` 기반 broad permission / credential passthrough evidence. | accept if MCP risk maps to approval conditions before agent rollout. | runtime MCP execution claim or missing fixture blocks acceptance. |
| Agent transcript/log proof | `node dist/index.js scan-log --policy examples/agent-policy.yaml < examples/agent-transcript.log` | `examples/agent-policy.yaml`와 `examples/agent-transcript.log` 기반 approval-required operation evidence. | accept if `scan-log` turns agent action history into REVIEW/BLOCK language. | policy path mismatch or agent self-report-only proof means request rerun. |
| SARIF reviewer artifact proof | `node dist/index.js scan-diff --sarif --out .agentguard-demo/fresh-clone-verifier/agentguard.sarif < examples/risky-pr.diff` | `.agentguard-demo/fresh-clone-verifier/agentguard.sarif` created from the same fixture-backed PR diff. | accept as local SARIF handoff evidence; upload remains a separate CI workflow choice. | missing SARIF file, malformed SARIF, or assumed CI upload automation blocks acceptance. |

## public reference borrow/avoid/action table

| Public reference | Borrow | Avoid | AgentGuard action |
|---|---|---|---|
| https://hackathon.jocodingax.ai/ | REAL PROBLEM / REAL JUDGE / REAL OUTPUT framing: results must be quickly reproducible, not just narrated. | Do not claim gated portal scoring, hidden company problem details, hiring outcome, or final evaluation certainty. | Put fresh-clone setup and exact evidence commands before any 대상권 story. |
| https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices | Least privilege, user consent, audit/logging, and confused-deputy-style MCP risk language. | Do not imply AgentGuard enforces runtime OAuth/session/consent; this card is static evidence review. | Route MCP config proof through `scan-mcp` and require human approval for broad tool permissions. |
| https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html | Human-in-the-loop controls, approval flow, tool authorization, and action classification. | Do not present a generic SAST parity story or claim full runtime agent security coverage. | Show `scan-log` and policy-backed approval-required operation evidence as the AX differentiator. |
| https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github | SARIF file and code scanning reviewer handoff pattern. | Do not say AgentGuard automatically uploads SARIF from this command; local generation and CI upload are separate. | Generate local SARIF under `.agentguard-demo/fresh-clone-verifier/agentguard.sarif` for reviewer handoff. |
| https://github.com/Tencent/AI-Infra-Guard | Public ecosystem signal that Agent Scan, MCP scan, Skills Scan, and AI Infra checks are real categories. | Do not claim replacement, parity, certification, or customer adoption against Tencent / AI-Infra-Guard. | Keep differentiation narrow: Korean-first enterprise rollout proof over PR diff + MCP config + transcript/log + SARIF. |

## machine-contract boundaries

- Human explanation can be Korean-first, but `PASS`, `REVIEW`, `BLOCK`, `agentguard scan-diff`, `agentguard scan-mcp`, `agentguard scan-log`, `scan-diff`, `scan-mcp`, `scan-log`, `doctor --json`, `JSON`, `SARIF`, `ruleId`, `--policy`, `--sarif`, and `--out` remain English-compatible machine contracts.
- The card proves a fresh-clone verifier path, not hosted deployment, runtime authorization, OAuth/session enforcement, production rollout proof, or external assurance.
- `agentguard scan-diff` is mentioned as the package-level command shape; fresh-clone commands use `node dist/index.js ...` after `npm ci && npm run build` so a reviewer can reproduce from source.

## Reviewer decision shortcut

1. **accept** — fresh clone builds, `doctor --json` parses, fixture-backed PR/MCP/transcript commands return expected `REVIEW`/`BLOCK`, and SARIF is generated from the same fixture.
2. **request rerun** — command output is missing, stale, not tied to the fixture path, or the build artifact differs from the reviewed checkout.
3. **block** — the packet depends on agent self-report only, raw secrets/customer data, unsupported runtime-auth claims, unsupported trust claims, or unsupported upload automation claims.

## claim guardrails

This card must not claim customer adoption, certification, runtime-auth enforcement, automatic SARIF upload, scanner parity/replacement, hidden AX judging knowledge, real customer data, or legal/compliance assurance. It is a fresh-clone reproducibility handoff for existing local AgentGuard evidence only.
