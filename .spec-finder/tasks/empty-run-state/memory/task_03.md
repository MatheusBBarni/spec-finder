# Task Memory: task_03

## Objective Snapshot

- Integrate typed no-work behavior into the singular command's no-UI output and
  conditional interactive retention without widening batch behavior.

## Important Decisions

- Inspect `result.outcome`, never completion text, to choose retention.
- Await the cockpit only for interactive typed no-work; all other terminal
  paths retain existing cleanup timing.

## Learnings

- The current command test seam can inject output, engine runner, and cockpit
  startup; retain existing batch/setup coverage when adapting handle types.

## Files / Surfaces

- `src/commands.ts`, `tests/commands.test.ts`, and batch compatibility tests.

## Errors / Corrections

- None yet.

## Ready for Next Run

- Start only after task_01 and task_02 are complete. Preserve the user-owned
  batch route and its `already_complete` output semantics.
