# Task Memory: task_01

## Objective Snapshot

Define the batch result/parser contract and strict `--multiple` input grammar.

## Important Decisions

- Keep parser behavior opt-in and separate from the existing single-slug path.
- `parseMultipleArgs` returns an explicit `single`, `batch`, or `error` mode; batch results preserve slug order and expose remaining provider/model/reasoning/speed/`--no-ui` tokens as `runtimeArgs`.
- Batch parsing rejects repeated `--multiple`, positional slugs, empty or duplicate entries, malformed/option-like slugs, unknown options, and missing option values before producing a batch list.
- `PacketOutcome`, `PacketSummary`, `BatchResult`, `BatchRunOptions`, and `PacketRunner` mirror the approved TechSpec contracts; `RunTaskPacketOptions`/`RunTaskPacketResult` aliases point to the existing engine types.

## Learnings

- Existing slug validation lives in `src/tasks.ts`; reuse it rather than creating a competing regex.
- The shared slug regex is exposed as `isValidTaskSlug` and used by both `loadTaskPacket` and `src/batch.ts`.

## Files / Surfaces

- `src/batch.ts` (create)
- `tests/batch.test.ts` (create)
- `src/tasks.ts` (shared slug validator export and reuse)

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Final verification rerun: `rtk bun test ./tests/batch.test.ts` passed (14 tests, 0 failures); `rtk bun run check` passed; `rtk bun run verify` passed (77 tests across 14 files, 0 failures, 369 expectations, and a 17-module build producing `dist/cli.js` at 97.72 KB).
- Downstream coordinator work may consume the typed parser/result contract after the task report/status lifecycle is handled by Spec Finder.
- Unrelated dirty files were preserved, including the pre-existing config/task edits and UI transcript edits observed during verification.
