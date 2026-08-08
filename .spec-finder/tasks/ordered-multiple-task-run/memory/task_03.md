# Task Memory: task_03

## Objective Snapshot

Add additive batch lifecycle events and active-packet cockpit store projection.

## Important Decisions

- Do not forward nested packet `run_started`/`run_finished` to the batch store.
- Qualify internal task/transcript keys by packet slug while preserving legacy single-run payloads.

## Learnings

- Store reset behavior and bare task IDs are the primary collision hazards.

## Files / Surfaces

- `src/events.ts`
- `src/ui/store.ts`
- `tests/store.test.ts`

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Command and cockpit integrations can consume the batch state contract after transition/isolation tests pass.
