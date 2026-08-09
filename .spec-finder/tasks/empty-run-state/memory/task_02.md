# Task Memory: task_02

## Objective Snapshot

- Project task_01's typed no-work fact into a persistent, read-only cockpit
  summary and provide the exit signal task_03 will await.

## Important Decisions

- Generic terminal summaries remain the fallback when no typed metadata exists.
- App owns Q/Ctrl+C; the cockpit handle exposes a one-shot exit wait.

## Learnings

- The store suppresses nested singular lifecycle events while batch projection
  is active; keep that guard intact.

## Files / Surfaces

- `src/ui/store.ts`, `src/ui/App.tsx`, `src/ui/cockpit.tsx`, and their tests.

## Errors / Corrections

- None yet.

## Ready for Next Run

- Start only after task_01 is complete; preserve existing navigation,
  transcripts, batch projection, and text-based accessibility coverage.
