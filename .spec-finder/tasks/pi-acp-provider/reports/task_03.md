# Task 03 Final Report: Expose Pi in setup/run UX and auto-on-switch

## Outcome

- Verdict: completed
- Date: 2026-08-27
- Provider/session: manual sf-batch-tasks / sf-execute-task

## Changes

- `src/commands.ts` — Pi picker row (`Pi`, hint `skills in .agents/skills`); `--provider pi` auto-on-switch via `defaultsRuntimeToAutoOnProviderSwitch`.
- `src/setup.ts` — Changing to Pi stores `reasoning: "auto"`; saved Pi reruns keep reasoning.
- `src/cli.tsx` — Setup usage includes `pi`; destinations mention Pi; exec provider list unchanged.
- `README.md` — Shared setup usage line includes `pi`.
- `tests/commands.test.ts`, `tests/setup.test.ts`, `tests/cli.test.ts` — Pi setup, rerun, runtime override, and help contract.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Picker row labeled `Pi` with `.agents/skills` hint; `--agent pi` defaults model `auto` (F-01, US-01, G-02). | Satisfied | Picker item added. `resolveSetupOptions(["--agent", "pi"])` yields provider `pi`, model `auto`. |
| 2. Omitted model/reasoning become `auto` when switching to Pi; explicit flags win (US-03, ADR-002). | Satisfied | `run --provider pi` from Codex (`gpt-5.6-luna`/`high`) yields auto/auto. Explicit `--model`/`--reasoning` are kept. Setup Codex→Pi stores `reasoning: "auto"`. |
| 3. Reject non-auto Pi setup models; reuse saved Pi; other providers remain selectable (F-01, US-07). | Satisfied | `--model volatile-model` rejected for pi. Saved Pi `auto`/`fast` reused. Help still lists claude/codex/cursor/grok. |
| 4. Help grammar lists `pi`; shared README usage line matches (G-05, F-07). | Satisfied | Setup usage is `claude\|codex\|cursor\|grok\|pi` in help and README. Exec still says `claude, codex, cursor, or grok`. |
| 5. Full Pi README narrative deferred (task_04). | Satisfied | README change is the usage line; no prerequisites block added. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `bun test tests/commands.test.ts tests/cli.test.ts tests/setup.test.ts` | pass | 51 pass, 0 fail |
| `bun run verify` | pass | `tsc --noEmit`; 407 pass, 0 fail, 2371 expects; `bun build` wrote `dist/cli.js` |
| `.pi/skills` not a setup target | pass | `SKILL_TARGETS` still uses `.agents/skills` for Pi |

## Risks and Follow-ups

- Full packet-only README (leftover `.pi/skills`, exec unavailable, tested-pair placeholder) is task_04.
- Interactive picker frames were not re-snapshotted; one extra item is covered by command resolution tests.

## Final Verdict

Completed: Pi is selectable in setup and as `--provider pi`, omitted model/reasoning default to `auto` on switch, help/README setup grammar includes `pi`, and exec help still does not claim Pi certification.
