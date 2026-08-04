---
status: pending
title: Add task-scoped cockpit state and view navigation
type: frontend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Add task-scoped cockpit state and view navigation

## Overview

Extend `CockpitStore` from one global activity list into a task-aware view model using the transcript helper from `task_01`. The store will expose independent execution/view state, deterministic selection/follow/focus actions, complete per-task histories, and failure/blocked reasons while keeping the current App buildable until `task_04` removes the legacy permission modal.

<critical>
- Read the PRD, TechSpec, ADR-001, ADR-002, ADR-003, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only store state, event projection, view actions, and store tests; do not implement the final layout or ACP permission branch.
- Keep `activeTaskId` separate from `selectedTaskId`; browsing must never affect execution.
- Preserve existing permission state/methods temporarily so the current App remains buildable; `task_04` owns their removal.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST retain complete normalized history per task and keep task histories isolated. (PRD-G-03, PRD-F-03, PRD-F-07, PRD-C-02)
2. MUST maintain distinct active/selected task IDs, explicit pane focus, follow mode, and bounded task-navigation actions. (PRD-US-02, PRD-US-03, PRD-US-04, PRD-F-02, PRD-F-04)
3. MUST derive plain-language failure and blocked-dependency reasons without changing engine events. (PRD-US-07, PRD-F-08, PRD-C-05)
4. MUST keep transcript state run-scoped in memory with no persistence, cross-run cache, or telemetry, while retaining run-level metadata and runtime-option outcomes separately for the later header. (PRD-C-07, PRD-F-01, PRD-C-04, TechSpec Header and Responsive Layout)
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| `PRD-G-02`, `PRD-US-02`, `PRD-F-02` | Store every task and its status with deterministic selection boundaries. | Multi-task store fixtures |
| `PRD-G-03`, `PRD-US-03`, `PRD-US-04`, `PRD-F-03`, `PRD-F-04`, `PRD-F-07` | Separate active/selected state and follow task progress without execution actions. | Status/selection/follow tests |
| `PRD-US-07`, `PRD-F-08`, `PRD-C-05`, `PRD-M-05` | Provide immediate fallback and detailed failure/blocked reasons. | Failure and dependency fixtures |
| `PRD-C-02`, `PRD-M-02`, `PRD-M-03`, `PRD-M-04` | Preserve complete isolated histories and navigation state. | History-over-250 and task-switch tests |
| `PRD-C-07` | Keep histories in the run-scoped store only, with no persistence, cross-run cache, or telemetry. | Fresh-store lifecycle and filesystem-diff checks |
| TechSpec Data and Control Flow, Data Models and Lifecycle | Provide immutable store snapshots and view-only actions. | TypeScript check and store tests |

## Subtasks

- [ ] 02.1 Initialize per-task transcript maps, view state, runtime metadata, and follow defaults on `run_started`.
- [ ] 02.2 Project task-scoped activity/session updates through `src/ui/transcript.ts` and retain run-level entries separately.
- [ ] 02.3 Add task selection, movement, pane focus, follow-mode, help-state, and transcript selectors without execution actions.
- [ ] 02.4 Derive failed-task fallback/detail reasons and blocked dependency explanations.
- [ ] 02.5 Expand store tests while preserving legacy permission coverage for the interim build.
- [ ] 02.6 Run focused tests and repository gate to terminal exit, then update task memory.

## Implementation Details

Follow the TechSpec’s `CockpitStore` boundary, Data and Control Flow, Data Models and Lifecycle, and Failure and Recovery sections. Use immutable snapshots and the helper contract delivered by `task_01`; do not add a second domain package or alter `RunEvent`.

### Relevant Files

- `src/ui/store.ts` — extend state, event consumption, selectors, and view actions.
- `tests/store.test.ts` — add state, history, selection, follow, focus, and reason assertions.

### Dependent Files

- `src/ui/transcript.ts` — normalized event helper from `task_01`.
- `src/ui/App.tsx` — consumes the new state in `task_04`.
- `src/events.ts` — raw event source; do not change.
- `src/tasks.ts` — dependency/status source used for blocked reasons.

### Related ADRs

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — separates execution and view-selection state.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — requires active-task follow and selected-task history.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — defines the store seam and no protocol migration.

## Deliverables

- Task-aware immutable cockpit state with complete per-task histories.
- View-only selection/focus/follow/help actions and selectors.
- Plain-language failed/blocked reason derivation.
- Expanded store tests, including history above the old 250-entry limit.
- Updated `memory/MEMORY.md` and `memory/task_02.md` when warranted.
- `reports/task_02.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given `run_started` with multiple tasks, when the first task becomes active, then active and selected IDs follow independently with correct defaults.
- [ ] Given manual selection of a non-active task, when a later task becomes active, then selected history remains unchanged and follow mode is off.
- [ ] Given activity/session updates for two task IDs, when consumed, then each transcript contains only its own entries.
- [ ] Given a failed task with later error activity, when consumed, then the summary reason upgrades from fallback to detailed text.
- [ ] Given a blocked task with a failed dependency, when status is consumed, then the dependency-specific reason is available.
- [ ] Given a fresh store for a new run, when the run completes, then transcript history is discarded with the store and no persistence or telemetry side effect is introduced.

### Integration Tests

- [ ] Store snapshots remain compatible with the current `App.tsx` until `task_04` migrates the UI.
- [ ] Existing permission-selection tests continue to pass during this intermediate task.

### Platform or Manual Evidence

- [ ] Not applicable; OpenTUI focus and frame evidence belongs to `task_04`.

### Verification Commands

- `bun test tests/transcript.test.ts tests/store.test.ts`
- `bun run check`
- `bun run verify`

## Success Criteria

- Active and selected task state never conflates execution with inspection.
- Histories remain complete and isolated beyond 250 entries.
- Navigation/follow/reason behavior is fully covered by deterministic tests.
- The interim store does not introduce workflow or permission actions.
- Focused tests and `bun run verify` pass to terminal exit.
- Memory is current and the final report records exact evidence and unresolved risks.
