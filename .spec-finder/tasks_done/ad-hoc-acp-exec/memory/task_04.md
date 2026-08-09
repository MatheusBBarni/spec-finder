# Task Memory: task_04

## Objective Snapshot

- Implemented the standalone bounded process supervisor and deterministic process-tree fixture for task 04 without moving ACP semantic cancellation or packet lifecycle ownership.

## Important Decisions

- `NodeProcessSupervisor` launches providers with `shell: false`, explicit stdin/stdout/stderr pipes, merged inherited environment, and detached POSIX groups; the Windows branch delegates to a bounded direct `taskkill /PID <pid> /T /F` runner.
- `SupervisedProcessHandle.closed` waits for the child and all three pipe close events. `trackDescendant` plus a tree probe prevents direct-child exit from being treated as confirmed tree cleanup.
- Cleanup is idempotent: one shared promise performs POSIX TERM/KILL or Windows taskkill escalation. Absolute epoch deadlines and small duration values are both accepted for the neutral contract's `deadlineMs` input.
- Spawn failures reject with `ProcessSupervisorError` stage `spawn`; process and pipe failures remain observable through `closed` and the concrete handle's `failure`; cleanup uncertainty returns `unconfirmed`/`failed` rather than success.

## Learnings

- Bun 1.3.13 on macOS ARM64 supports the detached POSIX group fixture and descendant cleanup; the native recorded parent/descendant run returned `state: closed` in approximately 2 ms.
- The current worktree is intentionally broad and dirty from unrelated packet, checkpoint, UI, and task artifacts; only the task-owned supervisor and fixture/test files were added here.

## Files / Surfaces

- `src/process-supervisor.ts`
- `tests/process-supervisor.test.ts`
- `tests/fixtures/process-tree.ts`

## Errors / Corrections

- The first fixture version treated an absent descendant PID as an error for the normal exit mode; corrected the guard before focused verification.
- Deadline normalization was tightened to recognize epoch millisecond deadlines while retaining short duration inputs for injected tests.
- The direct-child/lingering-pipe assertion initially depended on catching the parent before its intentional exit; it now waits for the recorded parent PID to be gone, removing a scheduler-sensitive race.

## Ready for Next Run

- Focused supervisor suite passed: 10 tests, 0 failures, 28 expectations.
- `rtk bun run check` passed.
- `rtk bun run verify` passed: 199 tests, 0 failures, 996 expectations, and a successful 20-module Bun build.
- Native evidence is current-platform macOS only. Linux and Windows certification remain task 09 release gates.
- Report phase reviewed the fresh implementation handoff; no verification rerun was required.
