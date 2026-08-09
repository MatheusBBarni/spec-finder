---
status: pending
title: Integrate Single-Run No-Work Command Lifecycle
type: backend
complexity: medium
dependencies:
  - task_01
  - task_02
---

# Task 03: Integrate Single-Run No-Work Command Lifecycle

## Overview

Complete the approved single-packet experience: emit a truthful successful
no-UI line and keep the interactive cockpit visible only for the typed no-work
outcome until the operator exits. Normal success, failure, cancellation, and
the separate batch command route retain their established cleanup semantics.

## Source Artifacts

- PRD: `.spec-finder/tasks/empty-run-state/_prd.md`
- TechSpec: `.spec-finder/tasks/empty-run-state/_techspec.md`

<critical>
- Read `.spec-finder/tasks/empty-run-state/_prd.md`, `.spec-finder/tasks/empty-run-state/_techspec.md`, and ADRs `adr-001-empty-run-state.md`, `adr-002-default-informative-no-work.md`, and `adr-003-typed-no-work-lifecycle.md`, repository instructions, current Git state, and completed dependencies `task_01` and `task_02` before editing.
- Treat `task_01` and `task_02` as required lower-numbered dependencies; branch on their typed result and consume their cockpit handle rather than matching output text or recreating keyboard logic.
- Use `sf-memory`; read `.spec-finder/tasks/empty-run-state/memory/MEMORY.md` and `.spec-finder/tasks/empty-run-state/memory/task_03.md` before editing and update both with factual learnings before finishing.
- Implement only the singular command lifecycle and its tests. Preserve user-owned batch routing, batch terminal output, and existing setup-command coverage; do not expand no-work UX into batch behavior.
- Reference TechSpec sections `Command and Cockpit Lifecycle`, `External Interfaces`, `Integration Points`, `Failure and Recovery Behavior`, and `Compatibility, Migration, and Rollback` instead of duplicating their architecture.
- Run focused tests and the exact repository verification gate to terminal exit. Do not change lifecycle status or write `reports/task_03.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST print an explicit all-tasks-complete meaning in singular `--no-ui` output and return exit code `0` for typed valid no-work (G-02, US-03, F-03, C-02, M-03).
2. MUST await the cockpit exit handle only after a successful typed no-work result; normal success, failure, cancellation, and thrown errors retain automatic `finally` cleanup (G-02, F-04).
3. MUST preserve command ownership of process lifecycle while App retains Q/Ctrl+C ownership (US-02, C-03).
4. SHOULD keep batch routing/output and existing human-readable command contracts unchanged except for type-compatible cockpit test doubles (F-04).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-02, US-03, F-03, C-02, M-03 | Explain no-work and exit successfully in no-UI | Injected single-run command/output test |
| US-02, C-03 | Wait only for explicit cockpit exit | Controlled deferred-handle lifecycle test |
| F-04 | Preserve normal/batch control flow | Normal-run and batch command regression tests |
| TechSpec: Integration Points | Use typed result and cockpit handle | No string-matching lifecycle assertion |
| TechSpec: Failure and Recovery Behavior | Keep error/cancellation cleanup | Thrown-runner and non-no-work regression tests |

## Subtasks

- [ ] 03.1 Format singular no-UI terminal output from typed no-work metadata while keeping legacy output for other terminal events.
- [ ] 03.2 Await `waitForExit()` only for an interactive successful no-work result before normal final cleanup.
- [ ] 03.3 Keep normal, failure, cancellation, and batch lifecycle paths non-blocking and type-compatible with the expanded cockpit handle.
- [ ] 03.4 Add deterministic command tests for output, success exit, deferred retention, normal auto-close, error cleanup, and batch regression.

## Implementation Details

Use the existing command test injection seams when present, or introduce the
smallest equivalent test seam without broadening public CLI behavior. The
single-run branch is the feature boundary. Current batch code may need only
type-compatible cockpit test doubles; do not alter its aggregate output,
`already_complete` classification, or public invocation behavior. The command
must inspect `result.outcome`, never completion text, to choose retention.

### Relevant Files

- `src/commands.ts` — singular listener formatting, result branch, and conditional interactive wait.
- `tests/commands.test.ts` — controlled output, runner, and cockpit-handle lifecycle tests while retaining existing setup/batch coverage.
- `src/ui/cockpit.tsx` — task_02 handle contract consumed here; do not redesign it.

### Dependent Files

- `src/engine.ts` and `src/events.ts` — task_01 supplies the typed result/event fields.
- `src/ui/App.tsx` and `src/ui/store.ts` — task_02 renders and resolves the no-work state.
- `src/batch.ts` and `tests/batch.test.ts` — preserve already-complete and aggregate command regression behavior.

### Related ADRs

- [ADR-002: Default informative no-work](adrs/adr-002-default-informative-no-work.md) — successful no-UI and information-only UX.
- [ADR-003: Typed no-work outcome and command-owned exit lifecycle](adrs/adr-003-typed-no-work-lifecycle.md) — command-owned wait and normal-run auto-close.

## Deliverables

- Single-run no-UI text and conditional interactive wait behavior.
- Deterministic command lifecycle tests, including batch compatibility regression.
- Updated `.spec-finder/tasks/empty-run-state/memory/MEMORY.md` and `memory/task_03.md` with factual durable context.
- `reports/task_03.md` produced by Spec Finder's report phase.

## Tests

### Unit Tests

- [ ] Given a singular typed no-work result/event in `--no-ui`, output contains the all-complete meaning and command returns `0`.
- [ ] Given a normal successful result, command returns and closes once without awaiting an unresolved exit handle.
- [ ] Given a no-work interactive result, command remains pending until a controlled cockpit exit signal resolves, then closes once and returns `0`.
- [ ] Given a thrown runner, failure result, or cancellation path, preserve existing error/exit cleanup and do not wait for the no-work handle.

### Integration Tests

- [ ] Existing `--multiple` routing/output tests and `already_complete` batch behavior remain passing with the compatible cockpit handle shape.
- [ ] A no-work terminal event reaches the no-UI listener as text without introducing a new machine-readable output format.

### Platform or Manual Evidence

- [ ] Not applicable beyond deterministic command and OpenTUI lifecycle tests; no external service or packaging boundary changes.

### Verification Commands

- `rtk bun test tests/commands.test.ts tests/batch.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Valid single-run no-work is explicit and successful in both no-UI and interactive modes.
- Only no-work retention waits for Q/Ctrl+C; normal lifecycle behavior remains automatic.
- Batch behavior and unrelated user-owned command work are preserved.
- Focused tests and the repository gate pass to terminal exit.
- Memory is current and `reports/task_03.md` is ready for the report phase.
