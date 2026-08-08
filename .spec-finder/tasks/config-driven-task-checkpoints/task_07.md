---
status: pending
title: Keep blocked deliveries out of task archives
type: infra
complexity: medium
dependencies:
  - task_02
---

# Task 07: Keep blocked deliveries out of task archives

## Overview

Update archive classification so a task with `status: completed` but blocked checkpoint delivery remains in the active packet. Preserve existing archive behavior for packets without checkpoint metadata or with successful delivery.

<critical>
- Read the PRD, TechSpec, ADRs, repository instructions, current Git state, and completed task_02 evidence before editing.
- Treat this task's numeric ID as its canonical execution position; task_02 must be completed first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_07.md` before editing and update memory before finishing.
- Implement only this task; preserve checkpoint service, runtime, CLI, and UI behavior.
- Reference TechSpec §Integration Points, §Failure and Recovery Behavior, and §Compatibility, Migration, and Rollback.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST classify completed tasks with `checkpoint.state: blocked` as remaining and prevent packet archival.
2. MUST preserve DONE behavior for completed tasks with absent metadata or successful delivery metadata.
3. SHOULD explain the delivery blocker in archive reports without moving or editing task content.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-05, US-04 | Blocked delivery remains recoverable in the active packet | Classifier test |
| PRD C-07, M-04 | Archive outcome reflects delivery state | Script/skill test |
| PRD NG-02 | Failed/blocked delivery is never archived as complete | Negative archive case |
| TechSpec §Compatibility, Migration, and Rollback | Existing packets without metadata remain compatible | Existing archive fixture |

## Subtasks

- [ ] 07.1 Extend the classifier to inspect optional checkpoint state without changing task files.
- [ ] 07.2 Update archive skill wording/report guidance for checkpoint-blocked packets.
- [ ] 07.3 Add completed/blocked, completed/absent, and completed/created classifier tests.

## Implementation Details

Follow TechSpec §Integration Points and §Failure and Recovery Behavior. The archive classifier remains read-only with respect to task content and must continue to use exact `status: completed` as the lifecycle prerequisite plus delivery state as the new guard.

### Relevant Files

- `skills/sf-archive-tasks/scripts/scan-tasks.sh` — deterministic packet classifier.
- `skills/sf-archive-tasks/SKILL.md` — archive contract and user-facing explanation.
- `tests/archive-skill.test.ts` — classifier fixtures and verdict assertions.

### Dependent Files

- `src/tasks.ts` — task_02 metadata shape.
- `src/engine.ts` — task_04 persists blocked delivery state.

### Related ADRs

- [ADR-003: Shared Checkpoint Module and Task Delivery State](adrs/adr-003-shared-checkpoint-module-and-task-delivery-state.md) — blocked delivery is task-owned metadata.

## Deliverables

- Archive classifier and skill compatibility for blocked delivery.
- Focused archive tests.
- Updated `memory/MEMORY.md` and `memory/task_07.md` when warranted.
- `reports/task_07.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given all tasks `completed` with no checkpoint metadata, classifier returns DONE.
- [ ] Given a completed task with `checkpoint.state: blocked`, classifier returns REMAINING and names the blocker.
- [ ] Given completed tasks with successful/absent delivery metadata, classifier behavior remains unchanged.

### Integration Tests

- [ ] Run the archive classifier against a packet fixture containing mixed completed and blocked-delivery tasks and confirm no move is planned.

### Platform or Manual Evidence

- [ ] Review report-only output and confirm the classifier does not edit task content or create commits.

### Verification Commands

- `bun test tests/archive-skill.test.ts`
- `bun run verify`

## Success Criteria

- Blocked deliveries cannot be archived as fully complete.
- Existing archive classifications remain compatible.
- Focused tests and `bun run verify` pass to terminal exit.
