---
status: pending
title: Render Accessible Retained Failure Diagnostics
type: frontend
complexity: medium
dependencies:
  - task_01
  - task_02
---

# Task 04: Render Accessible Retained Failure Diagnostics

## Overview

Render the settled failure review from the exact store projection. The operator
must be able to scan textual failure status and counts, read the complete
scrollable error, see the one approved recovery hint, and dismiss without
confusing it with active-run cancellation.

## Source Artifacts

- PRD: `.spec-finder/tasks/visible-task-run-errors/_prd.md`
- TechSpec: `.spec-finder/tasks/visible-task-run-errors/_techspec.md`

<critical>
- Before editing, read `.spec-finder/tasks/visible-task-run-errors/_prd.md`, `.spec-finder/tasks/visible-task-run-errors/_techspec.md`, packet ADRs, repository instructions, and current Git state.
- Do not begin until ordered-multiple tasks 03–05 are integrated; preserve its batch cockpit projection and do not edit `src/batch.ts` or `src/events.ts`. Dirty source is not completion evidence.
- Treat `task_04` as the canonical execution position; `task_01` and `task_02` must be completed before this task begins.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_04.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb command wait/exit-code or PTY harness scope.
- Reference TechSpec Implementation Design/Data Models and Lifecycle, Failure and Recovery Behavior, and Security and Privacy instead of duplicating interfaces.
- Run focused tests and `rtk bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST render a distinct textual failure review with task identity, batch stopping context when applicable, final outcome/counts, and the complete surfaced error.
2. MUST make long or multiline error details word-wrapped and scrollable, with clear keyboard dismissal and no color-only meaning.
3. MUST show exactly one generic hint, `Resolve the listed error, then rerun the task packet.`, without adding retry, remediation, or other workflow controls.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD G-01, G-02, US-01, US-02, F-01, F-02 | Show retained failure identity, exact detail, and outcome. | Short/multiline failure frames. |
| PRD US-03, F-03, M-04 | Present one fixed generic recovery hint. | Exact-copy frame assertion. |
| PRD UX/accessibility constraint; M-02 | Keep text readable in full and compact terminal layouts. | Scrollbox, non-color, and compact frame tests. |
| TechSpec Failure and Recovery; ADR-001/002 | Keep review observational and failure-only. | Keyboard and no-controls assertions. |

## Subtasks

- [ ] 04.1 Present an unambiguous final failure status with task, batch, and outcome context.
- [ ] 04.2 Render complete exact error details in the established focused terminal scroll pattern.
- [ ] 04.3 Add the fixed recovery hint and settled-review dismissal guidance without new controls.
- [ ] 04.4 Prove short, multiline, missing-detail, compact-layout, and batch-context rendering behavior.

## Implementation Details

Follow TechSpec **Implementation Design / Data Models and Lifecycle**, **Failure
and Recovery Behavior**, and **Security and Privacy**. Reuse the established
OpenTUI `scrollbox` pattern and the selector delivered by task 02; do not clip
exact detail with the compact `fit()` path.

### Relevant Files

- `src/ui/App.tsx` — verified summary, keyboard, and existing scrollbox surfaces; render the failure review here.
- `tests/cockpit.test.tsx` — verified frame, compact layout, and mock-input patterns; extend them for review diagnostics.

### Dependent Files

- `src/ui/store.ts` — task 02 exact-detail selector supplies the review message.
- `src/ui/cockpit.tsx` — task 01 supplies the settled-review dismissal callback.
- `src/commands.ts` — task 03 waits while this final surface remains visible.
- `src/ui/transcript.ts` — continues to support live transcript reading but is not the exact-detail source.

### Related ADRs

- [ADR-001: Failure-Only Cockpit Diagnostics](adrs/adr-001-failure-only-cockpit-diagnostics.md) — display the complete surfaced error before dismissal.
- [ADR-002: Default-On Failure Review With Generic Recovery Guidance](adrs/adr-002-default-on-failure-review.md) — use the fixed generic hint and default-on release bar.
- [ADR-003: Command-Owned Retained Failure-Review Lifecycle](adrs/adr-003-command-owned-retained-failure-review-lifecycle.md) — request dismissal rather than teardown.

## Deliverables

- Accessible, retained final failure review with exact scrollable diagnostics.
- Component evidence for text, counts, hint, keyboard guidance, and compact layout.
- Updated `memory/MEMORY.md` and `memory/task_04.md` when warranted.
- `reports/task_04.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given a failed task with a short or multiline exact detail, when the final view renders, then it shows task ID, textual failed outcome/counts, and the full message without compact clipping.
- [ ] Given missing exact detail, when the final view renders, then it exposes an explicit absence notice without fabricated stack or raw ACP data.

### Integration Tests

- [ ] Given a batch failure with a stopping packet and failed task, when the final view renders, then it includes packet context and does not collide with same-named task details from another packet.
- [ ] Given narrow terminal dimensions and long diagnostic text, when the review opens, then a focused scrollable detail remains available and the dismissal guidance remains visible.

### Platform or Manual Evidence

- [ ] Not applicable: task 05 verifies the rendered review in a real macOS PTY.

### Verification Commands

- `rtk bun test tests/cockpit.test.tsx`
- `rtk bun run verify`

## Success Criteria

- Every retained failure view is readable, keyboard-complete, and observational only.
- Exact surfaced error content is not reduced, while compact live reasons remain unchanged.
- Focused tests and repository verification pass to terminal exit.
- Coverage reaches 80% for changed testable logic when measurable.
- Memory is current and `reports/task_04.md` records exact evidence and unresolved risks.
