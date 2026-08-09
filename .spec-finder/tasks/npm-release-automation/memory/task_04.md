# Task Memory: task_04

## Objective Snapshot

- Implemented the release-only npm publication boundary and the additive tag/GitHub Release reconciliation path; final report and lifecycle status remain Spec Finder-owned.

## Important Decisions

- Kept public mutation in three distinct workflow jobs: `remote_state` refreshes exact npm/tag/Release identity, `publish` alone has `id-token: write` and can run `npm publish --access public --provenance`, and `metadata` alone has `contents: write`.
- Used `classifyState` outputs as the mutation boundary: release publishes only `action=publish`; reconcile requires published npm plus a non-blocked state and never contains an npm publish command.
- Created/verified annotated tags with the reviewed source SHA before `gh release create --verify-tag --generate-notes`; appended the fixed `formatReleaseFooter` guidance only after matching Release identity checks.

## Learnings

- `actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093` is pinned with the official `v4.3.0` comment alongside the existing reviewed action pins.
- A post-publish metadata failure must be summarized as `partial` with reconcile/no-republish guidance for both release and reconcile dispatches; relying only on `publish.result == success` misses reconcile recovery failures.
- `GH_TOKEN: ${{ github.token }}` is needed for `gh api`/`gh release` calls; it is separate from npm publishing and does not introduce a long-lived npm credential.

## Files / Surfaces

- `.github/workflows/release.yml` — remote-state refresh, release-only publish, exact annotated-tag and generated-note Release orchestration, footer verification, metadata artifact, and always-run blocked/partial summaries.
- `tests/release-workflow.test.ts` — parsed workflow policy assertions for permissions, accepted publish reachability, no-republish reconcile, tag/release ordering, footer, mismatch, and partial recovery.

## Errors / Corrections

- Initial actionlint findings were caused by inline Bun snippets and ungrouped footer appends; added targeted shellcheck directives and grouped the body writes without changing workflow behavior.
- The first partial-summary condition handled only release publication; widened it to include reconcile metadata failures when npm is already published.

## Ready for Next Run

- Final handoff evidence is terminal-complete: focused workflow policy test passed with 8 tests and 117 expectations; `actionlint` exited 0; `bun run release:check` exited 0 and reported `spec-finder@0.1.0 (35 packed paths)`; `bun run verify` exited 0 with 264 tests, 1,451 expectations, and a successful Bun build.
- Report phase may write `reports/task_04.md` only; do not run a live npm publish, alter task frontmatter, or claim external OIDC/npm/GitHub/tag behavior. Task 05 can add platform smoke and final completion aggregation on top of the `metadata`/`summary` handoff.
