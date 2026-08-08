---
status: pending
title: Render checkpoint outcomes in the cockpit
type: frontend
complexity: medium
dependencies:
  - task_04
---

# Task 06: Render checkpoint outcomes in the cockpit

## Overview

Extend the read-only cockpit to distinguish lifecycle completion from checkpoint delivery. Operators should see a created local commit reference or a plain-text blocked reason, while summaries remain truthful and no meaning depends on color alone.

<critical>
- Read the PRD, TechSpec, ADRs, repository instructions, current Git state, and completed task_04 evidence before editing.
- Treat this task's numeric ID as its canonical execution position; task_04 must be completed first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_06.md` before editing and update memory before finishing.
- Implement only this task; preserve runtime, CLI, checkpoint, and archive behavior.
- Reference TechSpec §Integration Points, §Failure and Recovery Behavior, and §Observability.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST track checkpoint-created and checkpoint-blocked state independently from `TaskStatus`.
2. MUST show commit reference or bounded blocked reason in readable text and keep run/task summaries non-successful when delivery is blocked.
3. SHOULD preserve existing navigation, transcript, status, and color fallback behavior without making color the only signal.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-05/F-06, US-04/US-07 | Show delivery-blocked and created outcomes consistently | Store/cockpit tests |
| PRD C-07, M-04 | Separate lifecycle and delivery language | Render assertions |
| PRD NG-07 | Do not imply reviewed/merged state | Copy/snapshot review |
| TechSpec §Observability | Consume checkpoint events without exposing diffs/secrets | Event/store tests |

## Subtasks

- [ ] 06.1 Extend cockpit state/event consumption with independent checkpoint delivery data.
- [ ] 06.2 Render created commit references and blocked reasons in task/detail/run summaries.
- [ ] 06.3 Preserve existing status labels, navigation, transcript behavior, and non-color fallback.
- [ ] 06.4 Add store and frame assertions for success, blocked, and mixed-run states.

## Implementation Details

Follow TechSpec §Integration Points, §Failure and Recovery Behavior, and §Observability. Keep the cockpit observation-only; no retry, commit, or workflow control is added to the UI.

### Relevant Files

- `src/ui/store.ts` — event/state projection and task reasons.
- `src/ui/App.tsx` — task rows, summaries, labels, and outcome text.
- `tests/store.test.ts` — state/event selector tests.
- `tests/cockpit.test.tsx` — frame and copy assertions.

### Dependent Files

- `src/events.ts` and `src/engine.ts` — task_04 event contract.
- `src/ui/transcript.ts` — preserve existing transcript status rendering.

### Related ADRs

- [ADR-002: Automatic Local Recovery Checkpoints](adrs/adr-002-automatic-local-recovery-checkpoints.md) — checkpoint-blocked is visible and recoverable, not a control surface.
- [ADR-003: Shared Checkpoint Module and Task Delivery State](adrs/adr-003-shared-checkpoint-module-and-task-delivery-state.md) — delivery metadata remains separate from lifecycle status.

## Deliverables

- Cockpit delivery state projection and readable rendering.
- Store/frame tests for created/blocked/mixed outcomes.
- Updated `memory/MEMORY.md` and `memory/task_06.md` when warranted.
- `reports/task_06.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given completed status plus checkpoint-created event, state shows local commit reference without changing lifecycle status.
- [ ] Given checkpoint-blocked event, task reason contains the bounded error and the run is visibly unsuccessful.
- [ ] Given mixed completed/running/blocked tasks, counts remain truthful and existing navigation works.

### Integration Tests

- [ ] Render a blocked outcome in the cockpit frame and confirm the explanation is present without relying on color.
- [ ] Render a created outcome and confirm no copy implies review, merge, or push.

### Platform or Manual Evidence

- [ ] Capture a representative cockpit frame at the existing supported terminal sizes and inspect text clarity.

### Verification Commands

- `bun test tests/store.test.ts tests/cockpit.test.tsx`
- `bun run verify`

## Success Criteria

- Delivery state is visible and independent from task lifecycle status.
- Focused tests and `bun run verify` pass to terminal exit.
- The cockpit remains read-only and no unrelated rendering behavior changes.
