# Task Memory: task_01

## Objective Snapshot

- Establish the command-owned cockpit session and callback-only keyboard lifecycle.

## Important Decisions

- The command will later own session waiting and teardown; App requests cancellation or dismissal only.

## Learnings

- Existing App keyboard handlers directly destroy the renderer and must be covered by component tests when changed.

## Files / Surfaces

- `src/ui/cockpit.tsx`, `src/ui/App.tsx`, and `tests/cockpit.test.tsx`.

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Verify ordered-multiple tasks 03–05 are integrated before editing shared UI surfaces.
