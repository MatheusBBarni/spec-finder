# Task Memory: task_02

## Objective Snapshot

- Implement pure `detectLoopAction` over packet snapshots plus ledger.

## Important Decisions

- Detect lives in `src/loop.ts` and does not write files.
- Failed status wins over recover/execute.
- Caps (`iteration >= max_iterations`, `no_progress_streak >= no_progress_window`) apply only when remaining work exists, before recover/execute.
- Report handoff is preferred over pending checkpoint, which is preferred over execute.
- `done` requires prior loop work (`iteration > 0` or recorded iterations); a complete packet on a fresh ledger is `no_op`.
- `loopProgressFromTasks` / `progressIdentityKey` are exported for the coordinator to increment the streak; detect itself only reads ledger counters.

## Learnings

- `hasPendingCheckpointDelivery` is true for any completed task that still has a checkpoint record, including blocked delivery.

## Files / Surfaces

- `src/loop.ts`
- `tests/loop.test.ts`

## Errors / Corrections

## Ready for Next Run

- Coordinator (`task_04`) should reload tasks after each pass, call `detectLoopAction`, write ledger counters, and inject `runTaskPacket`.
