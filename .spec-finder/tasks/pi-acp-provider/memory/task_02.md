# Task Memory: task_02

## Objective Snapshot

Apply Pi required model/reasoning session-config policy and ACP fixtures.

## Important Decisions

- Extended `runtimeOptionPolicy.reasoning` to `required` for `pi` as well as `grok`. Model stays `required` (not launch-time). Speed stays `optional`.
- Fixtures advertise standard `model` plus `thinkingLevel` with `category: "thought_level"` so existing `findConfigOption` matches without a Pi normalizer.
- Shared-session proof lives in `tests/engine.test.ts` as a Grok analog, not a new session manager.

## Learnings

- `thinkingLevel` is found by category `thought_level`; setter lifecycle logs use config id `thinkingLevel`.

## Files / Surfaces

- `src/acp-client.ts`
- `tests/acp-client.test.ts`, `tests/acp-turn.test.ts`, `tests/engine.test.ts`

## Errors / Corrections

- None. Focused suites and `bun run verify` passed after implementation.

## Ready for Next Run

- Task complete. task_03 still owns `--provider pi` auto defaults and picker/help.
