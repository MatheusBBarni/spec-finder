# Task 05 Final Report: Add Deterministic macOS PTY Release Evidence

## Outcome

- Verdict: completed
- Date: 2026-08-10
- Provider/session: unavailable; deterministic fake-runner events and a local macOS PTY were used, with no live provider process

## Changes

- `package.json` — registered the macOS-only `test:pty` command with clear Darwin, `/usr/bin/script`, and `/usr/bin/expect` availability checks.
- `tests/fixtures/failure-review-cli.ts` — added a deterministic fixture that invokes the real `runCommand` path, uses a per-process synthetic run-lock root, emits the failed-task event sequence, supplies a multiline surfaced error, and returns the original result `1`.
- `tests/failure-review.pty.expect` — added the `/usr/bin/script` plus `/usr/bin/expect` protocol, ANSI/control-sequence-tolerant assertions, pre-dismissal liveness check, Esc dismissal, child cleanup, and exit-status assertion.
- `.spec-finder/tasks/visible-task-run-errors/memory/MEMORY.md` — recorded the durable PTY handoff and release-gate boundaries.
- `.spec-finder/tasks/visible-task-run-errors/memory/task_05.md` — recorded implementation corrections, platform metadata, exact verification results, and the remaining manual smoke checklist.
- `.spec-finder/tasks/visible-task-run-errors/reports/task_05.md` — this evidence report.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Add a macOS `bun run test:pty` gate using absolute `/usr/bin/script` and `/usr/bin/expect`, with clear missing-tool output. | Satisfied | `package.json` checks Darwin and executable availability before invoking the absolute tools. The installed host had both tools, so the missing-tool branches were inspected but not exercised. `rtk bun run test:pty` exited 0. |
| 2. Drive the real command/cockpit lifecycle with deterministic fake-runner events, including a multiline failed task and the exact generic recovery hint. | Satisfied | `failure-review-cli.ts` calls `runCommand` with fake `run_started`, failed task status/activity, and `run_finished` events. The PTY protocol observed `RUN.FAILURES`, `task_01`, all three fixture error lines, and `Resolve the listed error, then rerun the task packet.` before dismissal. |
| 3. Tolerate terminal control sequences, send Esc to dismiss, and preserve the original exit status `1`. | Satisfied | `failure-review.pty.expect` normalizes ANSI/control-sequence boundaries, proves the review remains open before input, sends Esc, asserts `FIXTURE_EXIT=1`, waits for EOF, and verifies child status `1`. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun run test:pty` | PASS, exit 0 | Darwin 25.6.0 arm64; Bun 1.3.13; Expect 5.45; the protocol reported retained review before dismissal, restored terminal state, preserved exit status 1, and `PASS`. BSD `script` metadata was recorded as `PROGRAM:script PROJECT:shell_cmds-329`. |
| `rtk bun test tests/store.test.ts tests/cockpit.test.tsx tests/commands.test.ts` | PASS, exit 0 | 83 tests passed, 0 failed, 602 assertions. |
| `rtk bun run verify` | PASS, exit 0 | TypeScript check passed; 318 tests passed, 0 failed, 1,897 assertions; Bun build bundled 28 modules to `dist/cli.js` (0.34 MB). |
| `rtk git diff --check` | PASS, exit 0 | No whitespace errors. |

## Risks and Follow-ups

- The release-owner manual smoke checklist remains open:
  - [ ] Run one real-terminal single failure; keep the review readable until dismissal and confirm terminal restoration.
  - [ ] Run one real-terminal batch failure; keep the review readable until dismissal and confirm terminal restoration.
  - [ ] Run `--no-ui` and confirm immediate completion with the existing nonzero behavior.
  Automated evidence must not be treated as a substitute for this check before default-on release.
- Temporary run-lock directories from earlier fixture/test attempts remain outside the repository; they were not removed without explicit cleanup scope.
- The Expect protocol has behavioral end-to-end assertions but no separate numerical coverage metric, as anticipated by the task specification.
- The task frontmatter and lifecycle status remain runtime-owned and were not changed in this report phase.

## Final Verdict

Completed. The deterministic macOS PTY release infrastructure is present and the fresh handoff evidence shows the retained failure review, complete multiline diagnostic, exact recovery hint, Esc dismissal, terminal restoration, preserved exit status, focused suites, repository verification, and diff-integrity check all passing to terminal exit. Default-on release still requires the explicitly listed human real-terminal smoke checks.
