# Workflow Memory

## Current State

- Approved task plan written on 2026-08-08; all five tasks are pending.
- External integration prerequisite is satisfied in the current ancestry: ordered-multiple tasks 03–05 are archived with their source changes integrated.

## Shared Decisions

- This packet consumes existing batch events and outcomes; it must not modify `src/batch.ts` or `src/events.ts`.
- Execution uses the approved five-task DAG: session, exact store detail, command lifecycle, review UI, then macOS PTY release gate.

## Shared Learnings

- The repository gate is `rtk bun run verify`; the macOS release gate to create is `rtk bun run test:pty` using `/usr/bin/script` and `/usr/bin/expect`.
- Ordered-multiple task 03–05 source integration is present in the current ancestry; the cockpit/session boundary is available for downstream command and review work without changing `src/events.ts`.
- `CockpitSession` is the renderer-owned seam exposed by `src/ui/cockpit.tsx`: `close()` is idempotent, `waitForDismissal()` resolves on dismissal or close, and `App` receives cancellation and dismissal callbacks separately.

## Open Risks

- Downstream tasks must continue to preserve the integrated batch/event surfaces; this task did not edit them.

## Handoffs

- Task 01 and task 02 may proceed in parallel only after the external prerequisite is satisfied.
- Task 03 and task 04 may proceed in parallel after their internal dependencies and the external prerequisite are satisfied.
