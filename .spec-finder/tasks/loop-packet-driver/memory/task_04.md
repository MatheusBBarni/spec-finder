# Task Memory: task_04

## Objective Snapshot

- Implement `runLoop` with injected `runTaskPacket`, dry-run, caps, cancel, and ledger writes.

## Important Decisions

- Dry-run never inits `loop/` and maps a would-continue plan to `LoopResult.terminal: no_op` with a dry-run reason so the later command can exit 0.
- First engine pass omits `loopFeedback`; later passes join `previous_outcome` and `route_causes`.
- Iteration markdown write failures are ignored; `loop/state.json` remains authority.
- Progress streak updates after each engine pass from completed/failed/blocked identity sets.

## Learnings

- `initLoopState` on a real run writes the ledger even for `no_op`; dry-run must use in-memory bootstrap instead.

## Files / Surfaces

- `src/loop.ts`
- `tests/loop.test.ts`

## Errors / Corrections

## Ready for Next Run

- `loopCommand` should acquire the run-lock, wrap emit to suppress later `run_started`, map terminals to exits 0/1/2/130, and print `loop: terminal`.
