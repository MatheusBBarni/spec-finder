# Task Memory: task_04

## Objective Snapshot

- Render exact, accessible, scrollable diagnostics in the retained final failure review.

## Important Decisions

- Use the task 02 selector for full detail and the task 01 dismissal callback; do not add workflow controls.

## Learnings

- Existing OpenTUI scrollbox patterns and frame/mock-input coverage are in `src/ui/App.tsx` and `tests/cockpit.test.tsx`.

## Files / Surfaces

- `src/ui/App.tsx` and `tests/cockpit.test.tsx`.

## Errors / Corrections

- The implementation handoff did not include exact terminal results in task
  memory, so the two task-mandated gates were rerun during the report phase.

## Verification

- `rtk bun test tests/cockpit.test.tsx` exited 0: 34 tests passed, 0 failed,
  and 313 `expect()` calls across one file.
- `rtk bun run verify` exited 0: TypeScript check passed, 318 tests passed
  with 0 failures and 1,897 `expect()` calls across 29 files, and the Bun
  build bundled 28 modules into `dist/cli.js` (0.34 MB).
- `rtk git diff --check` exited 0.

## Report Handoff

- The final report is ready; task status and report lifecycle remain
  Spec-Finder-owned. Task 05 still owns macOS PTY/manual release evidence.

## Ready for Next Run

- Require tasks 01 and 02 plus integrated ordered-multiple cockpit work before editing the final review surface.
