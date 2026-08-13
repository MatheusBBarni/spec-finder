---
status: pending
title: Implement pure loop detect and classification
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Implement pure loop detect and classification

## Overview

Add a pure `detectLoopAction` that derives the next recover, execute, or named terminal from a packet snapshot plus ledger. This is the continue-versus-stop contract later iteration uses, and it must treat task files as truth so a failed task never schedules another engine pass.

## Source Artifacts

- PRD: `.spec-finder/tasks/loop-packet-driver/_prd.md`
- TechSpec: `.spec-finder/tasks/loop-packet-driver/_techspec.md`

<critical>
- Read `.spec-finder/tasks/loop-packet-driver/_prd.md`, `.spec-finder/tasks/loop-packet-driver/_techspec.md`, packet ADRs 003 and 004, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; `task_01` must already be completed.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only pure detect/classification. Do not call `runTaskPacket`, write the ledger, or add CLI dispatch.
- Reference TechSpec sections Data and Control Flow and Failure and Recovery Behavior instead of duplicating terminal tables.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST derive the next action from packet files plus ledger with no mutable `current_phase` field (F-02, ADR-004).
2. MUST prefer pending report-only handoff and pending checkpoint delivery over new implementation (F-02, US-03).
3. MUST return terminal `failed` when any task status is `failed`, and MUST NOT recommend another execute pass in that case (F-03, C-04).
4. MUST return `done` only when every task is complete, no pending checkpoint delivery exists, and no open report handoff exists (F-03).
5. MUST return `no_op` when nothing is pending at the start of an invocation with no prior in-flight loop work to resume (F-03, empty-run compatibility).
6. SHOULD increment no-progress streak from completed/failed/blocked identity sets and return `stalled` or `exhausted` from ledger counters when those caps are already met before another pass (F-06).
7. MUST treat `in_progress` after a kill as remaining execute work, not as a loop terminal (ADR-004 implementation note).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-02, US-03 | Recover handoff/checkpoint first | Detect fixtures with those frontmatter fields |
| F-03, G-03 | Named terminals from files | Matrix of `done`/`no_op`/`failed`/`blocked`/`exhausted`/`stalled` |
| C-04 | Fail-fast, no re-execute of failed tasks | `failed` status yields terminal, not execute |
| C-07 | External residue uses ledger `blocker` | Detect returns `blocked` when `blocker` is set and files do not explain work |
| US-02 | Kill mid-task is remaining work | `in_progress` → execute |
| TechSpec: Failure and Recovery Behavior | Classification table | One test per named row that detect can see without running the engine |

## Subtasks

- [ ] 02.1 Define the detect action and terminal result types on top of task_01 ledger types.
- [ ] 02.2 Implement recover-first ordering from handoff and checkpoint helpers already in `src/tasks.ts`.
- [ ] 02.3 Implement done, no_op, failed, blocked-with-blocker, exhausted, and stalled outcomes.
- [ ] 02.4 Treat in-progress-after-kill as execute and keep detect free of filesystem writes.
- [ ] 02.5 Add a detect matrix in focused tests using in-memory task snapshots.

## Implementation Details

Use `.spec-finder/tasks/loop-packet-driver/_techspec.md` Data and Control Flow. Reuse `isCompletedStatus`, `hasPendingCheckpointDelivery`, and handoff fields from `src/tasks.ts`. Do not parse activity-event text. Detect may live in `src/loop.ts` as a pure export so task_04 can grow the coordinator in the same module without a second public surface.

### Relevant Files

- `src/loop.ts` — create; pure detect/classification exports.
- `src/loop-state.ts` — ledger types from task_01.
- `src/tasks.ts` — existing status/handoff/checkpoint helpers to call.
- `tests/loop.test.ts` — create; detect matrix.

### Dependent Files

- Later coordinator in `src/loop.ts` — consumes detect after each engine pass.
- `src/engine.ts` — unchanged in this task.

### Related ADRs

- [ADR-003: Isolated Loop Stack Above Unchanged `runTaskPacket`](adrs/adr-003-isolated-loop-stack.md) — detect is pure and engine-owned orchestration stays out of the CLI.
- [ADR-004: Packet-Local Ledger, File Detect, Exec-Like Exits](adrs/adr-004-loop-ledger-detect-and-exits.md) — file-based classification rules.

## Deliverables

- Pure detect/classification API with focused matrix tests.
- Updated `memory/MEMORY.md` and `memory/task_02.md` when warranted.
- `reports/task_02.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given a completed packet with no handoff or checkpoint, when detect runs on a fresh ledger, then the action is `no_op`.
- [ ] Given all tasks completed with reports and no pending delivery/handoff after prior iterations, when detect runs, then the action is `done`.
- [ ] Given one task with `handoff.phase === "report"`, when detect runs, then the action is recover-handoff, not execute.
- [ ] Given a completed task with pending checkpoint delivery, when detect runs, then the action is recover-checkpoint.
- [ ] Given any task `status: failed`, when detect runs, then the result is terminal `failed` even if later tasks are pending.
- [ ] Given `blocker` set and no recoverable handoff/checkpoint or pending eligible work, when detect runs, then the result is terminal `blocked`.
- [ ] Given `iteration >= max_iterations` before another pass, when detect runs, then the result is `exhausted`.
- [ ] Given an unchanged progress fingerprint for `no_progress_window` consecutive recorded iterations, when detect runs, then the result is `stalled`.
- [ ] Given a task `status: in_progress` after a simulated kill, when detect runs, then the action is execute.

### Integration Tests

- [ ] Not applicable: detect has no I/O or engine boundary in this task.

### Platform or Manual Evidence

- [ ] Not applicable.

### Verification Commands

- `bun test tests/loop.test.ts tests/loop-state.test.ts`
- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage meets repository policy or reaches 80% for changed testable logic when measurable.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
