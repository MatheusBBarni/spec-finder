# Task 03 Final Report: Enforce Outcome-Aware Command Failure Review

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: unavailable; this report uses the immediately preceding implementation-phase terminal handoff

## Changes

- `src/commands.ts` — Added a shared command lifecycle for single and aggregate batch runs. Interactive eligibility now requires no explicit no-UI control, `stdin.isTTY === true`, and `stdout.isTTY === true`. The lifecycle owns one controller, session startup, failure dismissal waiting, active-cancellation abort/close, and guarded idempotent cleanup.
- `tests/commands.test.ts` — Added deterministic coverage for both TTY streams, `--no-ui`, console failure output, retained single/batch failures, success/cancellation/preflight bypasses, active cancellation races, and thrown runner/coordinator cleanup.
- `.spec-finder/tasks/visible-task-run-errors/memory/MEMORY.md` — Promoted the durable shared command-lifecycle policy and unchanged batch/event boundary.
- `.spec-finder/tasks/visible-task-run-errors/memory/task_03.md` — Recorded implementation decisions, exact verification results, and the report-phase handoff.
- `.spec-finder/tasks/visible-task-run-errors/reports/task_03.md` — This evidence report.

`src/batch.ts` and `src/events.ts` were not modified. Task frontmatter remains
runtime-owned and was not changed by this report phase.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Start a cockpit only when no no-UI control applies and both terminal streams are TTYs. | Satisfied | `isInteractiveRun` in `src/commands.ts` checks `options.noUi`, `--no-ui`, input TTY, and output TTY. The focused test `requires both terminal streams and preserves console failure behavior before starting the cockpit` covers stdin non-TTY, stdout non-TTY, and explicit `--no-ui`; all assert zero cockpit starts and preserved console failure output. |
| 2. Await dismissal only for a non-aborted single failure or batch `status: "failed"`, preserving the nonzero result. | Satisfied | The focused test `retains interactive single and batch failures until dismissal` uses a controllable fake session, proves the command is unsettled before dismissal, then asserts exit `1` and one close. `waitForDismissal` also guards no-UI and aborted signals. |
| 3. Close immediately for success, cancellation, preflight failure, ineligible execution, and thrown errors; keep close idempotent. | Satisfied | The focused outcome matrix proves success, cancellation, and `preflight_failed` do not wait; the TTY/no-UI matrix proves no session starts; the active-cancellation test proves immediate one-time close and no re-entry into review for both modes; thrown coordinator and single-runner tests prove one close and original exception propagation. The lifecycle nulls the owned session before close and `finally` reuses the guard. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test tests/commands.test.ts` | PASS | 25 tests passed, 0 failed, 126 `expect()` calls. |
| `rtk bun run check` | PASS | `tsc --noEmit` exited successfully. |
| `rtk bun run verify` | PASS | TypeScript check passed; 318 tests passed, 0 failed, 1,897 `expect()` calls; Bun build bundled 28 modules to `dist/cli.js` (0.34 MB). |
| `rtk git diff --check` | PASS | No whitespace errors reported. |

## Risks and Follow-ups

- Native macOS PTY and manual terminal-smoke evidence were not run in this task; task 05 owns the `test:pty` release gate and the real-terminal checks. The default-on release bar must not be claimed from this report alone.
- No separate numerical coverage command was run; behavioral lifecycle coverage is present, but the 80% target is not independently measured here.
- Downstream UI work must continue consuming the existing `CockpitSession` and store contracts without changing the batch/event ownership boundary.
- Spec Finder still owns task-status transition after this report; the task frontmatter remains unchanged.

## Final Verdict

Completed. The command layer now applies one outcome-aware lifecycle to single
and aggregate batch runs, all required focused and repository automated gates
passed to terminal exit, and the existing batch/event contracts remain
untouched. PTY and manual release evidence remain explicitly deferred to task
05.
