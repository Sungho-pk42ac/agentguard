# AgentGuard Continuous Harness Workflow

AgentGuard is developed as a small-slice AgentOps security harness. The goal is to keep `main` releasable while Hermes, Codex, Claude, or another agent can repeatedly improve the product with auditable evidence.

## Operating loop

1. **Interview or infer scope**
   - State the user-facing/security problem.
   - Identify the smallest useful outcome.
   - Name what is explicitly out of scope.
2. **Create one GitHub issue per slice**
   - Use the sliced issue template.
   - Include acceptance criteria and a verification plan before coding.
   - Prefer `priority:P0/P1/P2`, `type:feature`, `type:quality`, `type:bug`, and agent labels such as `agent:codex` or `agent:claude-review`.
3. **Create one branch per issue**
   - Branch format: `issue/<number>-<short-slug>`.
   - Start from current `main` and keep the diff focused.
4. **Use RED/GREEN when behavior changes**
   - Add a failing test first for scanner, policy, CLI, report, or packaging behavior.
   - Capture the failing command in the PR notes.
   - Implement the minimal change, then run the specific test and full suite.
5. **Open one PR per issue**
   - PR body must link the issue with `Closes #<number>`.
   - Include local verification output and any remaining risks.
   - Use Claude/Gajae/Codex as reviewers or builders only when the slice needs it; Hermes owns final verification.
6. **Merge only after checks are green**
   - Required local gate:
     ```bash
     npm test
     npm run typecheck
     npm run build
     ```
   - Required remote gate: GitHub Actions CI passes on the PR head.
7. **Post-merge verification**
   - Confirm the issue closed.
   - Pull `main` and verify the intended artifact exists.
   - For release/package work, also verify the packaged CLI or dry-run publish output.

## Slice sizing rules

A good AgentGuard slice usually changes 2-6 files and has one of these shapes:

- **Scanner behavior**: one new risk pattern, adapter, or parsing improvement plus tests.
- **Policy behavior**: one schema/default/alias/security-hardening change plus tests.
- **Report behavior**: one output format or code-scanning integration improvement plus tests.
- **Packaging/CI**: one release, install, action, or documentation gate with executable verification.
- **Documentation**: one user workflow, example, or security guidance page with a smoke command.

Avoid broad PRs named `refactor`, `cleanup`, or `improve everything`. Split them into observable outcomes.

## Backlog order for this repository

Current high-value slices should stay issue-driven:

1. GitHub Action PR comment workflow.
2. Structured MCP config scanner.
3. SARIF/code-scanning docs and examples.
4. Release packaging and npm publish readiness.
5. SaaS/landing page work only after the CLI/product proof is credible.

## Agent roles

- **Hermes**: product owner, issue slicer, branch/PR/CI operator, final verifier.
- **Codex/LazyCodex**: implementation worker for TypeScript or CI slices.
- **Claude/Gajae-Code**: reviewer, security critic, architecture/design reviewer.

Do not let agents merge without an independently checked diff, passing local commands, and green CI.

## Done definition

A slice is done only when:

- The PR is merged to `main`.
- CI is green.
- The linked issue is closed.
- Verification evidence is recorded in the PR.
- Any follow-up scope is converted into a new issue instead of being hidden in the PR notes.
