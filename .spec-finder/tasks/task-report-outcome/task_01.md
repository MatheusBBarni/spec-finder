---
status: pending
title: Add Phased ACP Event Contracts
type: backend
complexity: medium
dependencies: []
---

# Task 01: Add Phased ACP Event Contracts

## Overview

Add the narrow typed contract that lets every ACP update retain its engine-known
implementation or report turn. This eliminates session-ID and activity-text
inference while remaining additive for existing event consumers, including
batch forwarding and no-UI listeners.

## Source Artifacts

- PRD: `.spec-finder/tasks/task-report-outcome/_prd.md`
- TechSpec: `.spec-finder/tasks/task-report-outcome/_techspec.md`

<critical>
- Read `.spec-finder/tasks/task-report-outcome/_prd.md`, `.spec-finder/tasks/task-report-outcome/_techspec.md`, ADRs `adr-001-phase-aware-report-outcomes.md`, `adr-002-verified-report-completion-rollout.md`, and `adr-003-additive-report-presentation-contract.md`, repository instructions, and current Git state before editing.
- Treat this task as canonical execution position `task_01`; it has no dependencies and establishes the phase contract consumed by all later tasks.
- Use `sf-memory`; read `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `.spec-finder/tasks/task-report-outcome/memory/task_01.md` before editing and update both with factual learnings before finishing.
- Implement only the event/ACP contract and its tests. Preserve unrelated work, especially active batch event variants, and do not implement engine report references or cockpit projection here.
- Reference TechSpec sections `Core Interfaces`, `Integration Points`, `Compatibility, Migration, and Rollback`, and `Testing and Evidence` instead of duplicating architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_01.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST export `AcpTurnPhase` with only `"implementation"` and `"report"`, and add optional `phase` to the existing `session_update` event without replacing the event family (G-01, G-02, F-01, F-04).
2. MUST make `AcpTurnOptions.phase` required and copy it onto every forwarded session update; phase MUST not be inferred from ACP session ID, prompt text, provider metadata, or activity copy (G-01, F-01, ADR-003).
3. MUST retain every existing event variant and ACP v1 wire behavior; do not add protocol fields, settings, provider changes, persistence, or no-UI handling (G-04, constraints).
4. SHOULD preserve source compatibility for legacy synthetic `RunEvent.session_update` literals by keeping event-level phase optional (TechSpec Core Interfaces).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-01 | Establish engine-authored report/implementation attribution. | ACP event assertions with explicit phase. |
| G-02, F-04 | Supply the safety discriminator without rendering provider metadata. | Type and forwarding regression tests. |
| G-04, constraints | Preserve existing event consumers and ACP v1. | Type check and existing command/batch suite. |
| TechSpec: Core Interfaces / Integration Points | Keep optional event compatibility but required runtime turn option. | Compile-time and focused ACP tests. |

## Subtasks

- [ ] 01.1 Define the bounded phase type and additive event member fields.
- [ ] 01.2 Require phase at the ACP turn boundary and forward it with every streamed update.
- [ ] 01.3 Update all direct ACP-turn test invocations to supply an explicit phase.
- [ ] 01.4 Prove phase forwarding while retaining existing permission and message behavior.

## Implementation Details

Use the existing `RunEvent` union and the `runAcpTurn` forwarding loop. This
phase is local Spec Finder event context; do not change the ACP SDK request or
notification schema. Keep provider transport in `src/acp-client.ts` and leave
task lifecycle ownership to the next task.

### Relevant Files

- `src/events.ts` — extend the internal event contract additively.
- `src/acp-client.ts` — require turn phase and attach it to forwarded updates.
- `tests/acp-client.test.ts` — verify phase propagation and existing ACP behavior.

### Dependent Files

- `src/engine.ts` — supplies the two authoritative phase values in task_02.
- `src/ui/store.ts` and `src/ui/transcript.ts` — consume the phase in tasks 03–04.
- `src/batch.ts`, `src/commands.ts`, and their tests — must continue accepting the additive event shape.

### Related ADRs

- [ADR-001: Phase-Aware Report Outcomes](adrs/adr-001-phase-aware-report-outcomes.md) — phase must be explicit rather than inferred.
- [ADR-003: Additive Report Presentation Contract](adrs/adr-003-additive-report-presentation-contract.md) — optional event compatibility and required ACP option.

## Deliverables

- Additive `AcpTurnPhase` and event/ACP-turn contract.
- Focused ACP client coverage for both phase forwarding and existing permission behavior.
- Updated `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `memory/task_01.md` with factual durable context.
- `reports/task_01.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given an implementation-phase turn, every emitted `session_update` contains `phase: "implementation"` while its original update and session ID remain intact.
- [ ] Given a report-phase turn, every emitted update—including an update after a permission response—contains `phase: "report"`.
- [ ] Given existing event literals without phase, TypeScript accepts the additive event shape and existing consumers retain their fields.

### Integration Tests

- [ ] Confirm ACP v1 initialization, prompt completion, cancellation, and permission behavior remain unchanged except for the local emitted phase field.

### Platform or Manual Evidence

- [ ] Not applicable: ACP transport behavior is covered by deterministic local Bun fixture tests.

### Verification Commands

- `rtk bun test tests/acp-client.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Every runtime ACP turn has an explicit phase and every streamed update carries it.
- No ACP wire protocol, provider configuration, event variant, or no-UI behavior changes.
- Focused tests and repository verification pass to terminal exit with measurable coverage for changed forwarding logic.
- Changed testable logic reaches at least 80% coverage when measurable; this repository has no coverage threshold tool, so record scenario coverage when a percentage is unavailable.
- Memory is current and `reports/task_01.md` is ready for the report phase.
