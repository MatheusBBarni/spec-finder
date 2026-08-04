# Task Memory: task_05

## Objective Snapshot

- Define the pure, monotonic, ephemeral timer contract for the read-only progress navigator.

## Important Decisions

- Use the approved ADR-006 store handoff: timer math remains independent of OpenTUI, ACP, engine, and persistence.
- Preserve `—`, `unavailable`, and total-minute `MM:SS` semantics from the approved TechSpec.

## Learnings

## Files / Surfaces

- `src/ui/timer.ts` — planned pure timer module.
- `tests/timer.test.ts` — planned deterministic timer suite.

## Errors / Corrections

## Ready for Next Run

- `task_06` may consume the timer helpers after this task's focused and repository gates pass.
