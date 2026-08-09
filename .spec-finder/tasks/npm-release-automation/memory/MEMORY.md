# Workflow Memory

## Current State

- Task 01's pure release-contract layer and deterministic Bun coverage are implemented and verified; its evidence report is written while lifecycle status remains runtime-owned.
- Task 02's local no-publish runner and `release:check` package script are implemented and verified; task status and final report remain runtime-owned.
- Task 03's manual read-only release workflow and static policy coverage are implemented and verified; task status and final report remain runtime-owned.
- Task 04's release-only publication, remote-state refresh, annotated-tag/Release metadata reconciliation, and static policy coverage are implemented and locally verified; task status and final report remain runtime-owned.
- Task 05's workflow extension now defines post-publication Ubuntu/Windows matrix smoke, per-platform isolated npm evidence artifacts, and one always-run `formatSummary` aggregation boundary; focused policy tests, `actionlint`, `release:check`, and `verify` pass locally, while task status remains runtime-owned and the report phase records the absent hosted run.
- Task 06's README runbook now documents the final `main`-only dispatch procedure, trusted-publisher prerequisites, `release`/`reconcile` boundaries, complete/blocked/partial summaries, retained evidence artifacts, and manual corrective recovery; local workflow tests, `release:check`, and `verify` pass while hosted release evidence remains external.

## Shared Decisions

- The release identity is fixed to `spec-finder`, stable SemVer, and `v<version>`; source identity, when supplied, must be the full commit SHA on `refs/heads/main`.
- Packed paths are fail-closed against an explicit allowlist (`package/package.json`, `dist/**`, `skills/**`, `README.md`, `LICENSE`) and normalize npm's optional `package/` tarball prefix.
- `release` may authorize publication only when npm, tag, and GitHub Release are all absent; `reconcile` requires an already-published npm version and never authorizes `npm publish`.
- Summary/footer helpers emit only fixed public package/repository links and installer commands; invalid URLs or action text are not interpolated.
- The task 03 workflow accepts only `release` or `reconcile` dispatch modes from `refs/heads/main`, serializes a full source identity, and exposes an accepted `release-candidate` handoff only after both local gates and artifact upload pass.
- Workflow jobs default to no permissions and currently use only job-level `contents: read`; action references are immutable reviewed SHA pins with version comments, and no npm credential is carried.
- Task 04 extends the handoff with a read-only `remote_state` refresh, a release-only `publish` job (`id-token: write` and `npm publish --access public --provenance`), and a separate `metadata` job (`contents: write`) that creates/verifies the exact annotated tag before generated-note GitHub Release creation and footer reconciliation.
- Reconciliation is gated on published exact npm state plus a non-blocked state and contains no reachable npm publish command; mismatched tag/Release identities stop before any force/update operation, while post-publication metadata failures remain `partial` and direct the maintainer to reconcile without republishing.
- Task 05 smoke runs with no source checkout on `ubuntu-latest` and `windows-latest`, creates a runner-temp workspace/home-or-profile/global npm prefix/cache, prepends the platform executable path, installs `spec-finder@<version>`, and checks `version`, `setup`, `@latest` identity, and `upgrade` from that isolated state.
- Task 05's final summary downloads the matrix evidence artifacts and uses the existing `formatSummary` contract; `complete` requires accepted preflight, non-blocked remote state, successful publication/reconciliation metadata, all three public links, and both smoke artifacts reporting the candidate version as passed.
- Task 06 preserves the installer contract (`npm install --global spec-finder`, `spec-finder upgrade` → `spec-finder@latest`) and explicitly tells maintainers to use exact-version deprecation, corrective releases, and GitHub Release updates instead of rollback, unpublish, force-updates, or token fallback.

## Shared Learnings

- `scripts/release/contract.ts` is imported by `tests/release-helpers.test.ts`, which keeps the current TypeScript include policy checking the helper surface.
- `npm pack --dry-run --json` can prefix its JSON array with `prepack` progress output; `scripts/release/check.ts` parses the package report after that progress and then delegates identity/path validation to the task 01 helpers.
- The workflow policy is parsed with the repository's `yaml` dependency; static tests assert dispatch, source guard, concurrency, action pins, permissions, gate ordering, artifact shape, and always-run blocked summary without emulating hosted Actions.
- Static workflow coverage now asserts release-only publish reachability, exact npm/tag/Release refresh, reconcile no-republish behavior, annotated-tag ordering, generated notes plus the fixed installer footer, mismatch rejection, and release/reconcile partial recovery summaries.

## Open Risks

- Live npm, GitHub, OIDC, tag, Release, and platform-smoke behavior remains an external gate for later workflow tasks; local verification proves only the pure contract.
- Task 05 local static tests and actionlint cannot prove GitHub-hosted Ubuntu/Windows execution, npm propagation to `@latest`, or the first trusted-publisher release; those remain explicit external evidence gates.
- Task 06's local documentation review and gates do not add live OIDC, npm, GitHub Release, or Windows evidence; the first such evidence must come from the GitHub Actions run.
- The task 03 candidate artifact deliberately leaves `state.remoteState` unset and `mutationEligible` false; task 04 now consumes it through an ephemeral classified `release-state` artifact before mutation.
- The task 04 remote-state artifact is an ephemeral `spec-finder.release-state` handoff classified by `scripts/release/contract.ts`; downstream jobs must revalidate the candidate and refresh the external identity again before mutation.

## Handoffs

- Task 02 should reuse `validateCandidate` and `validatePackedPaths` for local `npm pack --dry-run --json` validation without adding network or mutation behavior.
- Task 03 can invoke `bun run release:check`; the command exposes only `npm pack --dry-run --json`, uses offline npm cache settings, and has no publish, Git, GitHub, or credential command path.
- Task 05 owns the completed `metadata`/`summary` extension with Ubuntu/Windows smoke and final complete/partial aggregation; Task 06's README preserves the no-republish reconcile gate and documents the fixed package/install/upgrade footer.
- Task 06's README is the operator-facing handoff for the final workflow; lifecycle status and the final report remain runtime-owned.
- Task 06's README documents the final summary's single recovery action, `blocked` versus `partial` interpretation, the `@latest` precondition for upgrade evidence, and the retained Ubuntu/Windows smoke artifacts.
