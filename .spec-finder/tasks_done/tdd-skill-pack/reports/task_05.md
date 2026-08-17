# Task 05 Final Report: Install TDD pack and document when-to-use

## Outcome

- Verdict: completed
- Date: 2026-08-13
- Provider/session: manual `sf-batch-tasks` / `sf-execute-task`

## Changes

- `src/setup.ts` — Appended `sf-tdd-plan`, `sf-tdd-execute`, `sf-tdd-report`, `sf-tdd-batch` after `sf-batch-tasks` and before `sf-archive-tasks`.
- `tests/setup.test.ts` — Retitled the nine-skill test; asserts the thirteen-name allowlist including the four TDD skills and still checks every `SKILL.md`.
- `tests/engine.test.ts` — Added a lock that ACP report prompts still contain `Use the sf-task-report skill if it is installed.`
- `README.md` — Pipeline rows for the TDD pack, when-to-use versus core, ACP `run` stays on core skills, and upgrade is npm-only so existing workspaces re-run `spec-finder setup`.
- `.spec-finder/tasks/tdd-skill-pack/memory/MEMORY.md` — Packet complete handoff.
- `.spec-finder/tasks/tdd-skill-pack/memory/task_05.md` — Task-local decisions and file list.

`implementationPrompt` and `reportPrompt` in `src/engine.ts` were not retargeted. `src/config.ts` was not changed. Unrelated leftover dirty files from earlier checkpoint work remain uncommitted and were not part of this task's intended surface except the engine test lock added above.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Append the four TDD names in order after `sf-batch-tasks` and before `sf-archive-tasks` (F-01, M-01) | satisfied | `SPEC_FINDER_SKILLS` and the setup test equality assertion list that exact order. |
| 2. Keep ACP prompts on `sf-execute-task` / `sf-task-report` (G-02, US-08, M-04) | satisfied | Prompt builders unchanged. Engine test still requires `Use the sf-execute-task skill` and now also `Use the sf-task-report skill if it is installed.` |
| 3. Document optional TDD pack, when-to-use, ACP default, and re-run setup after upgrade (F-06, G-05, M-05, Q1) | satisfied | README pipeline rows plus "When to use TDD versus core" and the upgrade recopy note. |
| 4. SHOULD retitle the “exactly nine” setup test (TechSpec Testing and Evidence) | satisfied | Title is now “installs thirteen managed skills including the TDD pack…”. Length + `SKILL.md` access remain. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `SPEC_FINDER_SKILLS` membership | pass | Test asserts 13 names and TDD order between batch and archive. |
| Setup matrix | pass | `bun test tests/setup.test.ts`: every provider × local/global copies each listed `SKILL.md`. |
| Engine prompt locks | pass | `bun test tests/engine.test.ts`: implementation and report strings still name core skills. |
| README when-to-use | pass | Pipeline lists TDD skills; section states `run` stays on core; upgrade note says re-run setup. |
| `bun test tests/setup.test.ts` | pass | 9 pass |
| `bun test tests/engine.test.ts` | pass | 24 pass |
| `bun run verify` | pass | `tsc --noEmit` clean; 386 tests, 0 fail; `dist/cli.js` rebuilt. |

## Risks and Follow-ups

- Existing workspaces stay on nine destination skills until they re-run `spec-finder setup`.
- Four doctrine copies can still drift; refresh them together when `/tdd` changes.
- ACP `run` opt-in remains a later product decision.

## Final Verdict

`task_05` registered the four TDD trees on the managed allowlist, proved setup copies thirteen `SKILL.md` files, kept ACP prompts on core execute/report, and documented when to use TDD versus core plus the re-run-setup note. Repository verification stayed green. Completed.
