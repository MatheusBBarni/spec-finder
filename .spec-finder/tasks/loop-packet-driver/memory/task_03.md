# Task Memory: task_03

## Objective Snapshot

- Add optional `RunOptions.loopFeedback` and prepend a bounded prefix to implementation and report prompts.

## Important Decisions

- Prefix heading is `Loop feedback:`.
- Empty or omitted feedback leaves prompt text unchanged.
- Control characters are stripped and the prefix is capped at 4096 characters in the engine so `run`/`batch` stay independent of `loop-state.ts`.

## Learnings

- Mock-agent prompt logs concatenate both turns; a heading that appears twice proves implementation and report prefixes.

## Files / Surfaces

- `src/engine.ts`
- `tests/engine.test.ts`

## Errors / Corrections

- First engine test insertion closed `describe` with `}` instead of `})`.

## Ready for Next Run

- Coordinator must omit `loopFeedback` on the first pass and set it only when ledger feedback has prior route-cause text.
