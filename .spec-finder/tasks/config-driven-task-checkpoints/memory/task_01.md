# Task Memory: task_01

## Objective Snapshot

- Establish the default-off `auto_commit` configuration contract.

## Important Decisions

- Added `auto_commit` as a strict v2 boolean with a default of `false`; v1 migration explicitly resets it to `false`, including legacy inputs that contain a truthy value.
- Kept setup prompts, runtime checkpoint behavior, and README scope unchanged; setup already serializes the expanded `DEFAULT_CONFIG`, and later task 05 owns local-only documentation.

## Learnings

- `spec-finder config` loads the existing file through the schema and exposes the effective default as `"auto_commit": false` even when older v2 files omit the key.
- Generated setup config and rewritten v1 config both reload successfully with the expanded contract.
- Fresh focused verification passed: `rtk bun test tests/config.test.ts tests/setup.test.ts` ran 13 tests with 0 failures.
- Fresh repository verification passed: `rtk bun run verify` completed typecheck, 108 tests across 15 files with 0 failures, and the Bun build.

## Files / Surfaces

- `src/config.ts`
- `tests/config.test.ts`
- `tests/setup.test.ts`

## Errors / Corrections

- The working tree also contains separate `src/ui/App.tsx` and `tests/cockpit.test.tsx` changes; they are outside task_01 and were not absorbed into this task.

## Ready for Next Run

- Later checkpoint producers can branch on `config.auto_commit`; no Git/checkpoint implementation belongs to this task.
