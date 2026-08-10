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
- `CockpitStore.finished` carries typed `outcome: "no_work"` and
  `reason: "all_tasks_complete"` only when the terminal event supplies them;
  metadata-free events keep the legacy `{ ok, message }` shape.
- The no-work summary is a separate text-first terminal frame with the
  all-complete reason, `Tasks N/N complete`, and Q/Ctrl+C guidance. Escape does
  not dismiss this summary; Q/Ctrl+C signal the session exit callback before
  cancellation.
- `createCockpitSessionController` resolves its one-shot `waitForExit` promise
  from the App signal or idempotent close, while retaining the older dismissal
  promise for failure-review callers.

## Files / Surfaces

- `src/ui/store.ts`, `src/ui/App.tsx`, `src/ui/cockpit.tsx`, and their tests.
- `src/ui/store.ts` preserves typed singular terminal metadata without
  changing batch projection; `src/ui/App.tsx` owns no-work presentation and
  keyboard signaling; `src/ui/cockpit.tsx` owns the exit promise.

## Errors / Corrections

- Making `waitForExit` required on the shared session interface broke existing
  command test fakes; the public legacy interface keeps it optional while the
  real controller return type remains required.

## Ready for Next Run

- Task 03 can feature-detect the optional `waitForExit` handle for typed
  interactive no-work only; preserve existing navigation, transcripts, batch
  projection, and text-based accessibility coverage.
- Focused `rtk bun test tests/store.test.ts tests/cockpit.test.tsx` passed with
  63 tests and 511 assertions; `rtk bun run check` and `rtk bun run verify`
  also passed to terminal exit (the full gate reported 327 tests and 1,953
  assertions, then bundled 28 modules).
- The implementation handoff is complete; the task report is the remaining
  packet artifact before Spec Finder owns the final verdict and status update.
