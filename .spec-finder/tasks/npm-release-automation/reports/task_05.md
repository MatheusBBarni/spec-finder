# Task 05 Final Report: Prove releases with platform smoke and summary

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: same ACP session; provider identity unavailable
- Outcome: Extended the repository-owned release workflow with isolated Ubuntu/Windows post-publication smoke, exact installed-command checks, per-platform evidence artifacts, and an always-run text-first summary. No live publication or hosted runner execution was performed.

## Changes

- `.github/workflows/release.yml` — Added an `ubuntu-latest`/`windows-latest` matrix with runner-temp workspace and home/profile isolation, npm cache/prefix/user-config isolation, executable PATH setup, exact package installation, prefix assertions, `version`/`setup`/`upgrade` probes, `@latest` identity protection, smoke artifacts, and final `formatSummary` aggregation.
- `tests/release-workflow.test.ts` — Added parsed workflow-policy coverage for matrix platforms, isolation controls, installed-command behavior, latest-version protection, always-run summary execution, completion criteria, and partial recovery.
- `.spec-finder/tasks/npm-release-automation/memory/MEMORY.md` — Recorded durable task-05 workflow decisions, verification state, and the external hosted-run boundary.
- `.spec-finder/tasks/npm-release-automation/memory/task_05.md` — Recorded task-local decisions, corrections, touched surfaces, and exact verification evidence.

No `src/commands.ts`, `src/setup.ts`, version, setup, upgrade, ACP, or configuration behavior was changed. Existing unrelated dirty-worktree changes were preserved.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Run post-publication smoke on GitHub-hosted Ubuntu and Windows with isolated workspace, home/profile, npm prefix, and PATH state. | Satisfied | `release.yml` defines a non-fail-fast `ubuntu-latest`/`windows-latest` matrix. Each platform prepares a runner-temp workspace, home/profile, npm cache/user config, global prefix, and executable PATH; the focused workflow-policy suite asserts these controls. Hosted execution itself remains an external gate and is not claimed here. |
| 2. Prove the exact installed package runs `version`, `setup`, and `upgrade` in each clean environment, with truthful `@latest` behavior. | Satisfied | Matrix steps install `spec-finder@<version>` into the isolated prefix, assert the configured npm prefix, run the installed `spec-finder version`, `spec-finder setup`, and `spec-finder upgrade` commands, and require `npm view spec-finder@latest` to match before attributing exact-version upgrade evidence. Bash and PowerShell paths exercise the existing Windows `npm.cmd` selection; static tests passed. |
| 3. Emit an always-run plain-text summary with source/version, available public links, platform status, and exactly one recovery action. | Satisfied | The `summary` job uses `always()`, downloads matrix evidence, derives validated package/tag/Release links when available, and delegates formatting to `formatSummary`, which emits one `Next action` line. Static policy tests cover summary execution and link/platform fields. |
| 4. Allow `complete` only after matching artifacts and both smoke jobs pass; keep cancellation, preflight failure, and smoke failure blocked/partial. | Satisfied | Final classification requires accepted preflight, non-blocked remote state, successful package/metadata state, all public links, and version-matching `passed` Ubuntu and Windows artifacts. Failed preflight/remote state is `blocked`; metadata/package/smoke gaps are `partial`; matrix evidence is written under `always()` steps. Static policy tests cover complete/blocked/partial branches. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/release-workflow.test.ts` | Passed, exit 0 | 11 tests passed, 0 failed, 171 expectations. |
| `actionlint .github/workflows/release.yml` | Passed, exit 0 | Workflow syntax, expressions, and shell checks completed without diagnostics. |
| `bun run release:check` | Passed, exit 0 | Printed `release:check passed: spec-finder@0.1.0 (35 packed paths)`. |
| `bun run verify` | Passed, exit 0 | Typecheck passed; 267 tests passed, 0 failed, 1,505 expectations; Bun bundled 27 modules successfully. |

## Risks and Follow-ups

- No live release workflow was run, so there are no hosted Ubuntu/Windows logs proving npm propagation, native Windows installation, or the three installed commands. Static local evidence must not be presented as that platform proof.
- The first live release still requires npm namespace ownership, trusted-publisher registration for the exact repository/workflow filename, GitHub permissions, OIDC exchange, registry state, tag writes, and GitHub Release API behavior.
- A reconciled older version cannot claim exact upgrade evidence after a newer stable `@latest` exists; the workflow intentionally reports that condition as partial and directs manual reconciliation rather than republishing.
- The repository remains broadly dirty from unrelated user-owned changes; this task did not stage, commit, publish, or clean them.

## Final Verdict

Completed. The task-05 implementation and static workflow evidence satisfy the repository-owned cross-platform smoke and truthful-summary contract, with all focused and repository gates passing to terminal exit. The real GitHub-hosted matrix and trusted-publisher release remain explicit external evidence gates; no live execution is claimed. Lifecycle status remains owned by Spec Finder.
