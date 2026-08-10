# Task Memory: task_05

## Objective Snapshot

- Render and prove text-labelled final-report outcomes and safe references in
  the existing OpenTUI cockpit.

## Important Decisions

- App consumes only safe store state and does not inspect ACP/provider payloads
  or create batch report-reference history.
- The task status strip renders `Task completed`/`Task failed` text and shows a
  stored `Report: <relative reference>` only when the completed cockpit task
  carries one. The single-packet terminal summary uses a `RUN.REPORTS` section;
  batch summaries remain packet-level and do not aggregate report references.

## Learnings

- `testRender` frame capture is the approved visual acceptance boundary; a live
  provider is not a release gate.
- Report-phase session metadata is already suppressed by the store/transcript
  projection, so frame safety assertions can inject the reused `test-session`
  metadata directly and verify that prompt, absolute path, controls, and
  provider `blocked` prose remain absent.
- At reduced width, the safe reference wraps across frame rows; acceptance
  checks must assert its visible labelled segments rather than require one
  unwrapped line.

## Files / Surfaces

- `src/ui/App.tsx`, `tests/cockpit.test.tsx`.
- `App.tsx` keeps Escape/Q/read-only controls and existing batch summary
  ownership unchanged while adding outcome/reference presentation.

## Errors / Corrections

- The first reduced-color frame assertion required the full reference on one
  line, but the responsive 80-column frame wraps it. It was corrected to assert
  both visible reference segments while preserving the exact label contract.

## Ready for Next Run

- Focused `rtk bun test tests/cockpit.test.tsx` passed with 34 tests and 313
  expectations. `rtk bun run check` passed. Full `rtk bun run verify` passed
  with 314 tests, 0 failures, 1,864 expectations, and a successful 28-module
  Bun bundle. Task status and report ownership remain with Spec Finder.
- Final-report handoff is supported by the fresh evidence above; no
  implementation or verification rerun is required unless the report changes
  testable files.
