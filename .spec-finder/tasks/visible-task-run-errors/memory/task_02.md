# Task Memory: task_02

## Objective Snapshot

- Preserve exact failed-task activity messages separately from compact task reasons.

## Important Decisions

- Exact detail is ephemeral store state and uses existing packet-qualified task keys.

## Learnings

- Newline-split transcript entries cannot be the canonical full surfaced message.

## Files / Surfaces

- `src/ui/store.ts` and `tests/store.test.ts`.

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Verify ordered-multiple tasks 03–05 are integrated before editing shared store projection surfaces.
