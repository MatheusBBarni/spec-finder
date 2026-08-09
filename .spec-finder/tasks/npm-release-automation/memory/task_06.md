# Task Memory: task_06

## Objective Snapshot

- Added the final maintainer release and recovery runbook to `README.md`.
- Final-report preflight re-read the packet artifacts, ADRs, memory, and task-owned diff; the implementation handoff evidence is complete and fresh.
- Lifecycle status and the final task report remain Spec Finder-owned and were not changed here.

## Important Decisions

- Documented the exact `main`-only GitHub Actions dispatch, stable SemVer/package authority prerequisites, and the approved `release` and `reconcile` modes.
- Mirrored the workflow summary contract: `complete`, `blocked`, and `partial`, with package/tag/Release links, Ubuntu/Windows smoke states, retained run artifacts, and one recovery action.
- Kept installer commands unchanged; `spec-finder upgrade` remains `spec-finder@latest`, while exact historical versions use an explicit install command.
- Documented OIDC-only publishing, additive reconciliation, manual identity correction, exact-version deprecation, corrective releases, and GitHub Release note updates without automatic rollback or unpublish.

## Learnings

- Local evidence can validate `tests/release-workflow.test.ts`, `bun run release:check`, and `bun run verify`, but cannot prove trusted publishing, npm mutation, GitHub Release API behavior, or native Windows execution.
- The workflow's retained artifacts are `release-candidate`, `release-state`, `published-package`, `release-metadata`, `smoke-ubuntu`, and `smoke-windows`; smoke `upgrade` evidence is truthful only while the candidate is npm `latest`.
- Handoff terminal evidence is exact: workflow-policy tests passed 11/11 with 171 expectations; `bun run release:check` passed for `spec-finder@0.1.0` with 35 packed paths; `bun run verify` passed 267 tests with 1,505 expectations and a successful build; `actionlint` and `git diff --check` passed.

## Files / Surfaces

- `README.md` — final operator-facing release, summary, recovery, and installer guidance.
- Reviewed `.github/workflows/release.yml`, `package.json`, and `src/commands.ts`; no changes were needed in those contracts.

## Errors / Corrections

- None. Existing unrelated dirty-worktree changes were preserved.

## Ready for Next Run

- `reports/task_06.md` now contains the evidence-backed final report. Do not claim a live release or Windows evidence from local verification; lifecycle status remains runtime-owned.
