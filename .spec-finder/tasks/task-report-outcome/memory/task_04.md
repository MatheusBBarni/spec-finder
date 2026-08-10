# Task Memory: task_04

## Objective Snapshot

- Project safe phase, activity, and completed-reference data into immutable
  cockpit state without changing console/no-UI emission.

## Important Decisions

- Store validates display shape defensively but never becomes path/outcome
  authority; active-packet qualification remains intact.
- `CockpitTask.reportReference` is projected only from an exact `completed`
  status and a slash-separated, relative, control-free reference. Any other
  status or invalid reference clears the optional field and omits the
  transcript detail.
- Task activity is passed through transcript `formatDisplayText` before it is
  stored as cockpit activity, failure detail, or a task reason; engine and
  no-UI event payloads remain unchanged.

## Learnings

- `CockpitStore` owns task reasons and transcript entries while commands own
  the separate no-UI listener.
- Phase must be forwarded from each `session_update` event into
  `applySessionUpdate` so reused provider session IDs cannot merge report and
  implementation transcript chunks.

## Files / Surfaces

- `src/ui/store.ts`, `tests/store.test.ts`, `tests/commands.test.ts`.

## Errors / Corrections

- None yet.

## Ready for Next Run

- Focused store/command tests, `bun run check`, and `bun run verify` passed;
  hand the optional safe completed reference and labelled transcript detail to
  task_05 for terminal rendering evidence. Final-report handoff is active;
  lifecycle status remains runtime-owned.

## Final-Report Handoff

- Fresh implementation evidence: focused store/command tests passed with 45
  tests and 254 expectations; `bun run verify` passed with 310 tests, 1,824
  expectations, and a successful Bun build; `bun run check` and `git diff
  --check` exited successfully.
- The report phase should add only `reports/task_04.md`; do not alter task
  frontmatter status.
