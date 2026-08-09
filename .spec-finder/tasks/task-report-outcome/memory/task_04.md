# Task Memory: task_04

## Objective Snapshot

- Project safe phase, activity, and completed-reference data into immutable
  cockpit state without changing console/no-UI emission.

## Important Decisions

- Store validates display shape defensively but never becomes path/outcome
  authority; active-packet qualification remains intact.

## Learnings

- `CockpitStore` owns task reasons and transcript entries while commands own
  the separate no-UI listener.

## Files / Surfaces

- `src/ui/store.ts`, `tests/store.test.ts`, `tests/commands.test.ts`.

## Errors / Corrections

- None yet.

## Ready for Next Run

- Hand safe completed task state to task_05 for terminal rendering evidence.
