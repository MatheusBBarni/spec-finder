---
status: pending
title: Project Safe Report Outcomes in Cockpit State
type: frontend
complexity: medium
dependencies:
  - task_01
  - task_03
---

# Task 04: Project Safe Report Outcomes in Cockpit State

## Overview

Project the engine's optional completed-report reference and phase-tagged
updates into immutable cockpit state. The store will retain only syntactically
safe references, route phase to transcript normalization, and sanitize
interactive task activity before it becomes a cockpit failure reason, while
leaving engine/no-UI emission unchanged.

## Source Artifacts

- PRD: `.spec-finder/tasks/task-report-outcome/_prd.md`
- TechSpec: `.spec-finder/tasks/task-report-outcome/_techspec.md`

<critical>
- Read `.spec-finder/tasks/task-report-outcome/_prd.md`, `.spec-finder/tasks/task-report-outcome/_techspec.md`, ADRs `adr-001-phase-aware-report-outcomes.md`, `adr-002-verified-report-completion-rollout.md`, and `adr-003-additive-report-presentation-contract.md`, repository instructions, and current Git state before editing.
- Treat this task as canonical execution position `task_04`; complete `task_01` and `task_03` first because it consumes their event and display-safety contracts.
- Use `sf-memory`; read `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `.spec-finder/tasks/task-report-outcome/memory/task_04.md` before editing and update both with factual learnings before finishing.
- Implement only cockpit store projection, display-safe activity/reference handling, and store/command regressions. Do not change engine activity emission, no-UI output, or terminal App layout here.
- Reference TechSpec sections `Data Models and Lifecycle`, `Integration Points`, `Failure and Recovery Behavior`, and `Compatibility, Migration, and Rollback` instead of duplicating architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_04.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST pass session-update phase to the task_03 transcript projection and retain current active-packet task qualification for batch events (G-02, G-04, F-04).
2. MUST store/display a report reference only on completed task status and only after a defensive relative-path/control validation; absolute, traversal, malformed, failed, blocked, or absent references MUST be omitted (G-03, US-03, F-03, M-04).
3. MUST append the labelled completed outcome and safe `Report: <relative reference>` transcript detail without creating a false completed, failed, or blocked outcome from provider data (G-01, G-03, F-02, F-05, M-03).
4. MUST apply task_03's safe display formatter to interactive task activity before it becomes a transcript/error reason, preserving implementation-failure and dependency-blocked lifecycle semantics while keeping no-UI event emission unchanged (G-02, G-04, US-02, US-05).
5. SHOULD add command-level regression evidence that no-UI continues to ignore session updates and has no report-reference presentation surface (constraints).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, G-03, US-03, F-03 | Retain and show only safe completed references. | Store completion/reference cases. |
| G-02, US-02, F-02/F-04 | Keep provider/error display safe in the cockpit. | Sanitized task activity and metadata projection cases. |
| G-04, US-05 | Preserve failed/blocked semantics, no-UI behavior, and batch fence. | Store/commands/batch regression assertions. |
| TechSpec: Data Models / Failure and Recovery | Keep reference ephemeral and failure activity display-only. | Immutable state and no-reference-on-failure assertions. |

## Subtasks

- [ ] 04.1 Extend cockpit task/state projection with an optional validated completed-report reference.
- [ ] 04.2 Forward event phase into transcript normalization without weakening packet-qualified task routing.
- [ ] 04.3 Safely format interactive task activity and derive task failure reasons from that display-safe form.
- [ ] 04.4 Append safe report-reference outcome detail and omit all invalid/non-completed values.
- [ ] 04.5 Add store and no-UI command regression coverage for reference, failure, and stale batch events.

## Implementation Details

The engine is authoritative for filesystem containment; the store performs only
defense-in-depth syntactic display validation. Reuse the narrow formatter from
task_03 rather than duplicating sanitization logic. Keep `CockpitStore` updates
immutable and preserve `qualifiedTaskKey`/`localTaskId` behavior. The console
listener remains separate and must not consume presentation metadata.

### Relevant Files

- `src/ui/store.ts` — phase routing, completed reference state, and safe activity projection.
- `tests/store.test.ts` — reference, activity, failed/blocked, and batch-qualification cases.
- `tests/commands.test.ts` — no-UI compatibility assertions for additive events.

### Dependent Files

- `src/ui/transcript.ts` — task_03 supplies phase-aware and safe-format helpers.
- `src/events.ts` — task_01 provides optional phase/reference fields.
- `src/engine.ts` — task_02 emits completed-only references.
- `src/ui/App.tsx` and `tests/cockpit.test.tsx` — task_05 presents the projected state.

### Related ADRs

- [ADR-002: Verified Report Completion Rollout](adrs/adr-002-verified-report-completion-rollout.md) — preserve no-UI and implementation-failure scope.
- [ADR-003: Additive Report Presentation Contract](adrs/adr-003-additive-report-presentation-contract.md) — store defense in depth and batch compatibility.

## Deliverables

- Immutable cockpit state projection for phase and validated report reference.
- Interactive-only safe activity/reason formatting with existing lifecycle semantics.
- Focused store and no-UI compatibility coverage.
- Updated `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `memory/task_04.md` with factual durable context.
- `reports/task_04.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given completed status with a valid relative reference, retain it in the matching task and append labelled completion/reference transcript entries.
- [ ] Given absolute, traversal, control-containing, missing, failed, or blocked references, omit reference text and retain the correct existing status behavior.
- [ ] Given failed report activity containing a root path/control sequence, show only its safe formatted cockpit reason; given implementation failure or dependency block, preserve existing lifecycle labels.
- [ ] Given phase-tagged session updates and repeated local task IDs in a batch, route only the active qualified task and discard stale inactive-packet events.

### Integration Tests

- [ ] At the command listener boundary, pass additive session/status events through a no-UI run and verify no report metadata/reference is printed or stored by the console path.

### Platform or Manual Evidence

- [ ] Not applicable: App frame rendering is deferred to task_05; this task proves deterministic store/command state.

### Verification Commands

- `rtk bun test tests/store.test.ts tests/commands.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Cockpit state contains only safe, completed-report references and never makes provider data authoritative.
- Report-related activity cannot leak path/control content in the cockpit; no-UI emission is unchanged.
- Batch task qualification and existing failure/block behavior remain intact.
- Focused tests and repository verification pass to terminal exit; memory is current and `reports/task_04.md` is ready for the report phase.
- Changed testable logic reaches at least 80% coverage when measurable; this repository has no coverage threshold tool, so record scenario coverage when a percentage is unavailable.
