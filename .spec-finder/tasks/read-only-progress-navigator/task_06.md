---
status: pending
title: Integrate task timer projection into CockpitStore
type: frontend
complexity: medium
dependencies:
  - task_05
---

# Task 06: Integrate task timer projection into CockpitStore

## Overview

Extend the completed task-aware cockpit store with an ephemeral per-task timer projection using the pure contract from `task_05`. The store will start timing at the first observed `in_progress`, advance only running tasks, freeze the first terminal value, reset on a new run, and expose the state without changing transcripts, raw events, engine behavior, or non-UI output.

<critical>
- Read the PRD, TechSpec, ADR-001, ADR-004, ADR-005, ADR-006, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_06.md` before editing and update memory before finishing.
- Implement only store timer state, transitions, tick behavior, and store tests; do not implement App rendering or alter runtime event schemas.
- Keep timer state separate from transcripts, run activity, runtime-option outcomes, task reasons, and execution state; preserve active/selected/follow behavior.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST add a store-owned timer projection keyed by stable task ID, reset it on `run_started`, and expose it through immutable snapshots without persistence or telemetry. (PRD-G-06, PRD-G-07, PRD-C-07, TechSpec Store Interface and Data Models)
2. MUST call the pure timer transitions at task-status boundaries: first `in_progress` starts, repeated starts preserve the first baseline, terminal statuses freeze the first observed value, and missing baselines become `unavailable`. (PRD-US-09, PRD-US-10, PRD-F-11, PRD-M-07, PRD-M-08)
3. MUST provide an explicit `tick()` path that advances only running tasks, ignores invalid clock input safely, and avoids publishing a new snapshot when no displayed second changed. (TechSpec App Integration, Store Interface, Failure and Recovery)
4. MUST preserve task selection, follow mode, transcript chronology, run metadata, permission isolation, `RunEvent`, `--no-ui`, and engine contracts unchanged. (PRD-G-05, PRD-C-01, PRD-C-06, ADR-001, ADR-003, ADR-006)
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| `PRD-G-06`, `PRD-US-09`, `PRD-US-10`, `PRD-F-11` | Project timer state at status transitions and retain observed terminal duration. | Controlled-clock store fixtures |
| `PRD-G-07`, `PRD-M-07`, `PRD-M-08` | Preserve timer state across supported task statuses and reset it for each run. | Run lifecycle and status-transition assertions |
| `PRD-C-01`, `PRD-C-06`, `PRD-C-07` | Keep the cockpit read-only and timer state in-memory without raw event or persistence changes. | Protected-boundary diff and fresh-store tests |
| TechSpec Data and Control Flow, Store Interface, Failure and Recovery | Connect pure transitions to the existing immutable store and explicit tick seam. | TypeScript check, store suite, and snapshot-notification assertions |

## Subtasks

- [ ] 06.1 Add the timer map and injectable monotonic source to the existing `CockpitState`/`CockpitStore` without disturbing view state.
- [ ] 06.2 Integrate timer start and terminal transitions into task-status consumption, including duplicate, stale, blocked, and missing-baseline cases.
- [ ] 06.3 Implement explicit ticking for running tasks with displayed-second notification suppression and safe invalid-input handling.
- [ ] 06.4 Expand store tests for lifecycle reset, controlled time, terminal retention, separation from transcript state, and run-level completion.
- [ ] 06.5 Run focused tests, protected-boundary checks, and the repository gate to terminal exit, then update task memory for App integration.

## Implementation Details

Follow the approved TechSpec Store Interface, Data and Control Flow, Data Models and Lifecycle, Integration Points, Failure and Recovery Behavior, Security and Privacy, and Observability sections. Reuse the pure helpers from `src/ui/timer.ts`; do not duplicate timer math in the store.

### Relevant Files

- `src/ui/store.ts` — add timer state, clock injection, status-boundary transitions, explicit ticking, and immutable snapshot behavior.
- `tests/store.test.ts` — add controlled-clock lifecycle and notification tests while preserving all existing task/navigation/reason coverage.

### Dependent Files

- `src/ui/timer.ts` — pure transition and formatting contract from `task_05`.
- `src/ui/App.tsx` — consumes timer snapshots and calls `tick()` in `task_07`.
- `tests/cockpit.test.tsx` — verifies rendered timer behavior in `task_07`.
- `src/events.ts`, `src/engine.ts`, `src/commands.ts` — protected raw/runtime boundaries; do not change.

### Related ADRs

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — preserves the observation-only store boundary.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — keeps state changes at the existing UI projection seam.
- [ADR-004: Ephemeral Task Duration Signal](adrs/adr-004-ephemeral-task-duration.md) — defines lifecycle and non-persistence semantics.
- [ADR-006: Store-Local Task Timer Projection](adrs/adr-006-store-local-task-timer-projection.md) — makes the store the owner of timer projection and explicit ticks.

## Deliverables

- Immutable `CockpitState` timer projection keyed by task ID.
- Store timer lifecycle integration with reset, start, tick, freeze, unavailable, duplicate, and stale behavior.
- Deterministic store tests proving timer state does not leak into transcript, run, permission, or execution paths.
- Updated `memory/task_06.md` and shared memory only when a durable handoff is discovered; existing memory must not be overwritten.
- `reports/task_06.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given `run_started` with multiple tasks, when consumed, then timer state is reset and pending rows have no fabricated elapsed value.
- [ ] Given a first `in_progress`, duplicate `in_progress`, and controlled clock advances, when consumed/ticked, then the first baseline remains and only running elapsed seconds advance.
- [ ] Given a completed or failed task, when the first terminal status arrives, then the observed value freezes and duplicate/stale terminal events cannot overwrite it.
- [ ] Given a blocked task or a terminal task without an observed start, when inspected, then its timer state formats as `—` or `unavailable` according to status and baseline rules.
- [ ] Given a `tick()` that does not cross a displayed second, when subscribers are observed, then no timer-only snapshot notification is published.
- [ ] Given `run_finished` without a task terminal event, when consumed, then no task duration is invented.
- [ ] Given a fresh store for a later run, when initialized, then prior timer state is absent and no filesystem, telemetry, or cross-run cache is touched.

### Integration Tests

- [ ] Existing store tests for selection, following, focus, transcripts, failure reasons, blocked dependencies, and permission isolation continue to pass with `taskTimers` present.
- [ ] Protected-boundary inspection shows no changes to `src/events.ts`, `src/engine.ts`, `src/commands.ts`, `package.json`, or `bun.lock`.

### Platform or Manual Evidence

- [ ] Not applicable beyond store integration; OpenTUI frame, cleanup, and PTY evidence belongs to `task_07`.

### Verification Commands

- `bun test tests/timer.test.ts tests/store.test.ts`
- `bun run check`
- `bun run verify`
- `git diff --check`
- `git diff -- src/events.ts src/engine.ts src/commands.ts package.json bun.lock`

## Success Criteria

- Store snapshots expose correct per-task timer state for every approved lifecycle boundary.
- Timer state is reset per run, isolated from transcript/view state, and never persisted or emitted as a runtime event.
- Controlled-clock tests prove start, tick, freeze, unavailable, idempotence, and notification-suppression behavior.
- Existing navigator and permission-boundary tests remain green.
- Focused tests and `bun run verify` pass to terminal exit.
- Memory is current and `reports/task_06.md` can record exact evidence and unresolved risks.
