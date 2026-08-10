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

- The repository gate is `rtk bun run verify`; the macOS release gate to create is `rtk bun run test:pty` using `/usr/bin/script` and `/usr/bin/expect`.
- Ordered-multiple task 03–05 source integration is present in the current ancestry; the cockpit/session boundary is available for downstream command and review work without changing `src/events.ts`.
- `CockpitSession` is the renderer-owned seam exposed by `src/ui/cockpit.tsx`: `close()` is idempotent, `waitForDismissal()` resolves on dismissal or close, and `App` receives cancellation and dismissal callbacks separately.
- `CockpitStore.taskFailureDetails` keeps the raw trimmed task activity message
  only after a task enters `failed`; compact reasons and transcript lines still
  use the bounded display formatter. `selectTaskFailureDetail` uses the same
  qualified packet/task key as reasons and transcripts.
- Missing failed-task activity remains `undefined` rather than receiving a
  synthetic diagnostic. Existing checkpoint-delivery blockers continue to use
  the selector for their surfaced checkpoint reason, while blocked task
  activity does not populate task failure detail.

## Open Risks

- Downstream tasks must continue to preserve the integrated batch/event surfaces; this task did not edit them.

## Handoffs

- Task 01 and task 02 may proceed in parallel only after the external prerequisite is satisfied.
- Task 03 and task 04 may proceed in parallel after their internal dependencies and the external prerequisite are satisfied.
- Task 04 can consume exact multiline detail through `selectTaskFailureDetail`;
  it must preserve the explicit missing-detail state and the existing
  checkpoint-delivery review behavior.
