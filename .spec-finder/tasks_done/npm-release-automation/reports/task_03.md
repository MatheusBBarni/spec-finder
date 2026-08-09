# Task 03 Final Report: Establish secure release-workflow preflight

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: same ACP session; provider identity unavailable
- Outcome: Added the safe, read-only stable-release workflow boundary and parsed workflow-policy tests. No package, tag, or GitHub Release mutation path was added.

## Changes

- `.github/workflows/release.yml` — Added a manual `release`/`reconcile` workflow with a fail-closed `refs/heads/main` guard, non-cancelling `stable-release` concurrency, exact source checkout and SHA/tree capture, locked Bun setup, local preflight gates, deterministic `release-candidate.json` artifact handoff, least-privilege job permissions, immutable action pins with version comments, and always-run accepted/blocked summaries.
- `tests/release-workflow.test.ts` — Added YAML-parser policy tests for dispatch modes, source guard ordering, concurrency, source identity, artifact shape, action pins, permissions, gate ordering, mutation absence, accepted-output gating, and failure summary behavior.
- `.spec-finder/tasks/npm-release-automation/memory/MEMORY.md` — Promoted durable workflow and task-04 handoff facts.
- `.spec-finder/tasks/npm-release-automation/memory/task_03.md` — Recorded decisions, touched surfaces, corrections, and exact final verification evidence.

No CLI, ACP, configuration, or package-script changes were made. Existing unrelated dirty-worktree changes were preserved.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Manual `release`/`reconcile` workflow with fail-closed `main` guard. | Satisfied | `release.yml` defines required choice input options and rejects any source other than `refs/heads/main`; focused policy tests passed. |
| 2. Non-cancelling concurrency, full source identity, deterministic candidate handoff, and always-run non-success summary. | Satisfied | `stable-release` uses `cancel-in-progress: false`; checkout records ref, commit, and tree identity; `release-candidate.json` is uploaded with `if-no-files-found: error`; acceptance is emitted only after upload; summary job uses `always()` with a blocked path. |
| 3. Job-level least privilege, immutable reviewed action pins, and no long-lived npm token. | Satisfied | Workflow defaults to empty permissions; both jobs declare only `contents: read`; checkout, setup-bun, and upload-artifact use 40-character SHA pins with version comments; static tests assert no npm token or OIDC write permission is present in this read-only task. |
| 4. Local release gate and repository verification before future mutation eligibility. | Satisfied | Preflight runs `bun run release:check` before `bun run verify`; the accepted output is finalized only after the artifact upload, and the workflow documents the required successful-preflight plus accepted-output guard for future mutation jobs. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/release-workflow.test.ts` | Passed, exit 0 | 4 tests passed, 0 failed, 54 expectations. |
| `actionlint .github/workflows/release.yml` | Passed, exit 0 | Workflow syntax and GitHub expression/shell checks completed without diagnostics. |
| `bun run release:check` | Passed, exit 0 | Printed `release:check passed: spec-finder@0.1.0 (35 packed paths)`. |
| `bun run verify` | Passed, exit 0 | Typecheck passed; 260 tests passed, 0 failed, 1,388 expectations; Bun build bundled 27 modules successfully. |
| Relevant whitespace/status checks | Passed | Final `git diff --check` and workflow whitespace checks were clean; task status remained runtime-owned and no report existed before this report phase. |

## Risks and Follow-ups

- Local static validation does not prove hosted GitHub dispatch behavior, artifact-service behavior, token enforcement, OIDC exchange, npm registry state, or remote tag/Release behavior.
- The candidate artifact intentionally records `remoteState: null` and `mutationEligible: false`. Task 04 must refresh remote state, revalidate the artifact, and gate every mutation job on successful preflight plus `accepted == true`.
- Action revisions are immutable but require future review when extending or maintaining the workflow.
- The repository remains broadly dirty from unrelated user-owned work; this task did not stage, commit, or revert those changes.

## Final Verdict

Completed. The task adds the approved manual, `main`-only, least-privilege preflight boundary with immutable action pins, deterministic candidate/state handoff, and truthful failure summarization. All four numbered requirements are covered by the workflow and static policy tests, and the focused test, actionlint, `release:check`, and full verification gates passed to terminal exit. Lifecycle status remains owned by Spec Finder.
