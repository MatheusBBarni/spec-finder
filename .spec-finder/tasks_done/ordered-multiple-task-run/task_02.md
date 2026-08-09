---
status: completed
title: Implement Read-Only Preflight and Serial Coordination
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Implement Read-Only Preflight and Serial Coordination

## Overview

Build the sequential coordinator on top of the existing packet engine. It must validate the complete sequence before any packet mutation or provider launch, run packets in declared order with one shared signal/configuration, stop on failure or cancellation, and produce truthful aggregate outcomes including already-complete packets.

## Source Artifacts

- PRD: `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`
- TechSpec: `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ordered-multiple-task-run/_prd.md`, `.spec-finder/tasks/ordered-multiple-task-run/_techspec.md`, all three packet ADRs, repository instructions, current Git state, and completed `task_01` evidence before editing.
- Treat `task_01` as a required lower-numbered dependency; do not redefine parser or result contracts.
- Use `sf-memory`; read `.spec-finder/tasks/ordered-multiple-task-run/memory/MEMORY.md` and `.spec-finder/tasks/ordered-multiple-task-run/memory/task_02.md` before editing and update them before finishing.
- Implement only coordinator/preflight scope. Preserve the existing `runTaskPacket` behavior and unrelated dirty work; do not add store, renderer, command, or documentation changes.
- Reference TechSpec sections `Data and Control Flow`, `Core Interfaces`, `Data Models and Lifecycle`, and `Failure and Recovery Behavior`.
- Run focused tests and the exact repository verification gate to terminal exit. Do not mark task status complete or write `reports/task_02.md`.
</critical>

<requirements>
1. MUST load and validate every declared packet before `ensurePacketMemory`, status writes, or ACP launch; any preflight error starts zero packets (F-01, F-02, M-06).
2. MUST execute one packet at a time in declared order using one shared `AbortSignal` and effective runtime configuration (F-02, G-01, M-01).
3. MUST stop on the first packet failure or cancellation and mark every later packet `not_started` without invoking its runner (F-02, G-03, US-03, M-02).
4. MUST normalize shared-abort and ACP-cancelled outcomes to batch `cancelled`, while preserving permission refusals, provider errors, and report failures as `failed` (F-04, C-02).
5. MUST report a packet with no remaining execution order as `succeeded` with `already_complete` detail (F-05, C-06).
6. MUST accept an injected packet runner so ordering, failure, cancellation, and aggregate behavior are deterministic without provider processes (TechSpec: Core Interfaces).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-02, M-01 | Serial declared order | Runner invocation log |
| G-03, US-03, F-02, M-02 | Fail-fast stop and later `not_started` results | Failure/cancel fixtures |
| F-01, M-06 | Full read-only preflight | Zero-runner assertion |
| F-05, C-06 | Already-complete success detail | Empty execution-order test |
| F-04, C-02 | Cancellation/failure distinction | Abort and ACP stop-reason tests |
| TechSpec: Data Models and Lifecycle | Shared signal/config and no rollback | Coordinator integration tests |

## Subtasks

- [ ] 02.1 Implement full-sequence preflight with `loadTaskPacket` and `validateTasks`, including duplicate and unknown packet detection.
- [ ] 02.2 Execute preflighted packets serially through the injected/default `runTaskPacket` runner with shared options.
- [ ] 02.3 Normalize packet results and thrown abort/ACP cancellation into the approved aggregate outcomes and assign later `not_started` summaries.
- [ ] 02.4 Map empty packet execution order to successful `already_complete` detail without changing task-file status semantics.
- [ ] 02.5 Add deterministic tests for success, preflight failure, fail-fast failure, cancellation, already-complete packets, and shared abort behavior.

## Implementation Details

The coordinator must remain above `runTaskPacket`; do not move packet validation, memory initialization, or task status ownership into a new engine contract. Preflight is point-in-time and not transactional: if files change after preflight, the affected packet fails at runtime and earlier successful packets remain completed. The existing engine may mutate an active task file according to its current semantics; batch status is authoritative for sequence-level cancellation.

### Relevant Files

- `src/batch.ts` — extend the contracts from `task_01` with preflight, runner injection, serial execution, and aggregation.
- `src/tasks.ts` — verified read-only `loadTaskPacket`, `validateTasks`, and `executionOrder` helpers; avoid unnecessary edits.
- `src/engine.ts` — existing packet unit and cancellation edge cases to preserve.
- `tests/batch.test.ts` — extend with injected-runner and preflight scenarios.
- `tests/engine.test.ts` — boundary regression if a small engine-facing assertion is needed; do not alter singular semantics.

### Dependent Files

- `src/events.ts` and `src/ui/store.ts` — consume the coordinator lifecycle in `task_03`.
- `src/commands.ts` — invokes the coordinator and maps `BatchResult` to exit status in `task_04`.

### Related ADRs

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — preflight, serial fail-fast, and outcomes.
- [ADR-003: Coordinator Batch Envelope and Active Projection](adrs/adr-003-coordinator-batch-envelope-active-projection.md) — cancellation normalization and injected test seam.

## Deliverables

- Read-only preflight and serial coordinator implementation.
- Injected-runner tests covering all aggregate branches.
- Factual updates to shared and `task_02` memory.
- `reports/task_02.md` produced by the report phase.

## Tests

### Unit Tests

- [ ] Given three valid packets, invoke runners exactly in declared order and return aggregate success.
- [ ] Given an invalid later packet, invoke zero runners and return `preflight_failed`.
- [ ] Given a failed middle packet, never invoke later runners and mark them `not_started`.
- [ ] Given shared abort or ACP `cancelled`, return `cancelled` and preserve later `not_started` outcomes.
- [ ] Given permission refusal/provider/report failure, return `failed`, not `cancelled`.
- [ ] Given no remaining tasks, return successful `already_complete` detail.

### Integration Tests

- [ ] Verify the default runner shape remains compatible with `runTaskPacket` and uses one shared signal/configuration across packets.

### Platform or Manual Evidence

- [ ] Not applicable beyond deterministic Bun tests; real ACP cancellation boundary is covered only where the existing fixture can prove it without changing singular engine semantics.

### Verification Commands

- `rtk bun test ./tests/batch.test.ts ./tests/engine.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Full preflight starts zero packets on any invalid sequence.
- Ordered success, failure, cancellation, already-complete, and aggregate mappings are deterministic.
- No packet after the stopping packet is invoked.
- Existing `runTaskPacket` behavior and task-file status ownership remain compatible.
- Focused tests and the repository gate pass to terminal exit with no unrelated changes.
