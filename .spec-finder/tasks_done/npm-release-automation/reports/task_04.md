# Task 04 Final Report: Orchestrate publication and reconciliation

## Task and Outcome

- Task: `task_04` — Orchestrate publication and reconciliation
- Date: 2026-08-09
- Provider/session: same ACP session; provider identity unavailable
- Outcome: Extended the guarded release workflow with a refreshed remote-identity handoff, release-only npm publication, annotated-tag verification, GitHub Release metadata creation, no-republish reconciliation, and truthful partial-state summaries. No live publication or remote mutation was performed.

## Files Changed

- `.github/workflows/release.yml` — Added the read-only `remote_state` refresh, release-only `publish` job, least-privilege `metadata` job, exact annotated-tag creation/verification, generated-note Release creation, fixed installer footer reconciliation, metadata artifacts, and always-run blocked/partial summaries.
- `tests/release-workflow.test.ts` — Added parsed workflow-contract coverage for permissions, accepted publish reachability, exact remote-state checks, reconcile no-republish behavior, tag/Release ordering, generated notes, footer guidance, mismatch rejection, and partial recovery.
- `.spec-finder/tasks/npm-release-automation/memory/MEMORY.md` — Promoted durable task-04 workflow and task-05 handoff facts.
- `.spec-finder/tasks/npm-release-automation/memory/task_04.md` — Recorded task decisions, corrections, exact verification results, and external-gate limitations.

No public CLI, ACP, configuration, installer command, or release-helper contract changes were made. Existing unrelated dirty-worktree changes were preserved.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Permit `npm publish --access public` only for `release` after accepted preflight proves the exact version is absent; use OIDC without a long-lived token fallback. | Satisfied | `publish` requires successful accepted `preflight`, `remote_state.outputs.action == 'publish'`, and `inputs.mode == 'release'`; its only write authority is `id-token: write`, it runs `npm publish --access public --provenance`, and workflow tests assert no npm token fallback. |
| 2. Require `reconcile` to prove the exact npm version is published and never republish. | Satisfied | `remote_state` queries the exact npm version and classifies absent/published/mismatch state; `metadata` reconciliation requires published npm plus a non-blocked state, while its job and every non-publish job contain no reachable `npm publish` command. |
| 3. Create/verify an annotated `v<version>` tag at the reviewed SHA before a GitHub Release; reject mismatches without force updates. | Satisfied | Metadata creates an annotated tag only when absent, fetches and verifies tag type and `FETCH_HEAD^{commit}` against the reviewed SHA, then invokes `gh release create --verify-tag`; tag and Release identity mismatches fail closed and no force/clobber operation is present. |
| 4. Create generated notes plus the repository-owned package/install/upgrade footer and preserve distinct partial state. | Satisfied | GitHub Release creation uses `--generate-notes`; `formatReleaseFooter` supplies the package URL, global install command, and `spec-finder upgrade`; final body validation checks the footer, and release/reconcile metadata failures produce `Result: partial` with explicit reconcile/no-republish guidance. |

## Verification

| Command/check | Result | Terminal evidence |
|---|---|---|
| `bun test tests/release-workflow.test.ts` | Passed, exit 0 | 8 tests passed, 0 failed, 117 expectations. |
| `actionlint .github/workflows/release.yml` | Passed, exit 0 | Workflow syntax, expressions, and shell checks completed without diagnostics. |
| `bun run release:check` | Passed, exit 0 | Printed `release:check passed: spec-finder@0.1.0 (35 packed paths)`. |
| `bun run verify` | Passed, exit 0 | Typecheck passed; 264 tests passed, 0 failed, 1,451 expectations; Bun bundled 27 modules successfully. |

## Unresolved Risks and Follow-ups

- Static workflow checks do not prove hosted GitHub Actions execution, artifact service behavior, GitHub token enforcement, npm namespace ownership, npm trusted-publisher/OIDC exchange, registry race behavior, remote tag writes, or GitHub Release API behavior.
- The first real release still requires external npm trusted-publisher configuration for the exact repository/workflow filename and confirmation of package ownership and GitHub permissions.
- Task 05 must add Ubuntu/Windows clean-install smoke and final complete/partial aggregation. Task 04 intentionally reports public metadata readiness as partial until that later platform gate exists.
- Published npm versions remain immutable; duplicate-version or post-publication failures require inspection and explicit reconciliation, not automatic rollback or republish.
- The repository remains broadly dirty from unrelated user-owned changes; no staging, commit, or cleanup was performed.

## Final Verdict

**Completed.** The task-04 implementation and local contract evidence satisfy all four numbered requirements. The task frontmatter remains runtime-owned and was not changed; no live publication was claimed or performed.
