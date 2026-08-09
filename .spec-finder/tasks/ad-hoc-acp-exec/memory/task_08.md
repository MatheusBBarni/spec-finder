# Task Memory: task_08

## Objective Snapshot

- Compose the packet-free `exec` command over the task 03/05/06/07 contracts, keeping real providers and write access disabled until task 09.

## Important Decisions

- `src/exec.ts` is a thin composition root: it parses through `commands.ts`, resolves the canonical context and fixture/certification launch before spawn, injects the permission broker, read-only workspace capability, supervisor, neutral ACP turn, and safe reporter, then maps the terminal publication to the command exit code.
- `commands.ts` owns `exec` signal listeners and CLI dispatch; the neutral turn receives `hostAccessMode: "read-only"` so ACP write capability is not advertised during this task.
- Fixture launches are cloned and forced to the resolved canonical workspace. No run lock, packet engine, cockpit, memory, report, or history path is touched.

## Learnings

- The neutral reporter must check `max_turn_requests` before the generic `limited` category to retain the approved `limited:max-turn-requests` terminal label.
- The mock ACP fixture can record client write capability and emit tool/thought/terminal modes, which keeps integration evidence deterministic without certifying a real provider.

## Files / Surfaces

- `src/exec.ts`, `src/commands.ts`, `src/cli.tsx`, `src/acp-turn.ts`, `src/exec-output.ts`, `tests/exec.test.ts`, `tests/cli.test.ts`, and `tests/fixtures/mock-agent.ts`.

## Errors / Corrections

- The first integration pass normalized `max_turn_requests` as generic `limited`; reordered reporter outcome mapping and added a regression fixture.
- The first fixture launch type used the neutral ACP shape while the provider resolver expects mutable cloned arguments; the composition boundary now accepts readonly fixture inputs and clones them into the provider shape.

## Ready for Next Run

- Report-phase handoff evidence is complete: `rtk bun test ./tests/exec.test.ts ./tests/commands.test.ts ./tests/acp-client.test.ts ./tests/engine.test.ts` passed with 45 tests, 0 failures, and 210 expectations; `rtk bun run check` passed; and `rtk bun run verify` passed with 235 tests, 0 failures, 1,161 expectations across 25 files and a successful 27-module build.
- Coverage spot-check passed with 45 tests and 0 failures; `src/exec.ts` measured 89.47% functions and 94.59% lines, `src/exec-output.ts` 100%/100%, and `src/exec-config.ts` 90.48%/98.99%.
- Do not enable `EXEC_PROVIDER_CERTIFICATION` entries, write mode, or lifecycle/report status from this task.
