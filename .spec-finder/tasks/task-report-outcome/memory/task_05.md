# Task Memory: task_05

## Objective Snapshot

- Render and prove text-labelled final-report outcomes and safe references in
  the existing OpenTUI cockpit.

## Important Decisions

- App consumes only safe store state and does not inspect ACP/provider payloads
  or create batch report-reference history.

## Learnings

- `testRender` frame capture is the approved visual acceptance boundary; a live
  provider is not a release gate.

## Files / Surfaces

- `src/ui/App.tsx`, `tests/cockpit.test.tsx`.

## Errors / Corrections

- None yet.

## Ready for Next Run

- Verify normal and reduced-color frames, preserve read-only controls, and
  record final evidence in the runtime-owned report.
