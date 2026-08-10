---
status: completed
title: Render and Verify Report Outcomes
type: frontend
complexity: medium
dependencies:
  - task_02
  - task_04
---

# Task 05: Render and Verify Report Outcomes

## Overview

Complete the user-visible cockpit experience by rendering text-labelled report
completion, failure, and safe report references in live transcript and terminal
summary views. Prove the end-to-end contract through deterministic OpenTUI
frames that include malicious metadata, repeated provider session IDs, reduced
color, and no false report outcome.

## Source Artifacts

- PRD: `.spec-finder/tasks/task-report-outcome/_prd.md`
- TechSpec: `.spec-finder/tasks/task-report-outcome/_techspec.md`

<critical>
- Read `.spec-finder/tasks/task-report-outcome/_prd.md`, `.spec-finder/tasks/task-report-outcome/_techspec.md`, ADRs `adr-001-phase-aware-report-outcomes.md`, `adr-002-verified-report-completion-rollout.md`, and `adr-003-additive-report-presentation-contract.md`, repository instructions, and current Git state before editing.
- Treat this task as canonical execution position `task_05`; complete `task_02` and `task_04` first because it renders their engine-issued reference and safe state projection.
- Use `sf-memory`; read `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `.spec-finder/tasks/task-report-outcome/memory/task_05.md` before editing and update both with factual learnings before finishing.
- Implement only terminal presentation and its captured-frame acceptance evidence. Preserve batch summary ownership, read-only controls, and all non-report cockpit behavior.
- Reference TechSpec sections `Data Models and Lifecycle`, `Failure and Recovery Behavior`, `Testing and Evidence`, and `Observability` instead of duplicating architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_05.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST render the existing report-running activity and a clearly text-labelled completed or failed task outcome without relying only on color or symbols (G-01, US-01, US-02, F-01, F-02, F-05, M-02, M-05).
2. MUST show `Report: <workspace-relative reference>` only when task_04 has retained a validated reference, including in the terminal summary; MUST not render a generic unavailable message (G-03, US-03, F-03, M-04).
3. MUST ensure captured frames never expose report prompt/title/absolute path/control payload and never claim report-level `blocked` from provider metadata/prose (G-02, F-02, F-04, M-01, M-03).
4. MUST preserve reduced-color readability, batch-summary ownership, existing escape/read-only controls, and non-report transcript rendering (G-04, F-05).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-01, US-01, F-01/F-05, M-02/M-05 | Render visible lifecycle/outcome labels in live and terminal views. | Normal/reduced-color OpenTUI frames. |
| G-03, US-03, F-03, M-04 | Render stored relative reference without absence placeholder. | Completed summary/transcript frame assertions. |
| G-02, F-04, M-01 | Keep malicious prompt/path/control metadata absent in final UI. | Negative frame assertions. |
| G-04, US-05 | Preserve existing UI, batch, and read-only constraints. | Existing frame regressions and unchanged controls. |
| TechSpec: End-to-End Evidence / Observability | Make M-01 through M-05 objectively checkable. | Captured acceptance scenario matrix. |

## Subtasks

- [ ] 05.1 Add the completed-task report reference to the applicable transcript and terminal-summary presentation.
- [ ] 05.2 Preserve concise running and failed report text labels within current layout/scrolling constraints.
- [ ] 05.3 Add deterministic OpenTUI frames for success/reference, report failure, malicious metadata absence, and reduced-color readability.
- [ ] 05.4 Re-run existing cockpit/batch/read-only frame coverage to prevent presentation regressions.

## Implementation Details

Use existing `RunSummary`, `TranscriptRow`, task status strip, and responsive
frame helpers. Render only the `CockpitTask.reportReference` retained by
task_04; App must not inspect ACP updates, prompt text, absolute filesystem
paths, or report content. Do not aggregate report-reference history across
batch packet summaries, introduce controls, or alter Escape/Q ownership.

### Relevant Files

- `src/ui/App.tsx` — completed reference and terminal outcome presentation.
- `tests/cockpit.test.tsx` — rendered OpenTUI-frame acceptance matrix.

### Dependent Files

- `src/ui/store.ts` — task_04 supplies safe reference, status, and transcript state.
- `src/ui/transcript.ts` — task_03 supplies metadata-safe entries.
- `src/engine.ts` and `tests/fixtures/mock-agent.ts` — task_02 supplies end-to-end phase/reference fixture behavior.
- `src/ui/cockpit.tsx` — existing renderer lifecycle that must remain unchanged.

### Related ADRs

- [ADR-001: Phase-Aware Report Outcomes](adrs/adr-001-phase-aware-report-outcomes.md) — concise outcome and no provider authority.
- [ADR-002: Verified Report Completion Rollout](adrs/adr-002-verified-report-completion-rollout.md) — text-readable cockpit-only MVP.
- [ADR-003: Additive Report Presentation Contract](adrs/adr-003-additive-report-presentation-contract.md) — ephemeral reference and no broad lifecycle redesign.

## Deliverables

- Text-labelled report lifecycle/outcome/reference rendering in existing cockpit surfaces.
- OpenTUI captured-frame acceptance suite covering success, failure, safety, reduced color, and regressions.
- Updated `.spec-finder/tasks/task-report-outcome/memory/MEMORY.md` and `memory/task_05.md` with factual durable context.
- `reports/task_05.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given a completed task carrying a validated relative reference, render `Task completed` and `Report: <reference>` in the selected transcript and terminal summary.
- [ ] Given completed status without a reference, render completion without an unavailable placeholder or absolute path.
- [ ] Given report failure activity, render a labelled failure/recovery reason and never a completed or provider-inferred blocked outcome.

### Integration Tests

- [ ] Given a deterministic two-turn fixture with reused session ID and malicious report session-info, render report-running/completed/reference while captured frames exclude the prompt, root, title payload, and controls.
- [ ] Given batch state and existing read-only keyboard paths, preserve current batch summary, Escape, Q, and reduced-color behavior.

### Platform or Manual Evidence

- [ ] Capture OpenTUI `testRender` frames at normal and reduced-color settings; live-provider validation is not required by the approved rollout.

### Verification Commands

- `rtk bun test tests/cockpit.test.tsx`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Operators can read report running, completed, failed, and safe report-reference meaning without relying on color.
- Frames demonstrate zero recognized raw report metadata/path/control exposure and no provider-owned outcome.
- Existing batch and read-only cockpit behavior remains intact.
- Focused tests and repository verification pass to terminal exit; memory is current and `reports/task_05.md` is ready for the report phase.
- Changed testable logic reaches at least 80% coverage when measurable; this repository has no coverage threshold tool, so record scenario coverage when a percentage is unavailable.
