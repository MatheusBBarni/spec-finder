# Task 06 Final Report: Document release and recovery operations

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: same ACP session; provider identity unavailable
- Outcome: Added the final maintainer-facing release and recovery runbook to the README, preserving installer behavior and explicitly separating local deterministic evidence from GitHub-hosted live-release evidence.

## Changes

- `README.md` — Added the stable npm release runbook covering trusted-publisher and package-authority prerequisites, the `main`-only dispatch procedure, `release` and `reconcile` modes, complete/blocked/partial summaries, retained artifacts, smoke evidence, manual reconciliation, exact-version deprecation, corrective releases, GitHub Release updates, no-token fallback, and installer guidance.
- `.spec-finder/tasks/npm-release-automation/memory/MEMORY.md` — Preserved durable packet decisions and the external hosted-evidence boundary.
- `.spec-finder/tasks/npm-release-automation/memory/task_06.md` — Recorded task-local documentation decisions and exact final verification evidence.

This task made no changes to `.github/workflows/release.yml`, `package.json`, or `src/commands.ts`; their contracts were reviewed against the README. Existing unrelated dirty-worktree changes were preserved.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Document trusted-publisher/package authority prerequisites, the `main`-only manual dispatch path, and both approved modes. | Satisfied | README “Stable npm releases (maintainers)” documents npm authority, exact workflow registration, OIDC/provenance, Actions dispatch from `main`, and the `release`/`reconcile` mode table. |
| 2. Explain complete, blocked, and partial summaries with package/tag/Release/smoke evidence and the next recovery action. | Satisfied | README “Reading the outcome” mirrors the workflow summary fields, retained `release-*` and `smoke-*` artifacts, all three result states, platform smoke requirements, and the single `Next action` contract. |
| 3. Document no-token fallback, no automatic rollback/unpublish, exact-version deprecation, corrective release, GitHub Release update, and reconcile boundaries. | Satisfied | README “Recovery boundaries” states that OIDC failure has no token fallback, reconciliation never republishes, mismatches fail closed, npm versions are immutable, and gives exact deprecation and `gh release edit` examples for corrective recovery. |
| 4. Preserve installer guidance and state the live evidence boundary. | Satisfied | Existing global install and `spec-finder upgrade` semantics remain intact; README states that `upgrade` targets `spec-finder@latest`, gives explicit historical-version installation, and identifies GitHub Actions as the source of first live release/Windows evidence. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/release-workflow.test.ts` | Passed | 11 tests passed, 0 failed, 171 expectations. |
| `bun run release:check` | Passed | Printed `release:check passed: spec-finder@0.1.0 (35 packed paths)`. |
| `bun run verify` | Passed | Typecheck passed; 267 tests passed, 0 failed, 1,505 expectations; Bun build bundled 27 modules successfully. |
| `actionlint .github/workflows/release.yml` | Passed | Workflow syntax and expression checks completed without diagnostics. |
| `git diff --check` | Passed | No whitespace errors in README or the task packet memory changes. |
| README/workflow/CLI contract review | Passed | Reviewed `.github/workflows/release.yml`, `package.json`, and `src/commands.ts`; no installer or workflow changes were needed. |

## Risks and Follow-ups

- No live workflow was run. npm namespace ownership, trusted-publisher registration, OIDC exchange, npm publication, tag/Release API behavior, and GitHub-hosted Ubuntu/Windows smoke remain external evidence gates.
- Local verification must not be presented as proof of Windows execution, npm propagation to `@latest`, or a completed public release.
- If a published version is defective, the documented recovery is exact-version deprecation, a new corrective release, and GitHub Release note updates; automatic rollback and unpublish remain out of scope.
- The task frontmatter status remains runtime-owned and was not changed by this report phase.

## Final Verdict

Completed. The README now provides implementation-aligned maintainer release, summary, installer, and recovery guidance; the existing CLI contract remains unchanged; the focused workflow tests, deterministic release check, repository verification, actionlint, and diff checks all passed with recorded terminal evidence. The first live trusted-publisher release and native Windows smoke remain explicit external follow-ups rather than unverified claims.
