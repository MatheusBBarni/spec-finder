# Task Memory: task_06

## Objective Snapshot

- Integrate the approved pure timer contract into the existing immutable `CockpitStore` projection.

## Important Decisions

- Timer state is keyed by stable task ID, resets on `run_started`, advances through explicit store ticks, and never changes raw runtime events.
- Preserve active/selected/follow state, transcripts, run metadata, and read-only permission isolation.

## Learnings

## Files / Surfaces

- `src/ui/store.ts` — planned timer state and lifecycle integration.
- `tests/store.test.ts` — planned controlled-clock store coverage.

## Errors / Corrections

## Ready for Next Run

- `task_07` may render timer snapshots and call `tick()` after this task's store contract and verification pass.
