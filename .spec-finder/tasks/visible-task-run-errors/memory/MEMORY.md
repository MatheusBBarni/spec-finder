# Workflow Memory

## Current State

- Approved task plan written on 2026-08-08; task 01's session source is
  integrated and task 02's store projection is verified in the current
  worktree. Runtime-owned task status and reports remain untouched.
- External integration prerequisite is satisfied in the current ancestry: ordered-multiple tasks 03–05 are archived with their source changes integrated.

## Shared Decisions

- This packet consumes existing batch events and outcomes; it must not modify `src/batch.ts` or `src/events.ts`.
- Execution uses the approved five-task DAG: session, exact store detail, command lifecycle, review UI, then macOS PTY release gate.

## Shared Learnings

- The repository gate is `rtk bun run verify`; the macOS release gate is
  `rtk bun run test:pty` using `/usr/bin/script` and `/usr/bin/expect`. The
  deterministic PTY fixture and Expect protocol are present in the task-owned
  test surfaces and pass on macOS; real-terminal manual smoke remains a release
  owner check.
- Ordered-multiple task 03–05 source integration is present in the current ancestry; the cockpit/session boundary is available for downstream command and review work without changing `src/events.ts`.
- `CockpitSession` is the renderer-owned seam exposed by `src/ui/cockpit.tsx`: `close()` is idempotent, `waitForDismissal()` resolves on dismissal or close, and `App` receives cancellation and dismissal callbacks separately.
- Command execution now uses one shared lifecycle policy for single and batch runs: interactive mode requires explicit no-UI opt-out to be absent plus both stdin and stdout TTYs; only non-aborted single failures and batch `status: "failed"` wait for dismissal; cancellation aborts and closes immediately through a guarded command-owned path.
- `CockpitStore.taskFailureDetails` keeps the raw trimmed task activity message
  only after a task enters `failed`; compact reasons and transcript lines still
  use the bounded display formatter. `selectTaskFailureDetail` uses the same
  qualified packet/task key as reasons and transcripts.
- Missing failed-task activity remains `undefined` rather than receiving a
  synthetic diagnostic. Existing checkpoint-delivery blockers continue to use
  the selector for their surfaced checkpoint reason, while blocked task
  activity does not populate task failure detail.
- Task 04's retained failure review is covered by cockpit frame and mock-input
  evidence for exact scrolling, missing-detail notice, settled keyboard
  dismissal, batch stopping context, compact/reduced-color rendering, and the
  absence of workflow controls.
- Task 05's PTY gate uses a synthetic per-process run-lock root and separate
  macOS Expect pattern/action clauses; this avoids stale-lock interference and
  proves the multiline review remains until Esc before exit `1`.

## Open Risks

- Downstream tasks must continue to preserve the integrated batch/event surfaces; this task did not edit them.

## Handoffs

- Task 01 and task 02 may proceed in parallel only after the external prerequisite is satisfied.
- Task 03 and task 04 may proceed in parallel after their internal dependencies and the external prerequisite are satisfied.
- Task 04 can consume exact multiline detail through `selectTaskFailureDetail`;
  it must preserve the explicit missing-detail state and the existing
  checkpoint-delivery review behavior.
- Task 04's implementation and report handoff have fresh focused and full-gate
  evidence. Task 05 now supplies the automated macOS PTY evidence; the manual
  terminal smoke checklist remains part of the release-owner handoff.
