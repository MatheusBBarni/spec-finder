---
status: pending
title: Integrate checkpoint delivery into runtime execution
type: backend
complexity: high
dependencies:
  - task_03
---

# Task 04: Integrate checkpoint delivery into runtime execution

## Overview

Integrate the shared checkpoint service into ACP packet execution while preserving lifecycle ownership. Enabled runs must capture the memory-aware baseline, checkpoint only after verified report/status completion, stop downstream tasks on blocked delivery, and retry delivery on a normal rerun without another ACP implementation turn.

<critical>
- Read the PRD, TechSpec, ADRs, repository instructions, current Git state, and completed task_03 evidence before editing.
- Treat this task's numeric ID as its canonical execution position; task_03 must be completed first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_04.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not implement CLI/manual/UI/archive behavior beyond the event/result seam.
- Reference TechSpec §Data and Control Flow, §Failure and Recovery Behavior, and §Observability.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST branch on `auto_commit`, capture pre-memory/post-memory/task baselines, and invoke checkpoint begin before `in_progress` mutation.
2. MUST invoke completion only after implementation, report validation, and normal `completed` status; blocked delivery must stop downstream execution and produce a non-successful run result.
3. MUST detect blocked delivery on normal rerun, retry the checkpoint without ACP implementation/report turns, and continue only after success.
4. SHOULD emit created/blocked checkpoint events with task ID, commit reference, or bounded reason.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD G-01/G-03/G-04 | Runtime recovery, safety, and parity contract | Engine integration tests |
| PRD F-02/F-05/F-06 | Completion gate, blocked stop/retry, shared outcomes | Engine/event tests |
| PRD US-02/US-04/US-07 | Created result, refusal/recovery, runtime contract | Temp packet scenarios |
| PRD M-01/M-04 | Rerun avoids ACP turn; blocked state stops downstream work | Recovery measurement fixture |
| TechSpec §Data and Control Flow | Memory-aware baselines and retry path | Engine tests |
| TechSpec §Observability | RunResult/events communicate delivery outcome | Event/result assertions |

## Subtasks

- [ ] 04.1 Add memory-aware pre/post baseline sequencing and task begin integration before `in_progress`.
- [ ] 04.2 Add completion integration after report/status success and preserve normal failure behavior.
- [ ] 04.3 Add blocked-delivery stop semantics, run result counters, and checkpoint events.
- [ ] 04.4 Add normal-rerun delivery retry without ACP turns.
- [ ] 04.5 Extend engine fixtures for enabled, disabled, blocked, retry, and downstream-stop scenarios.

## Implementation Details

Follow TechSpec §System Architecture, §Data and Control Flow, §Integration Points, and §Failure and Recovery Behavior. Keep `src/engine.ts` as lifecycle owner. Do not make the checkpoint service mutate task status outside the existing engine ownership boundary.

### Relevant Files

- `src/engine.ts` — packet loop, memory initialization, task/report lifecycle, run result.
- `src/events.ts` — add checkpoint outcome event shape.
- `src/memory.ts` — expose or support the known memory-bootstrap sequencing boundary if required.
- `tests/engine.test.ts` — runtime lifecycle and Git fixture coverage.

### Dependent Files

- `src/checkpoints.ts` — task_03 shared service.
- `src/ui/store.ts` and `src/ui/App.tsx` — task_06 consume checkpoint events.
- `src/commands.ts` — task_05 must match runtime outcomes.

### Related ADRs

- [ADR-003: Shared Checkpoint Module and Task Delivery State](adrs/adr-003-shared-checkpoint-module-and-task-delivery-state.md) — runtime is a direct service consumer.
- [ADR-002: Automatic Local Recovery Checkpoints](adrs/adr-002-automatic-local-recovery-checkpoints.md) — checkpoint-blocked recovery boundary.

## Deliverables

- Runtime checkpoint integration and event/result behavior.
- Engine tests for enabled/disabled/recovery paths.
- Updated `memory/MEMORY.md` and `memory/task_04.md` when warranted.
- `reports/task_04.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given false/omitted config, no checkpoint service call or Git mutation occurs.
- [ ] Given a successful task, checkpoint completion occurs only after report validation and `status: completed`.
- [ ] Given a failed implementation/report, no checkpoint is created.
- [ ] Given blocked delivery, `RunResult.ok` is false and the downstream task does not start.

### Integration Tests

- [ ] A two-task packet with task_01 checkpoint failure emits blocked outcome and leaves task_02 unstarted.
- [ ] A normal rerun retries task_01 delivery without another mock ACP implementation/report turn, then starts task_02 after success.
- [ ] Checkpoint-created output includes task ID and commit reference; blocked output includes bounded reason.

### Platform or Manual Evidence

- [ ] Capture a no-UI run summary for created and blocked outcomes; confirm no color or cockpit is required for truthfulness.

### Verification Commands

- `bun test tests/engine.test.ts`
- `bun run verify`

## Success Criteria

- Runtime owns all lifecycle transitions and matches the TechSpec recovery flow.
- Focused tests and `bun run verify` pass to terminal exit.
- Disabled behavior remains unchanged and blocked delivery cannot advance downstream tasks.
