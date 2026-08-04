# Task Memory: task_02

## Objective Snapshot

- Extend `CockpitStore` into a task-aware, view-selectable cockpit model using the transcript helper from `task_01`.

## Important Decisions

- Keep `activeTaskId` and `selectedTaskId` distinct.
- Manual selection disables follow mode; selecting the active task restores it.
- Preserve the existing permission state temporarily so the current App remains buildable until `task_04` removes the legacy modal.

## Learnings

## Files / Surfaces

- `src/ui/store.ts` — state, event projection, navigation actions, reason derivation.
- `tests/store.test.ts` — state and action contracts.

## Errors / Corrections

## Ready for Next Run

- Keep App-facing method names and snapshot behavior deterministic; do not add execution actions to the store.
