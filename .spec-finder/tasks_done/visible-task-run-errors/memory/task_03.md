# Task Memory: task_03

## Objective Snapshot

- Apply the outcome-aware session wait and two-stream TTY eligibility to single and batch commands.

## Important Decisions

- Only non-aborted single failures and batch `status: "failed"` wait for dismissal.
- Shared `createCommandLifecycle` owns eligibility, one controller, session startup, guarded idempotent close, and the active-cancellation abort/close path for both command modes.
- The batch command consumes existing `BatchResult.status` values only; `src/batch.ts` and `src/events.ts` remain untouched.

## Learnings

- `RunCommandOptions` currently injects output but not input; add only the input TTY seam required for deterministic tests.
- The input seam was already present in the baseline; command lifecycle now uses it with output TTY state through an explicit `isInteractiveRun` helper. Console listeners remain the complete ineligible failure path.
- A cancellation callback must close the session before a runner settles; a close guard prevents duplicate fake-session close calls when `finally` runs afterward.

## Files / Surfaces

- `src/commands.ts` and `tests/commands.test.ts`.
- `src/commands.ts` now centralizes the duplicated single/batch session policy; `tests/commands.test.ts` covers both TTY streams, `--no-ui`, console failure output, failure dismissal, active cancellation, outcome bypasses, and thrown runner/coordinator cleanup.

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Focused evidence passed: `rtk bun test tests/commands.test.ts` — 25 tests, 0 failures, 126 assertions.
- Repository evidence passed: `rtk bun run verify` — TypeScript check, 318 tests, 1,897 assertions, and Bun build all exited successfully.
- Task 04 may consume the retained session/store contracts; task 05 still owns native macOS PTY evidence. Runtime-owned task status and `reports/task_03.md` were intentionally left unchanged.
- Final-report phase received the fresh implementation handoff; no verification rerun was required, and the report must preserve the runtime-owned task status.
