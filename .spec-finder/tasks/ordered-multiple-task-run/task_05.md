---
status: completed
title: Render the Batch Cockpit Experience
type: frontend
complexity: high
dependencies:
  - task_03
---

# Task 05: Render the Batch Cockpit Experience

## Overview

Extend the OpenTUI cockpit to make the whole sequence legible while keeping detailed task/transcript inspection on the active packet. The UI must show text-labelled packet outcomes, sequence position, cancellation/not-started/already-complete details, and manual recovery guidance without relying on color alone.

## Source Artifacts

- PRD: `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`
- TechSpec: `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`, `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`, all three packet ADRs, repository instructions, current Git state, and completed `task_01` through `task_03` evidence before editing.
- Treat `task_03` as the required lower-numbered state contract. `task_04` may run in parallel, so do not introduce command-only state assumptions.
- Use `sf-memory`; read `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` and `.spec-finder/tasks/ordered-multiple-task-run/memory/task_05.md` before editing and update them before finishing.
- Implement only cockpit rendering and UI tests. Preserve the current unrelated `App.tsx`, `cockpit.tsx`, and `tests/cockpit.test.tsx` dirty changes; adjust around them rather than reverting them.
- Reference TechSpec sections `System Architecture`, `Data and Control Flow`, `Integration Points`, `Security and Privacy`, and `Testing and Evidence`.
- Run focused tests and the repository verification gate to terminal exit. Do not mark status complete or write `reports/task_05.md`.
</critical>

<requirements>
1. MUST show active packet identity and sequence position while retaining compact outcomes for earlier packets (G-02, US-02, F-03).
2. MUST render `succeeded`, `failed`, `cancelled`, `not_started`, and `already complete` as understandable text/symbol combinations without color dependence (F-03, F-04, F-05, C-04).
3. MUST keep detailed task/transcript navigation scoped to the active packet and preserve existing follow/manual inspection/read-only behavior (US-02, C-03, C-05).
4. SHOULD make the stopping packet and manual no-retry recovery guidance obvious in the terminal UI (US-03, US-04, G-05).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-02, US-02, F-03 | Active detail plus compact prior summaries | OpenTUI frame assertions |
| F-04, US-03, US-04 | Distinct stop and recovery language | Failure/cancel frame assertions |
| F-05 | Already-complete informational label | Summary frame assertion |
| G-05, M-03 | Stopping-packet comprehension | Three-packet usability scenario |
| C-03, C-05 | No inactive transcript history or new controls | Store/UI interaction regression |

## Subtasks

- [ ] 05.1 Add compact sequence summary/header components that consume batch store state.
- [ ] 05.2 Preserve active packet task list, transcript selection, timing, scrolling, and read-only controls while batch summaries update.
- [ ] 05.3 Add text-first status labels and cancellation/not-started/already-complete recovery copy.
- [ ] 05.4 Add fixed-frame tests for normal, failure, cancellation, compact, reduced-color, and active-packet projection states.
- [ ] 05.5 Run the three-packet cockpit acceptance scenario and record evidence for M-03.

## Implementation Details

The existing App derives header/summary state from one packet's task statuses and contains app-local timing/renderer effects. Extend the existing layout rather than replacing it wholesale. Do not layer a second state model or timer over the current store. The batch UI should use the store's ordered summaries and active packet fields from `task_03`; prior transcripts remain unavailable by design.

### Relevant Files

- `src/ui/App.tsx` — batch header, compact summary, active packet context, and status copy.
- `src/ui/store.ts` — consume the state contract from `task_03`; avoid duplicating projection logic.
- `src/ui/cockpit.tsx` — existing OpenTUI renderer lifecycle; preserve cleanup.
- `tests/cockpit.test.tsx` — extend frame, keyboard, compact, and reduced-color tests while preserving current dirty changes.

### Dependent Files

- `src/events.ts` — additive event types consumed indirectly through the store.
- `src/commands.ts` — supplies the event stream in `task_04`.

### Related ADRs

- [ADR-002: Compact Fail-Safe Sequence Product Scope](adrs/adr-002-compact-fail-safe-sequence-product-scope.md) — compact summaries and active detail.
- [ADR-003: Coordinator Batch Envelope and Active Projection](adrs/adr-003-coordinator-batch-envelope-active-projection.md) — active projection boundary.

## Deliverables

- Batch-aware cockpit summary and active packet detail.
- OpenTUI frame and interaction tests for all approved states.
- Factual shared and `task_05` memory updates, including usability evidence.
- `reports/task_05.md` produced by the report phase.

## Tests

### Unit Tests

- [ ] Batch summary shows ordered succeeded/failed/cancelled/not-started packet labels.
- [ ] Active packet task and transcript remain selectable while previous summaries remain visible.
- [ ] Already-complete and cancellation details are text-readable without color.

### Integration Tests

- [ ] OpenTUI fixed frames at compact and normal sizes render the stopping packet and recovery guidance.
- [ ] Existing keyboard navigation, follow/manual inspection, transcript scrolling, reduced-color, and cleanup tests remain passing.

### Platform or Manual Evidence

- [ ] Evaluate a three-packet success and failure/cancellation sequence; at least four of five evaluators must identify the stopping packet and later not-started packets.

### Verification Commands

- `rtk bun test ./tests/cockpit.test.tsx ./tests/store.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Batch sequence status is legible without color and does not erase active detail.
- Existing cockpit behavior and unrelated UI changes are preserved.
- Focused tests, usability evidence, and repository verification pass to terminal exit.
