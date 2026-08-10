# Task Memory: task_02

## Objective Snapshot

- Extend `CockpitStore` into a task-aware, view-selectable cockpit model using the transcript helper from `task_01`.

## Important Decisions

- Keep `activeTaskId` and `selectedTaskId` distinct.
- Manual selection disables follow mode; selecting the active task restores it.
- Preserve the existing permission state temporarily so the current App remains buildable until `task_04` removes the legacy modal.
- Initialize every task transcript on `run_started` and use one store-local sequence across task and run projections; a new run resets the entire store and sequence.
- Keep taskless activity in `runActivity` and runtime option outcomes in `runtimeOptions`; retain the old `activity` array only as an uncapped compatibility surface for the current App.
- Add fallback failure/blocked entries at terminal status time, then upgrade failed-task summary reasons from the first meaningful line of later error activity.

## Learnings

- `CockpitTask` must retain normalized dependency IDs because `RunEvent.task_status` does not include dependency context.
- Task 01's immutable helper can identify the changed normalized entry by reference when mirroring temporary legacy activity, avoiding a second ACP update formatter.

## Files / Surfaces

- `src/ui/store.ts` — state, event projection, navigation actions, reason derivation.
- `tests/store.test.ts` — state and action contracts.

## Errors / Corrections

## Ready for Next Run

- The 2026-08-04 final-report phase re-ran `bun test tests/transcript.test.ts tests/store.test.ts`: 15 tests passed across 2 files, 0 failed, with 68 expectation calls.
- The same phase re-ran `bun run check`; `tsc --noEmit` exited 0 with no diagnostics.
- The same phase re-ran the exact `bun run verify`: 44 tests passed across 13 files, 0 failed, with 153 expectation calls, followed by a successful 17-module production build.
- Final boundary checks exited 0: `git diff --check` was clean, and the protected-file diff showed no task-owned changes to `src/events.ts`, `src/tasks.ts`, `src/ui/App.tsx`, `package.json`, `bun.lock`, `src/engine.ts`, `src/acp-client.ts`, or `src/commands.ts`.
- Keep App-facing method names and snapshot behavior deterministic; do not add execution actions to the store.
