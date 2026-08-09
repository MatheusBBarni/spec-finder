# Task 09 Final Report: Certify and Enable Guarded Exec Capabilities

## Outcome

- Verdict: blocked
- Date: 2026-08-09
- Provider/session: no live provider session was certified; evidence comes from the immediate implementation-phase ACP handoff, fixture-backed tests, and the native macOS host.

Task 09 preserved the fail-closed release boundary. No real `exec` provider was enabled and guarded host access remains read-only because the mandatory native Linux/Windows and complete Claude/Codex/Cursor live matrices were not available with terminal evidence.

## Changes

- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` — retained the durable cross-task release blocker: all real exec providers and write access remain disabled until the complete matrix exists.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_09.md` — recorded certification evidence, environment limits, corrections, and the blocked report handoff.
- `.spec-finder/tasks/ad-hoc-acp-exec/reports/task_09.md` — this evidence-backed final report.
- No task-09 source policy files were changed. `src/providers.ts` still has `exec: false` for Claude, Codex, and Cursor; `src/exec-config.ts` and `src/exec.ts` still force `read-only` host access. Packet provider resolution remains independent of exec certification.

Unrelated dirty work in the repository was preserved.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Prove descendant cleanup within five seconds on native macOS, Linux, and Windows for normal completion, Ctrl-C, timeout, and unresponsive descendants. | Blocked | `rtk bun test ./tests/process-supervisor.test.ts ./tests/workspace-access.test.ts ./tests/acp-turn.test.ts ./tests/acp-client.test.ts` passed 29 tests, 0 failures, 103 expectations. Native Darwin fixture timings for the exercised cleanup scenarios were 14.66–134.27 ms, covering normal closure, POSIX process-group cleanup, escalation/second cancellation, detached-descendant deadline handling, and cleanup confirmation. The Windows branch assertion was injected, not native Windows evidence; no native Linux or Windows matrix was available. |
| 2. Run complete live Claude, Codex, and Cursor matrices for output, timing, streams, permissions, cancellation, close, cleanup, and persistence. | Blocked | No live ACP matrix reached terminal certification. Claude Code 2.1.206 and a Codex binary were present, `cursor-agent` was absent, and the `npx` ACP adapter probe produced no terminal output before being interrupted with exit 130. Version availability and fixture runs are not live-provider evidence. |
| 3. Certify guarded writes after containment, symlink/path-swap rejection, out-of-workspace denial, and cancellation rollback on every required host/provider combination. | Blocked | The current-host canonical workspace suite passed its adversarial fixture cases, but no guarded-write capability was enabled. Required cross-host/provider write and cancellation-rollback matrices were unavailable, so the release gate remains read-only. |
| 4. Enable only passing source-owned capabilities and leave incomplete capabilities disabled with a truthful blocked outcome. | Satisfied | `tests/providers.test.ts`, `tests/exec-config.test.ts`, and `tests/exec.test.ts` passed 27 tests, 0 failures, 97 expectations. They verify packet launch independence, rejection of uncertified real exec providers before spawn, immutable fixture cloning, and the read-only host gate. The source registry remains disabled for all three providers and the final verdict is blocked. |
| 5. Preserve packet provider behavior and pass the complete repository gate. | Satisfied | Packet/exec separation tests passed, `rtk bun run check` exited successfully, and `rtk bun run verify` passed 235 tests, 0 failures, 1,161 expectations; the Bun build completed successfully. No task-09 source policy change was made. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/providers.test.ts ./tests/exec-config.test.ts ./tests/exec.test.ts` | Passed | 27 tests, 0 failures, 97 expectations. |
| `rtk bun test ./tests/process-supervisor.test.ts ./tests/workspace-access.test.ts ./tests/acp-turn.test.ts ./tests/acp-client.test.ts` | Passed for fixture/native-macOS scope | 29 tests, 0 failures, 103 expectations. Native macOS process supervision passed its exercised scenarios; injected Windows behavior does not substitute for native Windows certification. |
| `rtk bun run check` | Passed | TypeScript check exited successfully. |
| `rtk bun run verify` | Passed | 235 tests, 0 failures, 1,161 expectations; Bun build completed with 27 modules and a 0.29 MB `dist/cli.js`. |
| `rtk git diff --check` | Passed | No whitespace errors reported. |
| Host/provider availability checks | Incomplete; release blocker | Host: Darwin 25.6 ARM64. PowerShell and `pwsh` were absent, `cursor-agent` was absent, and the ACP `npx` probe was interrupted at exit 130 without terminal certification. |

The verification commands above were run to terminal exit during the immediately preceding implementation phase; they were not rerun during report assembly because the handoff evidence was fresh and complete for the claims made here.

## Risks and Follow-ups

- Obtain native Linux and Windows hosts and run the full process-tree matrix for normal completion, Ctrl-C, timeout, and unresponsive descendants, recording cleanup elapsed time and terminal exits under five seconds.
- Run complete Claude, Codex, and Cursor ACP matrices on required hosts with redacted credentials, including first-visible-progress timing, stdout/stderr redirection, TTY and non-TTY permissions, semantic cancellation, capability-gated close, descendant cleanup, provider persistence, and no packet/history artifacts.
- Run guarded-write containment and cancellation-rollback matrices for every required host/provider combination before enabling any write capability.
- Resolve ACP adapter availability/authentication/network prerequisites, especially the missing Cursor executable and the non-terminal `npx` resolution.
- Keep `EXEC_PROVIDER_CERTIFICATION` false for every provider and keep `hostAccess` read-only until all mandatory evidence passes. Existing packet provider support is not affected.

## Final Verdict

Blocked. The focused regression and complete repository gates pass, and the source-owned policy correctly leaves all real exec providers and guarded writes disabled. However, the task’s mandatory native Linux/Windows cleanup evidence and complete live Claude/Codex/Cursor and guarded-write matrices were not available with terminal proof, so enabling capabilities or declaring release readiness would violate the task and ADR release boundaries.
