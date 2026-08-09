# Task 04 Final Report: Integrate Batch Command Routing and Terminal Results

## Outcome

- Task: `task_04` — Integrate Batch Command Routing and Terminal Results.
- Outcome: Implemented strict batch command routing, one shared command lifecycle, deterministic `--no-ui` packet output, stop/recovery messaging, aggregate exit mapping, and single-run regression coverage.
- Verdict: completed
- Date: 2026-08-08
- Provider/session: unavailable; report produced from the local worktree with fresh terminal verification.

## Changes

- `src/commands.ts` — Routes only validated `--multiple` arguments to the batch coordinator, preserves the single-slug path, creates one controller/config/store/listener/renderer lifecycle per invocation, formats additive batch events for terminal output, and maps aggregate results to exit codes.
- `tests/commands.test.ts` — Adds command-level coverage for routing, shared signal/configuration, renderer cleanup, no-UI success/failure/cancellation/preflight output, exit codes, invalid grammar, and single-run regression.
- `.spec-finder/tasks/ordered-multiple-task-run/memory/task_04.md` — Records the final evidence refresh and the bounded manual three-packet coordinator run.
- `.spec-finder/tasks/ordered-multiple-task-run/reports/task_04.md` — This report.

The shared checkout also contains dependency work from tasks 01–03 plus unrelated packet, task-frontmatter, UI, and scaffolding changes. Those files were preserved and are not attributed to task 04. Task frontmatter remains lifecycle-owned by Spec Finder and was not changed by this report phase.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Route exactly the validated batch grammar to the coordinator while preserving the single-slug path and event behavior (G-04, US-06, C-01). | Satisfied | `runCommand` calls `parseMultipleArgs` before workspace/config/renderer setup, dispatches only `mode: "batch"` to `runBatch`, and leaves the legacy branch on `runTaskPacket`. The focused tests `rejects invalid batch grammar before config, renderer, or coordinator start` and `closes one renderer after a thrown coordinator error and keeps the single-run branch intact` passed; the batch parser matrix also passed. |
| 2. Create one shared `AbortController`, effective config, store, and renderer/listener lifecycle per invocation (F-02, C-02). | Satisfied | `runBatchCommand` constructs one controller, effective config, store, listener, and optional cockpit, forwards the same signal/configuration to one coordinator call, and closes the cockpit in `finally`. The focused routing test observed one coordinator call, one signal, and the overridden model; the thrown-coordinator test observed one renderer close. |
| 3. Emit concise `--no-ui` packet progress/outcomes, stopping packet, later `not_started` packets, and no-retry recovery guidance (US-03, US-04, F-04, C-04). | Satisfied | The additive batch listener prints packet position/start, each packet outcome, the stopping packet, later `not_started` summaries, explicit `no automatic retry` guidance, and the aggregate result. The focused failure-output test asserted the stopping packet, `gamma not_started`, manual recovery text, and exit-1 aggregate; the success test asserted deterministic progress and that nested `run_finished` output is suppressed. |
| 4. Return exit `0` only for an all-success/already-complete aggregate and exit `1` for preflight failure, failure, or cancellation (US-05, F-06). | Satisfied | `batchExitCode` requires `ok`, `status: "completed"`, a non-empty packet list, and every packet outcome to be `succeeded`; otherwise it returns `1`. Focused command tests passed for all-success with `already_complete`, failure, cancellation, and preflight-failure results. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/commands.test.ts ./tests/batch.test.ts` | PASS (exit 0) | Bun 1.3.13; 34 tests passed, 0 failed across 2 files, with 121 `expect()` calls. |
| `rtk bun run check` | PASS (exit 0) | `tsc --noEmit` completed successfully. |
| `rtk bun run verify` | PASS (exit 0) | TypeScript check passed; 97 tests passed, 0 failed across 14 files, with 456 `expect()` calls; Bun bundled 18 modules into `dist/cli.js` (124.0 KB). |
| `rtk git diff --check` | PASS (exit 0) | No whitespace errors reported. |
| Non-interactive three-packet coordinator sequence | PASS (exit 0) | `runCommand` + real `runBatch` were exercised with an injected no-op packet runner for `ordered-multiple-task-run`, `read-only-progress-navigator`, and `tui-demo`. Output was ordered `1/3`, `2/3`, `3/3` starts, succeeded outcomes for all three packets, and `batch: aggregate succeeded (exit 0)`. No provider was launched. |

## Risks and Follow-ups

- The manual three-packet evidence uses an injected runner, so it validates command/coordinator routing and terminal presentation without a live ACP/provider process. Live provider cancellation timing remains an integration risk covered by deterministic fixtures, not by this smoke run.
- Preflight is a point-in-time read-only snapshot. Filesystem changes after preflight can still cause a packet runtime failure; earlier successes are not rolled back by design.
- Cockpit rendering and public help/README documentation remain downstream task ownership (`task_05`/`task_06`).
- The full gate ran in the shared dirty checkout; unrelated changes were preserved and not silently corrected.

## Final Verdict

Completed: task 04 satisfies all four numbered command-routing and terminal-result requirements. Fresh focused tests, the TypeScript check, the full repository verification gate, diff hygiene check, and the bounded three-packet non-UI coordinator run all reached terminal success. The remaining items are documented live-provider and downstream documentation/rendering follow-ups, not blockers for this task.
