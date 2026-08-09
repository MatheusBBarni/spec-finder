# Task Memory: task_03

## Objective Snapshot

- Make report metadata non-renderable and preserve a bounded diagnostic fallback
  for unrelated unknown ACP updates.

## Important Decisions

- Report session-info is suppressed; implementation or missing-phase session-info
  remains payload-free.

## Learnings

- Transcript projection is a pure seam and can supply narrow display formatting
  to cockpit state without duplicating sanitization.

## Files / Surfaces

- `src/ui/transcript.ts`, `tests/transcript.test.ts`.

## Errors / Corrections

- None yet.

## Ready for Next Run

- Hand phase-aware projection and display-safety helper behavior to task_04.
