# Task Memory: task_01

## Objective Snapshot

- Establish v3 setup configuration, static provider policy, and runtime override compatibility.

## Important Decisions

- Persisted config validation and temporary `run` overrides are separate layers.
- Config v3 uses a strict discriminated `setup` state; legacy v1/v2 inputs become in-memory `unconfigured` documents and never gain guessed scope.
- `setup-profile.ts` owns static provider labels, logical destinations, curated models, and defaults without importing or launching ACP/provider runtime code.
- `applyRuntimeConfigOverrides` validates only provider/model/reasoning/speed overrides and preserves the stored setup object even when the temporary provider differs.

## Learnings

- The v3 schema can remain the shared `configSchema` consumed by exec key validation when its runtime projection accepts both v2 and v3 versions.
- Focused policy/config/command/provider/ACP tests pass (49 tests); the final `rtk bun run verify` gate passes (293 tests, typecheck, and build).
- Final-report handoff can rely on those fresh terminal results; no verification rerun is needed.

## Files / Surfaces

- `src/config.ts`, `src/setup-profile.ts`, `src/commands.ts`, and focused config/command/profile tests.
- `src/exec-config.ts` accepts v3 runtime documents while retaining its existing runtime projection.

## Errors / Corrections

- The first strict type check flagged string-valued CLI flags at the runtime override boundary; `commands.ts` now narrows them to the existing config unions before the Zod validator.

## Ready for Next Run

- Installer work can consume `SpecFinderConfig.setup`, `serializeConfigCandidate`, `getSetupProfile`, and `isCuratedSetupModel`; setup argument parsing, picker behavior, writes, locks, and staging remain for task_02.
