# Task Memory: task_03

## Objective Snapshot

- Apply the outcome-aware session wait and two-stream TTY eligibility to single and batch commands.

## Important Decisions

- Only non-aborted single failures and batch `status: "failed"` wait for dismissal.

## Learnings

- `RunCommandOptions` currently injects output but not input; add only the input TTY seam required for deterministic tests.

## Files / Surfaces

- `src/commands.ts` and `tests/commands.test.ts`.

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Require task 01 plus integrated ordered-multiple command/event work before changing command lifecycle code.
