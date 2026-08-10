---
status: completed
title: Render and verify the integrated task timer
type: frontend
complexity: medium
dependencies:
  - task_06
---

# Task 07: Render and verify the integrated task timer

## Overview

Integrate the store-owned timer into the completed read-only cockpit and verify the user-visible behavior across supported terminal sizes and lifecycle paths. The task keeps the existing spinner and OpenTUI live-render cleanup, reserves timer space before title truncation, explains the neutral signal in help, and proves that timer updates do not create workflow controls or alter task/transcript navigation.

<critical>
- Read the PRD, TechSpec, ADR-001, ADR-002, ADR-004, ADR-005, ADR-006, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_07.md` before editing and update memory before finishing.
- Implement only timer rendering, live tick wiring, timer help copy, and their renderer/platform tests; do not change engine, raw events, ACP transport, or `--no-ui` behavior.
- Preserve the existing spinner, two-column hierarchy, active/selected distinction, transcript scrolling, read-only controls, and renderer cleanup while adding the timer.
- Run renderer interaction tests, fixed-size/reduced-color evidence, the exact repository verification gate, and protected-boundary checks to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST render the existing spinner/status meaning together with each task's `MM:SS`, `—`, or `unavailable` value, preserving task identity and reserving timer/status width before title truncation. (PRD-G-02, PRD-G-06, PRD-G-07, PRD-US-09, PRD-US-11, PRD-F-02, PRD-F-11, PRD-M-09)
2. MUST advance the store timer through the existing running-task live lifecycle, request/drop live rendering correctly, and stop all timer-driven updates on renderer cleanup. (TechSpec App Integration, Failure and Recovery, Integration Points)
3. MUST add concise help copy explaining that elapsed time is an observation and not an automatic stall verdict, without adding alerts, thresholds, controls, persistence, telemetry, or timer output to transcripts/reports/logs. (PRD-US-12, PRD-M-06, PRD-M-10, ADR-005, ADR-006)
4. MUST preserve task selection, focus, follow mode, transcript scroll position, status meaning without color, `q`/Ctrl+C cancellation, and `--no-ui` output while timer values update. (PRD-G-01 through `G-05`, PRD-F-01 through `F-10`, PRD-C-01, PRD-C-08, PRD-C-09)
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| `PRD-G-02`, `PRD-G-06`, `PRD-G-07`, `PRD-US-09`, `PRD-US-11`, `PRD-F-02`, `PRD-F-11`, `PRD-M-09` | Make timer/status/identity readable in normal and compact rows. | Fixed-size and reduced-color frame assertions |
| `PRD-US-12`, `PRD-M-10`, ADR-005 | Explain neutral timer interpretation without adding liveness policy. | Help frame assertion and manual comprehension note |
| `PRD-G-01`–`PRD-G-05`, `PRD-F-01`–`PRD-F-10`, `PRD-M-06` | Preserve the completed cockpit's header, navigation, transcript, failure, read-only, and runtime-option behavior. | Existing cockpit regression suite plus timer-update invariance tests |
| TechSpec App Integration, Testing and Evidence, Compatibility and Rollback | Use the existing live lifecycle and verify renderer cleanup/platform behavior without protocol migration. | Renderer tests, PTY evidence, full gate, and protected diff |

## Subtasks

- [ ] 07.1 Render the store timer value in task rows while preserving the spinner, semantic status labels, identity, reason lines, and compact truncation priority.
- [ ] 07.2 Call `store.tick()` through the existing running-task live effect and preserve interval cleanup and `dropLive()` behavior.
- [ ] 07.3 Add neutral timer interpretation to the existing help/footer surface without adding commands, alerts, thresholds, or output-surface changes.
- [ ] 07.4 Add deterministic renderer tests for live/final/placeholder/unavailable values, selection/focus/scroll invariance, supported sizes, compact fallback, and reduced color.
- [ ] 07.5 Run real-PTY escape/cleanup checks, protected-boundary checks, the focused timer/store/cockpit suite, and the repository gate to terminal exit, then update task memory.

## Implementation Details

Follow the approved TechSpec App Integration, Data Models and Lifecycle, Failure and Recovery Behavior, Security and Privacy, Compatibility and Rollback, Testing and Evidence, and Observability sections. Reuse the completed cockpit layout and the store contract from `task_06`; do not introduce a second timer or a new renderer lifecycle.

### Relevant Files

- `src/ui/App.tsx` — render task timer values, call the store tick path during the existing live effect, and add neutral help copy.
- `tests/cockpit.test.tsx` — extend frame, input, resize, reduced-color, cleanup, and read-only regression evidence.

### Dependent Files

- `src/ui/store.ts` — timer snapshot and `tick()` contract from `task_06`.
- `src/ui/timer.ts` — pure formatting behavior from `task_05`.
- `src/ui/cockpit.tsx` — renderer lifecycle inspected and preserved unless a test proves a narrowly scoped integration adjustment is required.
- `src/commands.ts`, `src/events.ts`, `src/engine.ts`, `package.json`, `bun.lock` — protected no-change boundaries.

### Related ADRs

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — prohibits workflow and permission controls.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — preserves the header, task/transcript panes, and live following behavior.
- [ADR-004: Ephemeral Task Duration Signal](adrs/adr-004-ephemeral-task-duration.md) — defines row display and neutral liveness semantics.
- [ADR-005: Integrated Neutral Task Timer Product Scope](adrs/adr-005-integrated-neutral-task-timer.md) — keeps timer scope inside the existing navigator MVP.
- [ADR-006: Store-Local Task Timer Projection](adrs/adr-006-store-local-task-timer-projection.md) — requires App-driven explicit ticks and existing live cleanup.

## Deliverables

- Timer-aware task rows that retain spinner/status, identity, reasons, and compact-layout hierarchy.
- Live timer advancement through the existing renderer lifecycle with cleanup on task completion, unmount, `q`, and Ctrl+C.
- Neutral timer explanation in contextual help and no new workflow or output-surface behavior.
- Deterministic frame/input tests plus real-PTY and terminal-variance evidence.
- Updated `memory/task_07.md` and shared memory only when a durable handoff is discovered; existing memory must not be overwritten.
- `reports/task_07.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given a running task, when the store crosses from zero to one displayed second, then the row changes from `00:00` to `00:01` while the spinner/status remains visible.
- [ ] Given completed or failed tasks, when rendered after terminal freeze, then the final `MM:SS` remains visible; pending and blocked rows show `—`; missing-baseline active/terminal rows show `unavailable`.
- [ ] Given timer updates, when task selection, pane focus, follow mode, transcript history, or scroll position is inspected, then no view state changes except those caused by explicit user input.
- [ ] Given help is open, when the frame is captured, then it explains elapsed time as an observation rather than an automatic stall verdict and contains no permission/retry/edit/reorder control.

### Integration Tests

- [ ] At 80×24, 120×40, and 200×60, the task identity, status, timer, active/selected markers, and selected transcript context remain readable with secondary metadata collapsing first.
- [ ] At compact fallback dimensions and reduced-color capabilities, timer and status meaning remain available through text/symbols without color dependence.
- [ ] With a long transcript, timer updates do not reset task selection, transcript tail/start position, focus, or follow behavior.
- [ ] When the renderer unmounts or the run has no running task, timer updates stop and the existing live renderer cleanup runs.
- [ ] Existing `q`/Ctrl+C cancellation and `--no-ui` regression tests remain green; no timer value is emitted to console output or raw events.

### Platform or Manual Evidence

- [ ] Capture fixed renderer frames at 80×24, 120×40, 200×60, compact fallback, and reduced color.
- [ ] Run a real PTY smoke check proving the timer appears during a running fixture and terminal state is restored after `q` and Ctrl+C.
- [ ] Record a controlled long-duration fixture or deterministic frame proving formatting beyond 59 minutes without waiting in real time.

### Verification Commands

- `bun test tests/timer.test.ts tests/store.test.ts tests/cockpit.test.tsx`
- `bun run check`
- `bun run verify`
- `git diff --check`
- `git diff -- src/events.ts src/engine.ts src/commands.ts package.json bun.lock`

## Success Criteria

- Running, terminal, pending, blocked, and unavailable timer states render with the approved semantics and without obscuring task identity.
- Timer updates use the existing OpenTUI live lifecycle and leave no background interval after cleanup.
- Help makes neutral interpretation clear; no alert, threshold, workflow control, persistence, telemetry, transcript, report, log, or `--no-ui` expansion is introduced.
- Existing cockpit interactions and status semantics remain green across required terminal sizes and color capabilities.
- Focused tests, PTY evidence, protected-boundary checks, and `bun run verify` pass to terminal exit.
- Memory is current and `reports/task_07.md` can record exact evidence and unresolved risks.
