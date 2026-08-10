---
status: completed
title: Add Typed No-Work Engine Outcome
type: backend
complexity: medium
dependencies: []
---

# Task 01: Add Typed No-Work Engine Outcome

## Overview

Make a valid packet whose existing execution plan is empty a named, successful
engine outcome rather than generic `0 tasks completed` text. This creates the
backward-compatible contract that the no-UI command and read-only cockpit will
consume, while proving that no ACP/report work begins.

## Source Artifacts

- PRD: `.spec-finder/tasks/empty-run-state/_prd.md`
- TechSpec: `.spec-finder/tasks/empty-run-state/_techspec.md`

<critical>
- Read `.spec-finder/tasks/empty-run-state/_prd.md`, `.spec-finder/tasks/empty-run-state/_techspec.md`, and ADRs `adr-001-empty-run-state.md`, `adr-002-default-informative-no-work.md`, and `adr-003-typed-no-work-lifecycle.md`, repository instructions, and current Git state before editing.
- Treat this task as canonical execution position `task_01`; it has no dependencies and establishes the sole no-work fact for later tasks.
- Use `sf-memory`; read `.spec-finder/tasks/empty-run-state/memory/MEMORY.md` and `.spec-finder/tasks/empty-run-state/memory/task_01.md` before editing and update both with factual learnings before finishing.
- Implement only the engine/event contract and its tests. Preserve unrelated work, especially in-progress batch event variants, and do not implement cockpit or command retention here.
- Reference TechSpec sections `Core Interfaces`, `Engine Behavior`, `Failure and Recovery Behavior`, `Security and Privacy`, and `Compatibility, Migration, and Rollback` instead of duplicating their architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_01.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST classify only a loaded, validated packet with `executionOrder(...).length === 0` as successful `outcome: "no_work"` with `reason: "all_tasks_complete"` (G-01, F-01, C-01).
2. MUST add the outcome/reason additively to both `RunResult` and the existing `run_finished` event, preserving current fields and omitting metadata on normal, failed, and cancelled paths (G-02, F-01).
3. MUST not launch ACP, create reports, mutate task status, or emit task lifecycle work for the no-work path (F-04, C-06, M-02).
4. SHOULD retain taskless packets and validation failures as existing errors rather than treating them as no-work (C-05).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-01, M-01 | Publish a typed all-complete outcome | Empty-order engine fixture and terminal event assertions |
| G-02, F-04, C-01, C-06, M-02 | Keep no-work successful and provider-free | Result/event assertions plus provider launch sentinel |
| C-05 | Keep invalid/taskless packets distinct | Invalid fixture rejects without no-work event |
| TechSpec: Core Interfaces / Engine Behavior | Preserve optional compatibility shape | Normal success and failure regression tests |
| TechSpec: Security and Privacy | Do not reach ACP/report paths | Filesystem and launch-sentinel assertions |

## Subtasks

- [ ] 01.1 Define the bounded no-work reason and optional result/event metadata without replacing existing terminal contracts.
- [ ] 01.2 Emit and return the typed successful outcome from the valid empty-order path using the planner's actual result.
- [ ] 01.3 Preserve invalid, cancelled, normal-success, and failure behavior without inferring outcomes from message text.
- [ ] 01.4 Add focused engine fixtures covering all-complete, provider-free, invalid, and normal-run regression behavior.

## Implementation Details

Use the actual `executionOrder(packet.tasks)` result after existing loading,
validation, and packet-memory initialization. The only V1 reason is
`all_tasks_complete`; do not add a generic taxonomy or a dedicated terminal
event. Existing event consumers and injected runners must remain source
compatible, including pending batch work that may ignore optional fields.

### Relevant Files

- `src/engine.ts` — compute and return the bounded no-work result without entering the task loop.
- `src/events.ts` — extend the existing `run_finished` member of the closed event union additively.
- `tests/engine.test.ts` — create deterministic temp-packet coverage and provider launch sentinel assertions.
- `src/tasks.ts` — existing planner/loader semantics to consume, not change.

### Dependent Files

- `src/commands.ts` — later task branches on the typed result rather than message text.
- `src/ui/store.ts` — later task projects optional terminal metadata.
- `src/batch.ts` and `tests/batch.test.ts` — compatibility consumers that must retain `already_complete` behavior.

### Related ADRs

- [ADR-001: Empty-run state](adrs/adr-001-empty-run-state.md) — valid empty-order scope and error boundary.
- [ADR-003: Typed no-work outcome and command-owned exit lifecycle](adrs/adr-003-typed-no-work-lifecycle.md) — optional fields and compatibility boundary.

## Deliverables

- Additive typed no-work contract in the engine and terminal event.
- Focused engine tests that prove the all-complete and no-provider invariants.
- Updated `.spec-finder/tasks/empty-run-state/memory/MEMORY.md` and `memory/task_01.md` with factual durable context.
- `reports/task_01.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given a valid packet containing only `completed`, `done`, and `finished` tasks, `runTaskPacket` returns successful `no_work`/`all_tasks_complete` metadata and emits matching `run_finished` metadata.
- [ ] Given that all-complete packet and a provider launch sentinel, no ACP/provider call, report, or task-status mutation occurs.
- [ ] Given a packet with no task files or validation defects, retain the existing error and emit no no-work terminal event.
- [ ] Given a normal successful or failed packet, retain existing counts/behavior and omit no-work metadata.

### Integration Tests

- [ ] Confirm `RunResult` remains usable by existing injected runner shapes and `RunEvent` continues to accept the current batch variants.

### Platform or Manual Evidence

- [ ] Not applicable: engine behavior is deterministic Bun/temporary-filesystem coverage.

### Verification Commands

- `rtk bun test tests/engine.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Valid all-complete packets expose one typed successful outcome; errors and cancellations do not.
- The no-work path starts zero provider/report/task-mutation work.
- Focused tests and the repository gate pass to terminal exit.
- No cockpit, command lifecycle, batch behavior, or unrelated user-owned change is absorbed.
- Memory is current and `reports/task_01.md` is ready for the report phase.
