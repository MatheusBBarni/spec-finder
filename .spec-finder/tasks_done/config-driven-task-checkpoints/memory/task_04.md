# Task Memory: task_04

## Objective Snapshot

- Integrate checkpoint delivery into ACP runtime execution and recovery.

## Important Decisions

- Keep `src/engine.ts` as the lifecycle owner: checkpoint begin runs before `in_progress`, while completion runs only after report validation and `completed` status.
- Treat checkpoint delivery failure as a run-blocking outcome; leave lifecycle completion separate from delivery metadata and retry only delivery on a normal rerun.
- Use an injectable `CheckpointServiceContract` on `RunOptions` for deterministic runtime ordering and recovery fixtures while the default path constructs the shared service.

## Learnings

- The engine must reload the task after `begin` persists active metadata; otherwise the subsequent status write can erase the checkpoint baseline.
- Packet-memory bootstrap needs pre/post Git snapshots and known memory paths as the baseline boundary; blocked recovery paths are allowed during reruns while unrelated dirty state remains fail-closed.
- A successful delivery retry increments the current run's completed count and proceeds to the next task without opening an ACP session for the recovered task.

## Files / Surfaces

- `src/engine.ts` — memory-aware checkpoint preparation, begin/complete/retry sequencing, blocked stop behavior, outcome events, and RunResult counters.
- `src/events.ts` — `checkpoint` created/blocked event variants.
- `src/batch.ts` — packet-qualifies checkpoint event task IDs at the existing event/result seam.
- `tests/engine.test.ts` — ordering, disabled, blocked downstream, native hook refusal, and no-ACP recovery fixtures.

## Errors / Corrections

- First recovery fixture rerun was blocked by a test prompt log inside the Git worktree; moving that log outside the fixture root preserved the clean-baseline contract.

## Ready for Next Run

- Focused `bun test tests/engine.test.ts` passed: 13 tests, 0 failures, 81 expectations.
- `bun run verify` passed: typecheck, 146 tests, 0 failures, 793 expectations, and Bun build completed.
- Final-report handoff uses the exact implementation-phase terminal evidence; no lifecycle status or report ownership was changed by implementation.
- Spec Finder still owns task status and final report; no lifecycle status or report was changed here.
