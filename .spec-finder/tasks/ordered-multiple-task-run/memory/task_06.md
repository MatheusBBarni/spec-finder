# Task Memory: task_06

## Objective Snapshot

Publish the batch CLI contract and complete release verification/evidence.

## Important Decisions

- Document only the approved opt-in grammar and fail-safe/manual-recovery scope.
- Keep the existing single-slug and `--no-ui` examples visible while documenting the additive batch branch.

## Learnings

- README currently documents one slug and `--no-ui`; both need explicit batch additions without removing existing examples.
- `src/cli.tsx` help now exposes exactly one `--multiple <slug1,slug2,...>` list, the supported runtime flags, strict rejection rules, outcome vocabulary, no-retry/manual recovery, and the persistence/rollback/resume/parallelism/telemetry non-goals.
- README now mirrors the parser and command contract: serial fail-fast execution, distinct `failed`/`cancelled`/`not_started`, already-complete success, aggregate exit codes, and earlier-success durability.
- `tests/cli.test.ts` captures `main(["help"])` safely and asserts both single-slug and batch discoverability, supported flags, rejection wording, outcomes, and absence of retry/parallel options.
- Final report-phase rerun on 2026-08-08 passed: `rtk bun test ./tests/cli.test.ts ./tests/commands.test.ts ./tests/batch.test.ts ./tests/store.test.ts ./tests/cockpit.test.tsx` — 67 tests, 401 expectations, 0 failures; `rtk bun run check` exited 0; `rtk bun run verify` passed 102 tests, 517 expectations, 0 failures and bundled 18 modules; `rtk proxy git diff --check` was clean.
- The rebuilt `dist/cli.js` help command exited 0 and printed the single-slug and exact `--multiple` grammar, supported flags, rejection rules, outcomes, manual recovery, and non-goals.
- Fresh three-packet acceptance smoke through `runCommand` and the real `runBatch` with an injected runner used `ordered-multiple-task-run`, `read-only-progress-navigator`, and `tui-demo`: all-success exited 0; middle failure exited 1 with the second packet stopping and the third `not_started`; middle cancellation exited 1 with the same stop boundary and distinct cancellation wording. Both stopped runs emitted no-retry/manual-rerun guidance.

## Files / Surfaces

- `src/cli.tsx`
- `README.md`
- `tests/cli.test.ts` (create)

## Errors / Corrections

- None recorded.
- `tests/cli.test.ts` imports `main`; `src/cli.tsx` now guards its executable entrypoint with `import.meta.main` so importing help does not run the CLI process body.

## Ready for Next Run

- Implementation and release verification are complete. The human 4-of-5 stopping-packet usability measurement for M-03 remains an explicit release follow-up; do not claim it as performed.
