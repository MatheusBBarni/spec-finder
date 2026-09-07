# Workflow Memory

## Current State

- Packet `loop-packet-driver` implementation is complete for task_01–task_06 with reports.
- `spec-finder loop` is dispatched, documented, and covered by focused tests. Last `bun run verify`: 470 pass.

## Shared Decisions

- Isolated loop stack: `src/loop-state.ts` + `src/loop.ts` + `loopCommand`.
- Wrap unchanged `runTaskPacket`; classify from packet files; optional `RunOptions.loopFeedback`.
- Ledger is `loop/state.json` with temp+rename; `--reset-state` always rewrites bootstrap only.
- Exits: `0` done/no_op, `1` named stops, `2` invalid, `130` cancelled.
- V1 adds no `loop_finished` event and does not edit `src/ui/store.ts`; command emit wrapper suppresses later `run_started`.

## Shared Learnings

- `git add` of tracked files under ignored `.spec-finder/tasks` exits 1, so config `auto_commit` checkpoints cannot complete for this tracked packet.
- Dry-run continue plans currently surface as `LoopResult.terminal: no_op` with a dry-run reason (exit 0).

## Open Risks

- Local checkpoint complete remains blocked for this packet while `.spec-finder/tasks` is gitignored and packet files are tracked.
- Coarse iteration (one remaining engine pass) may make no-progress less precise; accepted for V1.

## Handoffs

- Implementation files (`src/loop*.ts`, `src/engine.ts`, `src/commands.ts`, `src/cli.tsx`, README, tests) remain uncommitted. Checkpoints were skipped after the blocked complete on task_01.
