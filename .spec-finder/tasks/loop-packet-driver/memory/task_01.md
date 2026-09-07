# Task Memory: task_01

## Objective Snapshot

- Implement packet-local loop ledger (`loop/state.json`) with Zod-strict schema, init/load/reset, and same-directory temp-plus-rename writes.

## Important Decisions

- Ledger module is `src/loop-state.ts`; tests live in `tests/loop-state.test.ts`.
- `describeLoopPaths` is the documented non-mutating helper; it must not mkdir or write.
- `initLoopState` loads a valid existing ledger and only bootstraps when the file is unreadable/missing. Invalid JSON/schema fails closed; `--reset-state` is the repair.
- Goal and definition-of-done are Zod literals of the TechSpec V1 strings so hand-edits fail closed.
- Writes use exclusive temp `state.json.<pid>.<time>.<hex>.tmp` in `loop/` then `rename` onto `state.json`.

## Learnings

- Zod 4 `z.iso.datetime()` accepts `Date.toISOString()` values.
- Load never rewrites; truncated `state.json` is invalid JSON and fail-closed.

## Files / Surfaces

- `src/loop-state.ts`
- `tests/loop-state.test.ts`

## Errors / Corrections

- First unknown-key test built invalid JSON by string-slicing; switched to object spread + stringify.

## Ready for Next Run

- Detect (`task_02`) should import `LoopState` / terminals from `src/loop-state.ts` and treat markdown under `loop/iterations/` as leftover evidence only.
