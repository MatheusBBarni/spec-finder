# Task 01 Final Report: Add Pi provider registries and packet launch recipe

## Outcome

- Verdict: completed
- Date: 2026-08-27
- Provider/session: manual sf-batch-tasks / sf-execute-task

## Changes

- `src/config.ts` — Added `"pi"` to the strict `PROVIDERS` enum.
- `src/setup-profile.ts` — Added Pi setup profile (`.agents/skills`, `models: []`, `defaultModel: "auto"`, label `Pi`) and exported `defaultsRuntimeToAutoOnProviderSwitch`.
- `src/providers.ts` — Added frozen packet launch (`npx --yes @automatalabs/pi-acp`, empty env, redact, no normalizer), `createPiAuthMethodPreference()`, exec-false certification, and explicit `providerLabel("pi") === "Pi"`.
- `src/setup.ts` — Added `SKILL_TARGETS.pi`.
- `tests/providers.test.ts` — Extended exhaustive loops and added Pi launch, env, and label coverage.
- `tests/setup-profile.test.ts` — Pi profile, curated-model rejection, and auto-on-switch predicate tests.
- `tests/config.test.ts` — Accepts persisted `provider: "pi"` with `.agents/skills`.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Add `"pi"` to the provider enum and exhaustive `Record<ProviderName, …>` maps (F-01, G-04). | Satisfied | `PROVIDERS` includes `pi`. `PROFILE_BY_PROVIDER`, `PROVIDER_LAUNCHES`, and `EXEC_PROVIDER_CERTIFICATION` typecheck. `bun run check` passed. |
| 2. Ship packet launch and auth preference with empty env and no session-config normalizer (F-04, ADR-002). | Satisfied | `tests/providers.test.ts` asserts command `npx`, args `["--yes", "@automatalabs/pi-acp"]`, `env {}`, auth `["pi-stored-credentials"]`, `stderrPolicy: "redact"`, no normalizer. |
| 3. Keep `EXEC_PROVIDER_CERTIFICATION.pi.exec === false` while packet launch succeeds (F-05, US-06). | Satisfied | Exhaustive packet-vs-exec test includes `pi`; packet resolve succeeds; exec throws `ProviderCertificationError`. |
| 4. `.agents/skills` destination, `auto`-only models, label `Pi`, auto-on-switch true for `grok` and `pi` only (F-01, F-06). | Satisfied | `tests/setup-profile.test.ts` and `tests/setup.test.ts` PROVIDERS × local/global loop. Predicate true for grok/pi, false for claude/codex/cursor. |
| 5. Should not change picker, help, acp-client policy, or README narrative. | Satisfied | Diff is limited to registries, `SKILL_TARGETS.pi`, and tests. `tests/cli.test.ts` still passed with the four-provider help grammar. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/providers.test.ts tests/setup-profile.test.ts tests/setup.test.ts tests/config.test.ts` | pass | 43 pass, 0 fail |
| `bun run verify` | pass | `tsc --noEmit`; 394 pass, 0 fail, 2322 expects; `bun build` wrote `dist/cli.js` |
| Unknown agents still rejected | pass | `applyRuntimeConfigOverrides(..., { provider: "not-a-provider" })` still throws `ConfigError` |
| No picker/help/README/acp-client edits | pass | `rtk git diff --stat` lists only config/setup-profile/providers/setup and matching tests plus task_01.md |

## Risks and Follow-ups

- Auto-on-switch predicate is exported but unused by CLI until task_03.
- Unpinned `@automatalabs/pi-acp` compatibility remains a task_05 live-packet risk.
- Picker, help grammar, ACP session-config policy, and README Pi narrative are intentionally out of scope.

## Final Verdict

Completed: `pi` is a valid persisted and runtime provider id with a packet launch recipe, empty launch env, Pi auth preference, exec-false certification, `.agents/skills` setup destination, explicit `Pi` label, and a tested unused auto-on-switch predicate, backed by focused suites and a clean `bun run verify`.
