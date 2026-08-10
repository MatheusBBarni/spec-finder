# Task Memory: task_07

## Objective Snapshot

- Render and verify the integrated task timer in the completed read-only OpenTUI cockpit.

## Important Decisions

- Reuse the existing spinner/live-render lifecycle and keep timer updates observational.
- Preserve task identity, status, selection, transcript context, read-only controls, compact hierarchy, and reduced-color semantics.

## Learnings

- The App consumes `CockpitState.taskTimers` and calls `CockpitStore.tick()` from the existing 120 ms spinner interval; the store suppresses unchanged displayed seconds.
- `useRenderer()` provides the OpenTUI renderer for one `requestLive()` request per running effect and a matching `dropLive()` in status/unmount cleanup.
- Inactive batch packet tabs reuse task IDs, so their rows receive an empty timer projection rather than borrowing the active packet's local timer entry.
- Task metadata is truncated before the timer value, preserving `MM:SS`, `—`, or `unavailable` when type text is long.

## Files / Surfaces

- `src/ui/App.tsx` — store timer row rendering, OpenTUI live request/tick/cleanup effect, timer-priority metadata, and neutral help copy.
- `tests/cockpit.test.tsx` — deterministic timer states, fixed-size/reduced-color frames, help, invariance, and renderer cleanup evidence.

## Errors / Corrections

- Replaced the pre-existing App-local `TaskTiming` map and clock state; keeping both would create a second timer projection and lose store-owned terminal semantics.

## Ready for Next Run

- Exact focused suite `bun test tests/timer.test.ts tests/store.test.ts tests/cockpit.test.tsx`: 82 tests passed, 0 failed, 607 expect calls.
- `bun run check`: passed. `bun run verify`: passed with 349 tests across 30 files, 0 failures, 2,062 expect calls, and a successful CLI bundle.
- `rtk bun run test:pty`: passed; the retained failure-review macOS PTY gate restored terminal state and preserved exit status. A temporary timer fixture also observed `00:00` then `00:01` and exited cleanly after both `q` and Ctrl+C.
- `git diff --check` passed and the protected diff for `src/events.ts`, `src/engine.ts`, `src/commands.ts`, `package.json`, and `bun.lock` was empty.
- Implementation and evidence are ready for Spec Finder's report/status lifecycle; task frontmatter and `reports/task_07.md` were intentionally left to the runtime owner.
- Report-phase handoff: use a completed verdict from the evidence above; no live third-party provider smoke was performed because the approved timer boundary is deterministic, in-process cockpit behavior.
