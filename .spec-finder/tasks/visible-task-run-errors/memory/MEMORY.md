# Workflow Memory

## Current State

- Approved task plan written on 2026-08-08; all five tasks are pending.
- External integration prerequisite: ordered-multiple tasks 03–05 must be integrated before implementation begins. Current dirty changes are not completion evidence.

## Shared Decisions

- This packet consumes existing batch events and outcomes; it must not modify `src/batch.ts` or `src/events.ts`.
- Execution uses the approved five-task DAG: session, exact store detail, command lifecycle, review UI, then macOS PTY release gate.

## Shared Learnings

- The repository gate is `rtk bun run verify`; the macOS release gate to create is `rtk bun run test:pty` using `/usr/bin/script` and `/usr/bin/expect`.

## Open Risks

- The batch integration prerequisite is concurrently owned elsewhere; preserve its work and block rather than overwrite if it is not integrated.

## Handoffs

- Task 01 and task 02 may proceed in parallel only after the external prerequisite is satisfied.
- Task 03 and task 04 may proceed in parallel after their internal dependencies and the external prerequisite are satisfied.
