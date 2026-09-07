# Task Memory: task_05

## Objective Snapshot

- Wire `spec-finder loop` parser, lock, emit wrap, and exit mapping.

## Important Decisions

- Parse errors return exit 2 from `loopCommand` (do not throw into the CLI catch that maps to 1).
- `wrapLoopEmit` drops every `run_started` after the first so the cockpit store is not reset.
- Exits: done/no_op 0; blocked/failed/exhausted/stalled 1; invalid 2; cancelled 130.

## Learnings

- Injected `startCockpit` fakes must return a session with `close()`.

## Files / Surfaces

- `src/commands.ts`
- `src/cli.tsx`
- `tests/loop-args.test.ts`
- `tests/commands.test.ts`

## Errors / Corrections

- First import of `LoopStateError` from `loop.ts` failed; it lives in `loop-state.ts`.

## Ready for Next Run

- Task 06 must document terminals, exits, dry-run non-mutation, and loop vs run without advertising `--multiple` or a required loop config key.
