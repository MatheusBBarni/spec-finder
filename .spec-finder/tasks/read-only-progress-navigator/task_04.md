---
status: pending
title: Render and verify the read-only progress cockpit
type: frontend
complexity: high
dependencies:
  - task_01
  - task_02
  - task_03
---

# Task 04: Render and verify the read-only progress cockpit

## Overview

Replace the flat activity surface and permission modal with the final two-column read-only progress cockpit. The result must expose truthful runtime context, task status, selected-task transcript history, focus-aware keyboard navigation, full scrolling, active-task following, contextual help, responsive hierarchy, semantic status signaling, and no workflow or permission controls.

<critical>
- Read the PRD, TechSpec, ADR-001, ADR-002, ADR-003, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_04.md` before editing and update memory before finishing.
- Implement only the final cockpit presentation, interaction behavior, compatibility cleanup, and its tests; do not change engine or raw event semantics.
- Keep the active/selected distinction and ensure every interaction is view-only except the existing terminal escape hatch.
- Preserve unrelated dirty changes and make README changes only where assigned to `task_03`.
- Run renderer interaction tests, minimum-size evidence, and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST render the prioritized header, task navigator, selected task transcript, failure/blocked reasons, and truthful runtime-option outcomes. (PRD-G-01, PRD-G-02, PRD-G-03, PRD-G-04, PRD-F-01, PRD-F-02, PRD-F-03, PRD-F-05, PRD-F-08, PRD-C-04)
2. MUST implement explicit two-pane focus, task movement, active-task following, transcript line/page/start/end scrolling, contextual footer/help, and the terminal escape hatch. (PRD-US-04, PRD-US-05, PRD-F-04, PRD-F-07, PRD-F-10)
3. MUST remove permission controls and legacy permission-selection UI/actions from the final cockpit. (PRD-G-05, PRD-US-08, PRD-F-09, PRD-C-01, PRD-M-06)
4. MUST preserve status meaning without color alone and provide understandable behavior at 80×24, 120×40, 200×60, reduced-color, and below-minimum dimensions. (PRD-G-06, PRD-F-11, PRD-C-08, PRD-C-09, PRD-M-01, PRD-M-07)
5. SHOULD preserve the existing renderer lifecycle and `--no-ui` behavior while keeping task selection purely view-side. (ADR-003, TechSpec Integration Points)
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| `PRD-G-01`, `PRD-US-01`, `PRD-F-01`, `PRD-M-01` | Establish first-screen orientation with slug, identity, active task, phase/outcome, and counts. | Header frames and orientation checklist |
| `PRD-G-02`, `PRD-US-02`, `PRD-F-02` | Make every task reachable with status symbols, labels, and active/selected emphasis. | Multi-task frame and keyboard tests |
| `PRD-G-03`, `PRD-US-03`, `PRD-US-04`, `PRD-US-05`, `PRD-F-03`, `PRD-F-04`, `PRD-F-07`, `PRD-M-02`, `PRD-M-03`, `PRD-M-04` | Show the correct complete transcript, follow live progress, and navigate start/tail/history. | Selection, follow, scroll, and long-history tests |
| `PRD-G-04`, `PRD-US-06`, `PRD-F-05`, `PRD-F-06` | Present normalized event categories clearly. | Transcript frame assertions |
| `PRD-US-07`, `PRD-F-08`, `PRD-C-05`, `PRD-M-05` | Surface failure/blocked reasons in summary and transcript. | Failure frame tests |
| `PRD-G-05`, `PRD-US-08`, `PRD-F-09`, `PRD-C-01`, `PRD-M-06` | Remove all permission/workflow controls. | Negative frame assertions and store cleanup tests |
| `PRD-G-06` accepted alias, `PRD-F-11`, `PRD-C-08`, `PRD-C-09`, `PRD-M-07` | Preserve responsive hierarchy and non-color status meaning. | 80×24/120×40/200×60/reduced-color frames |
| TechSpec Header and Responsive Layout, Keyboard and Focus, Testing and Evidence | Integrate all approved UI contracts without changing execution. | Full cockpit suite and `bun run verify` |

## Subtasks

- [ ] 04.1 Render the prioritized header with effective runtime-option outcomes, counts, active task, phase/outcome, and responsive collapse rules.
- [ ] 04.2 Render the scrollable task navigator with status symbols, labels, selected marker, active marker, and task reasons.
- [ ] 04.3 Render the selected normalized transcript with sticky live tail, full-history scrolling, and semantic event presentation.
- [ ] 04.4 Implement `Tab`/`Shift+Tab`, arrows/`j`/`k`, `?`, `q`/`Ctrl+C`, follow/inspect behavior, and visible footer/help bindings.
- [ ] 04.5 Remove the permission modal and legacy permission state/actions after the new flow is integrated.
- [ ] 04.6 Add renderer, interaction, responsive, reduced-color, and read-only regression evidence.
- [ ] 04.7 Run the complete focused suite and repository gate to terminal exit, then update task memory.

## Implementation Details

Follow the TechSpec Header and Responsive Layout, Keyboard and Focus, Integration Points, Failure and Recovery, Security and Privacy, and Testing and Evidence sections. Use the store and transcript contracts delivered by `task_01` and `task_02`, and the fail-closed ACP behavior delivered by `task_03`.

### Relevant Files

- `src/ui/App.tsx` — replace the global activity/modal presentation with the final cockpit.
- `src/ui/store.ts` — remove legacy permission state/actions after the UI no longer consumes them.
- `tests/cockpit.test.tsx` — add frame, input, resize, scrolling, help, and negative-control evidence.
- `tests/store.test.ts` — replace permission-selection assertions with final read-only state assertions.

### Dependent Files

- `src/ui/transcript.ts` — normalized entries from `task_01`.
- `src/ui/cockpit.tsx` — renderer lifecycle; verify and change only if required for the tested UI.
- `src/commands.ts` — existing quit/cancel and TUI wiring; preserve behavior.
- `src/events.ts` — raw runtime event contract; do not change.

### Related ADRs

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — observation-only master/detail boundary.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — header, columns, following, and readable transcript.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — current-seam implementation and no protocol migration.

## Deliverables

- Final two-column read-only cockpit with responsive header and task/transcript panels.
- Explicit focus/keymap behavior, scrolling, follow/inspect behavior, contextual footer, and help view.
- Removal of permission UI and legacy permission actions from the final cockpit.
- Renderer frame and interaction evidence at required terminal sizes and color modes.
- Updated `memory/MEMORY.md` and `memory/task_04.md` when warranted.
- `reports/task_04.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given two tasks with distinct histories, when a task is selected, then only its transcript is rendered.
- [ ] Given active-task transitions while following, when execution advances, then selection follows; after manual selection, it does not.
- [ ] Given failed/blocked task state, when rendered, then symbols, labels, and plain-language reasons are visible without color.
- [ ] Given permission-related state, when rendered, then no option, approval, retry, edit, reorder, or status mutation control is present.

### Integration Tests

- [ ] Given a task list longer than the viewport, when arrows/`j`/`k` move selection, then the selected row is scrolled into view and the transcript matches it.
- [ ] Given long normalized output, when the transcript pane is focused, then line, page, Home, and End scrolling work and live-tail behavior resumes at End.
- [ ] Given `Tab`/`Shift+Tab`, when focus changes, then task movement and transcript scrolling are routed to the correct pane.
- [ ] Given runtime options with applied/default/unsupported outcomes, when the header renders, then it never claims an unsupported value is effective.

### Platform or Manual Evidence

- [ ] Capture frames at 80×24, 120×40, and 200×60.
- [ ] Capture a reduced-color frame proving status meaning survives without color.
- [ ] Exercise a below-minimum terminal and record compact fallback behavior.
- [ ] Verify `?` help, `q`, and `Ctrl+C` behavior in a real TTY without permission controls.
- [ ] Exercise a synthetic long transcript and record memory/render observations.

### Verification Commands

- `bun test tests/transcript.test.ts tests/store.test.ts tests/cockpit.test.tsx tests/acp-client.test.ts`
- `bun run check`
- `bun run verify`

## Success Criteria

- The first rendered supported-size frame identifies the run, active task, phase/outcome, and runtime identity.
- A second task’s transcript is reachable within two navigation actions and selection mapping is 100% correct across fixtures.
- Full task history is scrollable from live tail to start without truncation.
- All required ACP categories and failure/blocked reasons are readable and semantically signaled.
- No workflow mutation or permission control is rendered.
- 80×24, 120×40, 200×60, reduced-color, and compact fallback evidence is recorded.
- Focused tests and `bun run verify` pass to terminal exit.
- No engine, raw event, packet, config, provider, or unrelated dirty-file behavior changes are introduced.
- Memory is current and the final report records exact evidence and unresolved risks.
