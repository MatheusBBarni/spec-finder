# Task Memory: task_03

## Objective Snapshot

Expose Pi in setup picker, help, run overrides, and auto-on-switch.

## Important Decisions

- Wired `defaultsRuntimeToAutoOnProviderSwitch` into `applyRunOverrides` and setup writes instead of a second `provider === "grok"` special case.
- Switching *to* Pi or Grok resets omitted model/reasoning to `auto`; same-provider reruns keep saved reasoning.
- Setup usage grammar now includes `pi`. Exec `--provider is one of claude, codex, cursor, or grok` is unchanged so help does not claim Pi exec certification.
- README change in this task is the shared setup usage line plus the matching CLI section copy; full Pi prerequisites stay task_04.

## Learnings

- `tests/cli.test.ts` requires the exact setup usage string in both help and the README CLI block.

## Files / Surfaces

- `src/commands.ts`, `src/setup.ts`, `src/cli.tsx`, `README.md`
- `tests/commands.test.ts`, `tests/cli.test.ts`, `tests/setup.test.ts`

## Errors / Corrections

- None.

## Ready for Next Run

- Task complete. task_04 documents packet-only Pi, leftover `.pi/skills`, and the tested-pair placeholder.
