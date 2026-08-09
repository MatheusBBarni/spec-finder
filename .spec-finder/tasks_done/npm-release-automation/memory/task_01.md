# Task Memory: task_01

## Objective Snapshot

- Implemented deterministic candidate, packed-path, remote-state, installer-footer, and summary helpers in `scripts/release/contract.ts` with focused Bun coverage.

## Important Decisions

- Candidate validation fixes the package identity to `spec-finder`, rejects prerelease SemVer and mismatched `v<version>`/`refs/heads/main` values, and validates optional full commit SHA and packed paths without reading or mutating anything.
- The packed contract requires package metadata, `dist/cli.js`, README, LICENSE, and at least one skill path; one npm `package/` prefix is normalized before allowlisting.
- State classification exposes `ready`/`publish`, `reconcile`, `complete`, and `blocked` outcomes. Reconciliation is never publish-capable, and mismatches fail closed.
- Complete summaries require public artifact links, source identity, preflight success, and both Ubuntu/Windows smoke passes; partial/blocked summaries select one fixed recovery action and omit unsafe input.

## Learnings

- The helper module is reached from the test suite so `bun run check` type-checks `scripts/release/` under the repository's existing include policy.
- The first focused run caught only an assertion wording mismatch in the new test; after correcting the fixture expectation, the focused suite passed.

## Files / Surfaces

- Added `scripts/release/contract.ts` and `tests/release-helpers.test.ts`.
- No package scripts, CLI, ACP, config, workflow, or lifecycle artifacts were changed.

## Errors / Corrections

- No implementation or verification failures remain. The earlier focused-test assertion expected `unavailable` while the formatter intentionally renders missing artifact state as `not available`; the test now matches the contract.

## Ready for Next Run

- Focused gate: `bun test tests/release-helpers.test.ts` passed.
- Repository gate: `bun run verify` passed (check, 248 tests, build).
- Final-report phase reviewed the packet artifacts, ADRs, current diff, and these exact terminal results; no verification rerun was needed because the handoff evidence was fresh and complete.
- `reports/task_01.md` is written with a completed verdict; task frontmatter remains runtime-owned and intentionally unchanged.
