# Task Memory: task_05

## Objective Snapshot

- Implemented and locally verified the isolated Ubuntu/Windows post-publication smoke matrix and always-run text-first release summary.

## Important Decisions

- Kept task-04's publication, tag, Release, and no-republish reconciliation jobs unchanged; smoke depends on successful public metadata and never checks out or executes the source tree.
- Used separate Bash and PowerShell steps so native Windows invokes the installed command path and the existing `npm.cmd` selection inside `spec-finder upgrade` remains exercised.
- Before calling `spec-finder upgrade`, smoke requires `npm view spec-finder@latest version` to equal the candidate; a newer stable version therefore cannot be misreported as exact-version upgrade evidence.
- Final summary downloads `smoke-ubuntu` and `smoke-windows` artifacts and delegates public-link validation and exactly-one-recovery-action wording to `formatSummary`.
- When a metadata job fails after a matching remote artifact was observed, the summary derives only the fixed package/tag/Release URLs from the validated state; mismatches and absent artifacts remain unavailable.

## Learnings

- A matrix child writes a small `spec-finder.platform-smoke` JSON artifact in an `always()` evidence step; missing or version-mismatched artifacts become `not_run`/`failed` in the final summary.
- Summary result classification is blocked for failed preflight or blocked remote identity, partial for metadata/package/smoke gaps, and complete only when all public links and both platform artifacts pass.

## Files / Surfaces

- `.github/workflows/release.yml`: smoke matrix, isolation setup, installed-command probes, evidence artifacts, and final aggregation.
- `tests/release-workflow.test.ts`: parsed matrix/isolation/command/completion-policy assertions.

## Errors / Corrections

- `actionlint` initially reported shellcheck `SC2016` for the single-quoted embedded Bun summary formatter; an inline directive immediately before that command now suppresses the intentional template-literal interpolation warning.

## Ready for Next Run

- Focused `bun test tests/release-workflow.test.ts` passed: 11 tests, 171 expectations.
- `actionlint .github/workflows/release.yml` passed with no diagnostics.
- `bun run release:check` passed for `spec-finder@0.1.0` with 35 packed paths.
- `bun run verify` passed: typecheck, 267 tests, 1,505 expectations, and Bun build.
- No live publication or hosted platform run was performed; the final report distinguishes static workflow evidence from the external Ubuntu/Windows and trusted-publisher gate, while task status remains runtime-owned.
