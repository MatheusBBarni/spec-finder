# Task Memory: task_01

## Objective Snapshot

Define the batch result/parser contract and strict `--multiple` input grammar.

## Important Decisions

- Keep parser behavior opt-in and separate from the existing single-slug path.

## Learnings

- Existing slug validation lives in `src/tasks.ts`; reuse it rather than creating a competing regex.

## Files / Surfaces

- `src/batch.ts` (create)
- `tests/batch.test.ts` (create)

## Errors / Corrections

- None recorded.

## Ready for Next Run

- Downstream coordinator work may consume the typed parser/result contract after focused tests pass.
