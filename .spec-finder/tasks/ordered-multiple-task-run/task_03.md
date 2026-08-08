---
status: pending
title: Add Batch Events and Active-Packet Store Projection
type: backend
complexity: high
dependencies:
  - task_02
---

# Task 03: Add Batch Events and Active-Packet Store Projection

## Overview

Extend the event and cockpit state contracts with an additive batch envelope. The store must retain compact outcomes for all declared packets while projecting detailed tasks/transcripts for only the active packet, avoiding the reset and task-ID collision behavior of nested singular events.

## Source Artifacts

- PRD: `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`
- TechSpec: `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`, `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`, all three packet ADRs, repository instructions, current Git state, and completed `task_01`/`task_02` evidence before editing.
- Treat `task_02` as a required lower-numbered dependency; preserve its result and lifecycle semantics.
- Use `sf-memory`; read `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` and `.spec-finder/tasks/ordered-multiple-task-run/memory/task_03.md` before editing and update them before finishing.
- Implement only event/state projection scope. Do not route commands or redesign the cockpit layout in this task.
- Reference TechSpec sections `System Architecture`, `Data Models and Lifecycle`, and `Integration Points`; do not relay nested `run_started`/`run_finished` directly to the batch store.
- Run focused tests and the repository verification gate to terminal exit. Do not mark status complete or write `reports/task_03.md`.
</critical>

<requirements>
1. MUST add batch lifecycle/outcome events without changing the existing single-run event payloads (G-04, F-03, C-01).
2. MUST retain ordered compact packet summaries with `succeeded`, `failed`, `cancelled`, `not_started`, and already-complete detail (G-02, US-02, F-03, F-05).
3. MUST project task/activity/session state only for the active packet and prevent repeated task IDs from colliding through packet-qualified internal keys (US-02, C-03).
4. MUST preserve existing single-run store reset, selection/following behavior, transcript isolation, reduced-color semantics, and read-only permission behavior (G-04, C-04, C-05).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-02, US-02, F-03 | Compact outcomes plus active detail | Store transition tests |
| F-05 | Already-complete summary detail | Batch packet event test |
| G-04, C-01 | Legacy single-run event compatibility | Existing store tests remain passing |
| C-03, C-05 | Internal qualification and no inactive transcript history | Repeated task-ID/isolation tests |
| TechSpec: Integration Points | Additive event/store boundary | Event union and consumer tests |

## Subtasks

- [ ] 03.1 Add `batch_started`, `batch_packet_started`, `batch_packet_finished`, and `batch_finished` variants with slug/index/outcome data.
- [ ] 03.2 Extend `CockpitState` with batch status, ordered summaries, active packet context, stopping packet, and not-started metadata.
- [ ] 03.3 Project packet-local task/activity/session events only for the active packet using internal qualified keys.
- [ ] 03.4 Preserve current singular event transitions, selectors, follow/manual inspection behavior, and permission handling.
- [ ] 03.5 Add store tests for lifecycle transitions, repeated task IDs, active packet switching, aggregate outcomes, and single-run regressions.

## Implementation Details

`run_started` currently resets the entire store and transcript maps use bare task IDs. Batch lifecycle events must therefore be handled separately. The event adapter should update summary state on packet boundaries and forward only task-level events belonging to the active packet. Qualification is internal; legacy consumers continue to receive the existing single-run shapes.

### Relevant Files

- `src/events.ts` — extend the closed `RunEvent` union additively.
- `src/ui/store.ts` — extend state and consume batch events without erasing prior summaries.
- `src/ui/transcript.ts` — existing transcript helpers; reuse them without changing retention policy.
- `tests/store.test.ts` — add batch projection/isolation coverage while preserving current tests.

### Dependent Files

- `src/commands.ts` — emits the batch event stream in `task_04`.
- `src/ui/App.tsx` — renders the new state in `task_05`.

### Related ADRs

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — active-packet boundary.
- [ADR-002: Compact Fail-Safe Sequence Product Scope](adrs/adr-002-compact-fail-safe-sequence-product-scope.md) — compact summaries and no history browser.
- [ADR-003: Coordinator Batch Envelope and Active Projection](adrs/adr-003-coordinator-batch-envelope-active-projection.md) — additive events and qualified projection keys.

## Deliverables

- Additive batch event union and store projection.
- Store tests for batch state, isolation, and legacy compatibility.
- Factual shared and `task_03` memory updates.
- `reports/task_03.md` produced by the report phase.

## Tests

### Unit Tests

- [ ] Batch start initializes summaries and active packet without invoking singular reset semantics.
- [ ] Packet finish retains prior outcomes and selects the next active packet.
- [ ] Repeated `task_01` IDs from two slugs retain separate internal transcripts and reasons.
- [ ] Failed/cancelled packet leaves later summaries `not_started` and aggregate state terminal.
- [ ] Already-complete detail is retained as a successful packet summary.

### Integration Tests

- [ ] Existing singular `run_started`, task, activity, session, runtime, permission, and `run_finished` store tests continue to pass unchanged.

### Platform or Manual Evidence

- [ ] Not applicable beyond store tests; cockpit frame evidence is owned by `task_05`.

### Verification Commands

- `rtk bun test ./tests/store.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Batch events are additive and do not reset or collide in the store.
- Compact outcomes survive active packet changes while detailed projection remains scoped.
- Existing single-run store behavior remains passing.
- Focused tests and repository verification pass to terminal exit with no unrelated changes.
