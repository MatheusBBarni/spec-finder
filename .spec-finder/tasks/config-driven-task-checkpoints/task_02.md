---
status: pending
title: Persist checkpoint delivery state in task metadata
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Persist checkpoint delivery state in task metadata

## Overview

Add validated optional checkpoint-delivery metadata without replacing the existing task lifecycle status. Update task ordering so a completed task with blocked delivery can be retried on a later run while successfully delivered completed tasks remain skipped.

<critical>
- Read the PRD, TechSpec, ADRs, repository instructions, current Git state, and completed task_01 evidence before editing.
- Treat this task's numeric ID as its canonical execution position; task_01 must be completed first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not implement Git process execution or UI rendering.
- Reference TechSpec sections for metadata and lifecycle details instead of duplicating architecture prose.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST validate optional `checkpoint.state`, baseline head, digest, candidate paths, and blocked error fields while accepting existing task files with no metadata.
2. MUST preserve `status` semantics and make completed tasks with `checkpoint.state: blocked` eligible for delivery retry; delivered/absent completed tasks remain skipped.
3. SHOULD document the metadata shape for future task consumers without adding a second packet ledger.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-05, US-04 | Persist checkpoint-blocked recovery state | Metadata parser/order tests |
| PRD C-07, M-04 | Separate lifecycle completion from delivery state | Existing status compatibility tests |
| TechSpec §Data Models and Lifecycle | Implement active/blocked/absent transitions and retry ordering | Task tests and schema review |
| TechSpec §Compatibility, Migration, and Rollback | Absent metadata remains backward-compatible | Existing packet fixture |

## Subtasks

- [ ] 02.1 Add the optional checkpoint metadata schema and typed task-frontmatter shape.
- [ ] 02.2 Add safe task metadata update helpers that preserve status, body, and unrelated frontmatter.
- [ ] 02.3 Update execution ordering and task validation for blocked-delivery retry cases.
- [ ] 02.4 Update the task-context schema documentation with the delivery metadata contract.

## Implementation Details

Follow TechSpec §Data Models and Lifecycle and §Integration Points. Keep checkpoint metadata task-owned and optional. Do not add commit execution, event types, UI rendering, or archive behavior in this task.

### Relevant Files

- `src/tasks.ts` — frontmatter schema, task parsing, status update, and execution order.
- `tests/tasks.test.ts` — task parsing/order/update coverage.
- `skills/sf-create-tasks/references/task-context-schema.md` — task metadata documentation.

### Dependent Files

- `src/checkpoints.ts` — task_03 will persist active/blocked records.
- `src/engine.ts` — task_04 will retry blocked delivery without ACP turns.
- `skills/sf-archive-tasks/scripts/scan-tasks.sh` — task_07 consumes blocked metadata.

### Related ADRs

- [ADR-003: Shared Checkpoint Module and Task Delivery State](adrs/adr-003-shared-checkpoint-module-and-task-delivery-state.md) — task-level metadata is the recovery boundary.
- [ADR-001: Config-Driven Per-Task Git Checkpoints](adrs/adr-001-config-driven-task-checkpoints.md) — preserve existing lifecycle status.

## Deliverables

- Validated checkpoint metadata and update/order behavior.
- Task and schema documentation tests/evidence.
- Updated `memory/MEMORY.md` and `memory/task_02.md` when warranted.
- `reports/task_02.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given no checkpoint metadata, parsing and execution order match current behavior.
- [ ] Given valid active/blocked metadata, parsing succeeds and preserves task body/frontmatter.
- [ ] Given invalid state, missing required base fields, malformed digest, or unsafe path, validation fails clearly.
- [ ] Given completed plus blocked delivery, execution order includes the task for retry.
- [ ] Given completed with absent/non-blocked delivery, execution order skips the task.
- [ ] Given a metadata update, status, dependencies, title, and body remain intact.

### Integration Tests

- [ ] Load a two-task packet where task_01 is completed/blocked and confirm task_01 precedes task_02 for recovery ordering.

### Platform or Manual Evidence

- [ ] Review the schema documentation against the parser and record any compatibility note.

### Verification Commands

- `bun test tests/tasks.test.ts`
- `bun run verify`

## Success Criteria

- Metadata validation and retry ordering satisfy the TechSpec lifecycle contract.
- Existing packets without metadata remain valid.
- Focused tests and `bun run verify` pass to terminal exit.
- No Git, runtime, UI, or archive behavior is absorbed beyond the metadata seam.
