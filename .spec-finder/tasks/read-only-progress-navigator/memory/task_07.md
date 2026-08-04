# Task Memory: task_07

## Objective Snapshot

- Render and verify the integrated task timer in the completed read-only OpenTUI cockpit.

## Important Decisions

- Reuse the existing spinner/live-render lifecycle and keep timer updates observational.
- Preserve task identity, status, selection, transcript context, read-only controls, compact hierarchy, and reduced-color semantics.

## Learnings

## Files / Surfaces

- `src/ui/App.tsx` — planned timer row, tick, help, and cleanup integration.
- `tests/cockpit.test.tsx` — planned fixed-frame, input, lifecycle, and terminal evidence.

## Errors / Corrections

## Ready for Next Run

- Preserve protected runtime and dependency boundaries while adding timer presentation and evidence.
