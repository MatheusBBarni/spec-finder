# Task Memory: task_03

## Objective Snapshot

Add additive batch lifecycle events and active-packet cockpit store projection.

## Important Decisions

- Do not forward nested packet `run_started`/`run_finished` to the batch store.
- Qualify internal task/transcript keys by packet slug while preserving legacy single-run payloads.
- Emit additive batch lifecycle events from the coordinator with declared order, packet index, packet tasks, compact outcome/detail, and aggregate summaries.
- Keep inactive packet detail out of the current `CockpitState` projection; selectors resolve the active packet's qualified internal key while retaining bare task IDs for single-run consumers.

## Learnings

- Store reset behavior and bare task IDs are the primary collision hazards.
- Batch packet boundaries are sufficient to serialize active task/activity/session projection; stale events carrying another packet's qualified task key are ignored.

## Files / Surfaces

- `src/events.ts`
- `src/batch.ts`
- `src/ui/store.ts`
- `tests/store.test.ts`

## Errors / Corrections

- The canonical `sf-memory` reference is under `skills/sf-memory/references/memory-guidelines.md`; the copied `.agents/skills` path has only the entrypoint.

## Ready for Next Run

- Command and cockpit integrations can consume the additive batch events and state contract after the focused store and repository gates pass.
- Final verification rerun on 2026-08-08 passed: `rtk bun test ./tests/store.test.ts` (12 tests, 62 expectations), `rtk bun run check` (exit 0), `rtk bun run verify` (90 tests, 414 expectations, 17-module build at 105.69 KB), and `rtk git diff --check` (clean).
- No task-scoped verification blocker remains; task frontmatter and report lifecycle remain Spec Finder-owned, and unrelated dirty files were preserved.
