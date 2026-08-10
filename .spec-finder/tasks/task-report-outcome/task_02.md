---
status: completed
title: Issue Validated Report References
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Issue Validated Report References

## Overview

Make the engine the only source of a report reference. It will pass explicit
phase to both ACP turns and, only after the existing report acceptance check,
attach a canonical workspace-relative reference to completed task status when
that reference can be proven safe.

## Source Artifacts

- PRD: `.spec-finder/tasks/task-report-outcome/_prd.md`
- TechSpec: `.spec-finder/tasks/task-report-outcome/_techspec.md`

<critical>
- Read `.spec-finder/tasks/task-report-outcome/_prd.md`, `.spec-finder/tasks/task-report-outcome/_techspec.md`, ADRs `adr-001-phase-aware-report-outcomes.md`, `adr-002-verified-report-completion-rollout.md`, and `adr-003-additive-report-presentation-contract.md`, repository instructions, and current Git state before editing.
- Treat this task as canonical execution position `task_02`; complete `task_01` first because its event and ACP-turn contract is required.
- Use `sf-memory`; read `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `.spec-finder/tasks/task-report-outcome/memory/task_02.md` before editing and update both with factual learnings before finishing.
- Implement only engine-owned phase/reference issuance, its path validation, and deterministic engine fixture coverage. Preserve cockpit projection for later tasks and retain current no-UI activity emission.
- Reference TechSpec sections `Data and Control Flow`, `Data Models and Lifecycle`, `Failure and Recovery Behavior`, and `Security and Privacy` instead of duplicating architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_02.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST call the implementation and final-report ACP turns with `"implementation"` and `"report"` respectively, using task_01's required option (G-01, F-01).
2. MUST issue `reportReference` only with a completed task status after the existing successful-stop and `assertReport` conditions remain true (G-03, F-02, F-03, M-03).
3. MUST resolve workspace root and report target canonically, reject empty/absolute/traversal/control-containing or externally resolved results, and normalize a valid workspace-relative reference with `/` separators (G-02, G-03, F-03, M-01, M-04).
4. MUST omit an unprovable reference without converting an otherwise validated completion into failure; MUST emit no reference for failed, blocked, or pre-report implementation paths (US-02, US-03, US-05).
5. SHOULD extend the deterministic mock provider to reuse a session ID and optionally emit malicious report session-info so downstream integration coverage exercises the real two-turn boundary (TechSpec Testing and Evidence).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-01, M-02 | Supply explicit engine phases for both real turns. | Captured engine event ordering. |
| G-03, US-03, F-03, M-04 | Issue only canonical workspace-relative references after acceptance. | Temp-workspace valid/unsafe path cases. |
| G-02, F-02, M-01/M-03 | Keep provider metadata/prose out of authority and preserve validated completion predicate. | Malicious metadata and failed-report fixtures. |
| G-04, US-05 | Preserve implementation failure/no-UI lifecycle boundaries. | Existing permission/failure regression plus event assertions. |
| TechSpec: Failure and Recovery / Security | Omit unsafe references and retain existing activity emission. | Engine status and no-reference assertions. |

## Subtasks

- [ ] 02.1 Pass the two explicit phase values from the engine's implementation/report calls.
- [ ] 02.2 Add a canonical, failure-omitting report-reference validation helper at the established path/engine boundary.
- [ ] 02.3 Attach the validated reference only to completed status after existing report validation.
- [ ] 02.4 Extend the mock provider with deterministic repeated-session and malicious-report-metadata controls.
- [ ] 02.5 Add engine scenarios for success, unsafe/missing references, report failure, and unchanged implementation failure.

## Implementation Details

Keep `successfulStop`, `assertReport`, task-status persistence, and report-turn
ordering as the existing authoritative lifecycle. A reference-validation failure
is optional-display loss, not a task failure. Use canonical filesystem evidence
rather than report prompt text, ACP metadata, or report prose. Preserve the
engine's emitted activity text so the no-UI listener behavior does not change.

### Relevant Files

- `src/engine.ts` — pass phases and issue completed-only references after report validation.
- `src/paths.ts` — add or extend canonical workspace-relative reference validation.
- `tests/engine.test.ts` — temporary-workspace lifecycle, reference, and failure coverage.
- `tests/fixtures/mock-agent.ts` — deterministic repeated-session and report metadata fixture controls.

### Dependent Files

- `src/events.ts` and `src/acp-client.ts` — task_01 additive contract consumed here.
- `src/ui/store.ts` and `src/ui/App.tsx` — later tasks display the optional reference.
- `src/commands.ts` — receives unchanged engine activity and ignores the optional status field.

### Related ADRs

- [ADR-001: Phase-Aware Report Outcomes](adrs/adr-001-phase-aware-report-outcomes.md) — engine remains outcome authority.
- [ADR-003: Additive Report Presentation Contract](adrs/adr-003-additive-report-presentation-contract.md) — canonical reference validation and completed-only emission.

## Deliverables

- Explicit engine phase calls and completed-only validated `reportReference` emission.
- Canonical containment/reference helper with deterministic engine evidence.
- Enhanced reusable mock-provider controls for downstream cockpit acceptance.
- Updated `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `memory/task_02.md` with factual durable context.
- `reports/task_02.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given a valid report inside the canonical workspace, completed `task_status` carries a slash-normalized relative reference and never the temp root.
- [ ] Given missing, traversal, absolute, control-containing, external, or externally resolved symlink targets, emit no `reportReference`; retain the correct task completion/failure behavior.
- [ ] Given a report turn refusal, cancellation, max-token stop, or incomplete artifact, emit failed status with no reference and never completed status.

### Integration Tests

- [ ] Given the deterministic provider reusing `test-session`, capture both turn phases and a malicious report `session_info_update` while the engine still completes only from its validated file lifecycle.
- [ ] Given an implementation permission/refusal failure, verify no report turn/reference begins and current failure behavior remains.

### Platform or Manual Evidence

- [ ] Not applicable: temporary filesystem and ACP fixture scenarios cover canonical-path behavior; symlink setup may be skipped only where the host cannot create it, with the omission recorded.

### Verification Commands

- `rtk bun test tests/engine.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- The engine is the only source of phase and safe report-reference facts.
- Completion requires the current report validation; unsafe references are omitted without path disclosure.
- Focused engine tests and repository verification pass to terminal exit.
- Changed testable logic reaches at least 80% coverage when measurable; this repository has no coverage threshold tool, so record scenario coverage when a percentage is unavailable.
- Memory is current and `reports/task_02.md` is ready for the report phase.
