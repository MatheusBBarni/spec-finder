# Task Memory: task_06

## Objective Snapshot

- Integrate the approved pure timer contract into the existing immutable `CockpitStore` projection.

## Important Decisions

- Timer state is keyed by stable task ID, resets on `run_started`, advances through explicit store ticks, and never changes raw runtime events.
- Preserve active/selected/follow state, transcripts, run metadata, and read-only permission isolation.
- `CockpitState.taskTimers` is the immutable in-memory projection; `CockpitStore` accepts an optional `MonotonicNow` clock and defaults to `systemNow`.
- First observed `in_progress` starts a timer, duplicate or stale starts preserve the first baseline, and completed/done/finished/failed statuses freeze the first observed terminal value. Blocked tasks retain the `—` placeholder without a timer entry.
- `tick()` advances only timer entries whose task status is still `in_progress`; invalid or regressing clocks and unchanged displayed seconds preserve the prior snapshot and do not notify subscribers.

## Learnings

- Store integration is implemented in `src/ui/store.ts` and covered by controlled-clock fixtures in `tests/store.test.ts`; batch packet starts also clear local timer state so repeated packet task IDs cannot leak timing.
- Focused `bun test tests/timer.test.ts tests/store.test.ts` passed 42 tests and 242 assertions. `bun run check`, `bun run verify`, and `git diff --check` passed; the repository gate passed 346 tests and 2,041 assertions and bundled 29 modules.
- Protected-boundary inspection for `src/events.ts`, `src/engine.ts`, `src/commands.ts`, `package.json`, and `bun.lock` remained empty.

## Files / Surfaces

- `src/ui/store.ts` — timer state, injectable clock, status-boundary transitions, explicit tick path, and run/batch reset integration.
- `tests/store.test.ts` — controlled-clock lifecycle, terminal retention, invalid-clock, notification suppression, isolation, and run-completion coverage.

## Errors / Corrections

- Final-report review found complete, same-session terminal evidence for the focused suite, TypeScript check, repository verify/build, whitespace check, and protected-boundary diff; no verification rerun was required.

## Ready for Next Run

- `task_07` may render `state.taskTimers[task.id]` with the pure formatter and call `store.tick()` through the existing live lifecycle after this store contract and verification pass.
- The substantive report is ready to record the completed verdict; task frontmatter and lifecycle transition remain Spec Finder runtime-owned.
