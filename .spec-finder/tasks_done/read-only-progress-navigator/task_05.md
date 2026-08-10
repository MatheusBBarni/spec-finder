---
status: completed
title: Define and test pure task timer semantics
type: frontend
complexity: medium
dependencies: []
---

# Task 05: Define and test pure task timer semantics

## Overview

Create the pure, OpenTUI-independent timer projection required by the approved navigator timer feature. The task establishes deterministic start, advance, terminal-freeze, invalid-clock, and formatting behavior so the store and renderer can consume one stable contract without changing execution or event boundaries.

<critical>
- Read the PRD, TechSpec, ADR-004, ADR-005, ADR-006, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_05.md` before editing and update memory before finishing.
- Implement only the pure timer module and its tests; do not add store, App, engine, event, persistence, or renderer behavior here.
- Keep timing monotonic, ephemeral, deterministic under an injected clock, and presentation-only; do not infer stall state.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST provide pure start, advance, and terminal-freeze transitions that establish the first valid `in_progress` baseline, preserve the first baseline, clamp regressing clocks, and make duplicate or stale terminal transitions idempotent. (PRD-G-06, PRD-US-09, PRD-US-10, PRD-F-11, TechSpec Core Interfaces and Failure and Recovery)
2. MUST format pending and blocked rows as `—`, active or terminal rows without a trustworthy baseline as `unavailable`, and observed durations as total-minute `MM:SS` without hour rollover. (PRD-F-11, PRD-US-09, PRD-US-10, PRD-M-07, ADR-004)
3. MUST reject non-finite or negative baselines without inventing elapsed time and MUST avoid filesystem, network, ACP, OpenTUI, execution, event, and telemetry dependencies. (PRD-C-06, PRD-C-07, TechSpec Security and Privacy)
4. SHOULD return immutable results and avoid allocating a new observable value when a tick does not change the displayed second. (TechSpec Store Interface and Observability)
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| `PRD-G-06`, `PRD-US-09`, `PRD-F-11` | Define the neutral observed elapsed-time state and formatting contract. | Timer transition and format assertions |
| `PRD-US-10`, `PRD-M-07`, `PRD-M-08` | Freeze the first observed terminal duration and preserve it across duplicate/stale inputs. | Terminal-freeze and idempotence fixtures |
| `PRD-C-06`, `PRD-C-07`, ADR-004, ADR-006 | Keep the timer pure, monotonic, ephemeral, and outside raw runtime contracts. | Module-boundary inspection and protected diff |
| TechSpec Core Interfaces, Data Models and Lifecycle, Failure and Recovery | Supply the store with deterministic transitions and explicit degraded states. | TypeScript check and focused suite |

## Subtasks

- [ ] 05.1 Define the timer state categories, monotonic clock validation rules, and displayed-second precision at the UI seam.
- [ ] 05.2 Implement first-start, advance, terminal-freeze, duplicate, stale, invalid, and regressing-clock transitions without mutation.
- [ ] 05.3 Implement status-aware `—`, `unavailable`, and total-minute `MM:SS` formatting, including values beyond 59 minutes.
- [ ] 05.4 Add deterministic fixtures for all transition boundaries, immutability, and unchanged displayed-second behavior.
- [ ] 05.5 Run focused tests and the repository gate to terminal exit, then update task memory for the store handoff.

## Implementation Details

Follow the approved TechSpec sections Core Interfaces, Data Models and Lifecycle, Failure and Recovery Behavior, Security and Privacy, and Observability. Keep this task independent of React and OpenTUI so later consumers can inject a deterministic monotonic source.

### Relevant Files

- `src/ui/timer.ts` — create the pure timer state, transition, clock-validation, and formatting helpers.
- `tests/timer.test.ts` — create deterministic unit fixtures for valid, invalid, duplicate, stale, and formatting cases.

### Dependent Files

- `src/ui/store.ts` — consumes these transitions and owns per-task timer state in `task_06`.
- `tests/store.test.ts` — verifies store integration in `task_06`.
- `src/ui/App.tsx` — renders formatted values in `task_07`.
- `src/events.ts`, `src/engine.ts`, `src/commands.ts` — protected runtime boundaries; do not change.

### Related ADRs

- [ADR-004: Ephemeral Task Duration Signal](adrs/adr-004-ephemeral-task-duration.md) — defines observed duration, placeholders, final retention, and non-persistence.
- [ADR-005: Integrated Neutral Task Timer Product Scope](adrs/adr-005-integrated-neutral-task-timer.md) — keeps the timer inside the navigator MVP without alerts or controls.
- [ADR-006: Store-Local Task Timer Projection](adrs/adr-006-store-local-task-timer-projection.md) — requires pure transitions and an injectable monotonic clock.

## Deliverables

- Pure timer transition and formatting module with no runtime or UI dependency.
- Deterministic unit coverage for start, tick, freeze, placeholders, invalid clocks, and long durations.
- Evidence that prior timer states are not mutated and unchanged displayed seconds are stable.
- Updated `memory/task_05.md` and shared memory only when a durable handoff is discovered; existing memory must not be overwritten.
- `reports/task_05.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given `pending` or `blocked` with any timer state, when formatted, then the result is `—`.
- [ ] Given `in_progress`, `completed`, or `failed` without a baseline, when formatted, then the result is `unavailable`.
- [ ] Given a valid first `in_progress` baseline, when started, then elapsed time is zero and the baseline is retained.
- [ ] Given duplicate starts, duplicate terminals, or a terminal after a finished state, when transitioned, then the first baseline/final value remains unchanged.
- [ ] Given advancing, regressing, non-finite, or negative clock values, when advanced, then elapsed seconds never become negative and invalid input cannot create an invented duration.
- [ ] Given elapsed values of `0`, `1`, `60`, `3599`, `3600`, and a multi-hour value, when formatted, then total-minute `MM:SS` output is correct.
- [ ] Given an advance within the same displayed second, when applied, then the prior observable timer value is preserved.

### Integration Tests

- [ ] `bun run check` accepts the timer module without importing OpenTUI, ACP, engine, filesystem, or runtime event types.

### Platform or Manual Evidence

- [ ] Not applicable for this pure module; renderer and terminal evidence belongs to `task_07`.

### Verification Commands

- `bun test tests/timer.test.ts`
- `bun run check`
- `bun run verify`
- `git diff --check`

## Success Criteria

- Every mapped timer transition and formatting requirement has a deterministic passing assertion.
- Invalid or regressing clocks cannot produce negative or fabricated elapsed values.
- The module is pure, immutable, dependency-free at the runtime boundary, and does not change raw events or execution.
- Focused tests and `bun run verify` pass to terminal exit.
- Memory is current and `reports/task_05.md` can record exact evidence and unresolved risks.
