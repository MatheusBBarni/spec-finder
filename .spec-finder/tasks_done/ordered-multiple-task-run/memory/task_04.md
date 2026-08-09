# Task Memory: task_04

## Objective Snapshot

Integrate batch routing, shared command lifecycle, no-UI output, and aggregate exit status.

## Important Decisions

- Preserve the existing single-slug branch behaviorally unchanged.
- Keep one renderer/store/controller per batch invocation.
- Parse `--multiple` before workspace/config/renderer setup; invalid batch grammar fails without invoking any lifecycle dependency.
- Use additive batch events for no-UI output, never nested `run_started`/`run_finished`; print the stopping packet, later `not_started` packets, and explicit manual no-retry guidance.
- Map only an all-`succeeded` `completed` aggregate to exit `0`; preflight failure, failure, cancellation, and malformed result shapes map to exit `1`.

## Learnings

- The current first-non-flag slug discovery is unsafe for batch option values.
- `runCommand` now has a narrow injected dependency seam for command/coordinator and renderer lifecycle tests; defaults retain the production loader, coordinator, engine, and cockpit.

## Files / Surfaces

- `src/commands.ts`
- `tests/commands.test.ts`

## Errors / Corrections

- Final-report refresh on 2026-08-08: `rtk bun test ./tests/commands.test.ts ./tests/batch.test.ts` exited `0` with 34 pass, 0 fail, and 121 expectations; `rtk bun run check` exited `0`; `rtk bun run verify` exited `0` with 97 pass, 0 fail, and 456 expectations across 14 files, plus an 18-module Bun build; `rtk git diff --check` exited `0`.
- Final-report refresh also ran a non-interactive three-packet coordinator sequence for `ordered-multiple-task-run`, `read-only-progress-navigator`, and `tui-demo` with an injected no-op packet runner; it emitted ordered `1/3`, `2/3`, and `3/3` starts, succeeded outcomes, aggregate exit `0`, and no provider launch.

## Ready for Next Run

- Help/README and release evidence can document the implemented public behavior. Spec Finder still owns task status and `reports/task_04.md`; task frontmatter remains `in_progress`.
