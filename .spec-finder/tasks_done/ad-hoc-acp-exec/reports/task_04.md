# Task 04 Final Report: Implement Bounded Cross-Platform Process Supervision

## Outcome

- Verdict: completed
- Date: 2026-08-09
- Provider/session: unavailable; report produced from the same ACP session's local implementation handoff and fixture evidence.

Task 04 delivered a packet-neutral process supervisor with direct provider spawning, explicit stream lifetime tracking, bounded idempotent cleanup, POSIX process-group escalation, a Windows `taskkill` tree branch, and deterministic process-tree fixtures. ACP semantic cancellation, provider certification, and packet lifecycle behavior remain outside this task.

## Changes

- `src/process-supervisor.ts` — Added `NodeProcessSupervisor` with shell-free `node:child_process.spawn`, explicit stdin/stdout/stderr pipes, confirmed process-and-pipe closure, typed spawn/process/pipe/cleanup failures, isolated POSIX TERM/KILL cleanup, bounded Windows tree cleanup, descendant tracking, host-group safeguards, deadline handling, and idempotent second-cancel escalation.
- `tests/process-supervisor.test.ts` — Added focused lifecycle, failure, descendant, lingering-pipe, idempotency, second-cancel, cleanup-uncertainty, and simulated Windows branch coverage.
- `tests/fixtures/process-tree.ts` — Added deterministic direct-child/grandchild, intentional parent-exit/lingering-pipe, and detached-descendant fixtures with recorded PIDs.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_04.md` — Recorded implementation decisions, corrections, fresh handoff evidence, and the current report-phase handoff.
- `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` — Promoted the durable supervisor seam, cleanup confirmation rule, handoff, and platform-risk facts.

The worktree contains unrelated pre-existing packet, checkpoint, UI, and task changes; those changes were preserved and are not attributed to Task 04.

## Requirements

| Requirement | Status | Evidence |
|---|---|---|
| 1. Direct spawn, explicit pipes, confirmed closure, and typed spawn/process/pipe/cleanup failure stages | Satisfied | `NodeProcessSupervisor` uses `shell: false` and `stdio: ["pipe", "pipe", "pipe"]`; `closed` waits for process and all pipe close events; focused tests cover spawn, process, and pipe failures, with cleanup failures represented as non-success results. |
| 2. Idempotent deadline-driven POSIX-group and Windows child-tree cleanup without host-group signalling | Satisfied locally; native Windows certification pending | POSIX cleanup uses detached isolated groups with TERM/KILL escalation and host-PID safeguards; the Windows branch constructs direct `/PID <pid> /T /F` arguments and bounds the command; tests verify one shared escalation and the simulated Windows branch. Native Linux/Windows evidence remains the Task 09 release gate. |
| 3. Second cancellation skips remaining grace while preserving the coordinator's budget | Satisfied | The supervisor shares one cleanup promise and a second `cancelTree` request forces escalation immediately; focused tests assert promise identity and bounded completion. |
| 4. Direct-child exit is insufficient and an unconfirmed tree is a failure | Satisfied | Recorded-grandchild and parent-exits fixtures keep descendant state observable; tests reject direct-child-only closure and assert `unconfirmed` when a detached descendant remains by the deadline. |
| 5. Prefer built-in facilities and stop for approved Job Object design if native Windows evidence disproves `taskkill /T /F` | Satisfied as an implementation decision | The implementation uses Node/Bun runtime and OS facilities without a new dependency. The Windows reliability decision is intentionally deferred to native Task 09 evidence; a failure there requires the approved Job Object design review. |

## Verification

| Command or check | Result | Evidence |
|---|---|---|
| `rtk bun test ./tests/process-supervisor.test.ts` | Passed | 10 tests, 0 failures, 28 expectations. |
| `rtk bun run check` | Passed | TypeScript `tsc --noEmit` completed successfully. |
| `rtk bun run verify` | Passed | 199 tests, 0 failures, 996 expectations across 23 files; Bun bundled 20 modules successfully (`cli.js` 209.37 KB). |
| `rtk git diff --check` | Passed | No whitespace errors reported. |
| Native descendant-fixture harness (`rtk bun -e`, current platform) | Passed on macOS | Bun 1.3.13 on macOS ARM64 recorded parent PID 2479 and descendant PID 2480; cleanup reached `state: "closed"` in approximately 2 ms, with the direct process exiting on `SIGTERM`. |

The handoff evidence was complete and fresh for this report phase, so the focused and repository gates were not rerun.

## Risks and Follow-ups

- Only macOS native descendant-cleanup evidence exists. Linux and Windows native fixtures, plus the universal release decision, remain explicit Task 09 gates.
- The Windows `taskkill` path is covered through injected/simulated focused tests, not a native Windows run. If native evidence shows `taskkill /PID <pid> /T /F` is unreliable, stop and obtain the approved Job Object design rather than adding an unreviewed dependency.
- Live provider certification and ACP semantic cancellation remain downstream work; this supervisor does not claim either.
- Coverage was not separately measured by the required verification commands, so no percentage claim is made. The focused suite exercises the new state-machine branches.
- The broad dirty worktree was preserved; unrelated changes should be isolated before any commit or release review.

## Final Verdict

Task 04 is completed for its implementation boundary: the portable supervisor, deterministic fixtures, focused tests, and current-platform macOS evidence are present, and the exact focused and full repository gates passed. This report does not claim universal platform certification; Linux and Windows descendant cleanup remain Task 09 release work. Task frontmatter remains runtime-owned and was not changed by the report phase.
