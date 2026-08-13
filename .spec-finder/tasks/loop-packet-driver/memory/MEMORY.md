# Workflow Memory

## Current State

- Packet `loop-packet-driver` has approved PRD, TechSpec, ADR-001–004, and an approved six-task graph.
- Task files `task_01`–`task_06` are pending. No implementation has started.

## Shared Decisions

- Isolated loop stack: `src/loop-state.ts` + `src/loop.ts` + `loopCommand`.
- Wrap unchanged `runTaskPacket`; classify from packet files; optional `RunOptions.loopFeedback`.
- Ledger is `loop/state.json` with temp+rename; `--reset-state` always rewrites bootstrap only.
- Exits: `0` done/no_op, `1` named stops, `2` invalid, `130` cancelled.
- V1 adds no `loop_finished` event and does not edit `src/ui/store.ts`; command emit wrapper suppresses later `run_started`.

## Shared Learnings

- `RunResult.blocked` is overloaded; do not classify loop terminals from that counter.
- Failed tasks remain in `executionOrder`; a second engine pass would re-implement them unless detect stops first.
- Archive `scan-tasks.sh` ignores extra packet directories, so `loop/` does not affect archive verdicts.
- Single-slug `run` is lenient on unknown flags; loop parsing must stay strict like `exec`/batch.

## Open Risks

- Coarse iteration (one remaining engine pass) may make no-progress less precise; accepted for V1.
- `run` vs loop exit matrices differ; docs must contrast them.
- Leftover `loop/iterations/*.md` after reset are not ledger authority.

## Handoffs

- Start at `task_01` (ledger) or parallel `task_03` (engine feedback prefix).
- Critical path: task_01 → task_02 → task_04 → task_05 → task_06.
