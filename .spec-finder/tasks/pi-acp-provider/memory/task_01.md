# Task Memory: task_01

## Objective Snapshot

Add `pi` to closed provider registries with a complete packet launch recipe and exec-false certification.

## Important Decisions

- Attached `createPiAuthMethodPreference()` at resolve time, matching Grok, rather than baking `authPreference` into `PROVIDER_LAUNCHES.pi`.
- Exported `defaultsRuntimeToAutoOnProviderSwitch` from `setup-profile.ts` without wiring CLI/setup consumers (task_03).
- Left picker, help grammar, ACP option policy, README, and Grok-only setup reasoning defaults unchanged.

## Learnings

- Adding `"pi"` to `PROVIDERS` requires launch recipe, exec-false, setup profile, and `SKILL_TARGETS.pi` in the same task because those maps are exhaustive `Record<ProviderName, …>` or runtime `isSkillTarget` gates.

## Files / Surfaces

- `src/config.ts`, `src/setup-profile.ts`, `src/providers.ts`, `src/setup.ts`
- `tests/providers.test.ts`, `tests/setup-profile.test.ts`, `tests/config.test.ts`, `tests/setup.test.ts` (PROVIDERS loop)

## Errors / Corrections

- None. Focused suites and `bun run verify` passed on first run after implementation.

## Ready for Next Run

- Task complete. task_02 consumes launch/auth; task_03 consumes the auto-on-switch predicate.
