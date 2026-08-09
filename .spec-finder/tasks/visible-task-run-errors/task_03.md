---
status: pending
title: Enforce Outcome-Aware Command Failure Review
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 03: Enforce Outcome-Aware Command Failure Review

## Overview

Apply the command-owned session policy to both single-packet and aggregate batch
runs. Eligible failures wait for dismissal without changing their nonzero exit
result; every other terminal outcome remains immediate and automation-safe.

## Source Artifacts

- PRD: `.spec-finder/tasks/visible-task-run-errors/_prd.md`
- TechSpec: `.spec-finder/tasks/visible-task-run-errors/_techspec.md`

<critical>
- Before editing, read `.spec-finder/tasks/visible-task-run-errors/_prd.md`, `.spec-finder/tasks/visible-task-run-errors/_techspec.md`, packet ADRs, repository instructions, and current Git state.
- Do not begin until ordered-multiple tasks 03–05 are integrated; consume their batch contracts without modifying `src/batch.ts` or `src/events.ts`. Dirty source is not completion evidence.
- Treat `task_03` as the canonical execution position; `task_01` must be completed before this task begins.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb exact-detail rendering or PTY harness scope.
- Reference TechSpec Data and Control Flow, External Interfaces, Failure and Recovery Behavior, and Compatibility instead of duplicating interfaces.
- Run focused tests and `rtk bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST start a cockpit only when neither no-UI control applies and both stdin and stdout are TTYs.
2. MUST await session dismissal only for a non-aborted single failure or batch `status: "failed"`, then preserve the original nonzero result.
3. MUST close immediately for success, cancellation, batch `preflight_failed`, non-TTY/no-UI execution, and thrown errors; close must remain idempotent.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD G-01, US-01, F-01 | Hold eligible failed commands until dismissal. | Controllable fake-session tests. |
| PRD G-03, US-04, US-05, F-04 | Preserve non-UI, normal, and cancellation completion. | Terminal eligibility/outcome matrix. |
| PRD G-04, M-01, M-03 | Protect default-on behavior with deterministic lifecycle evidence. | Single and batch exit/close assertions. |
| TechSpec External Interfaces and ADR-003 | Require both TTY streams and consume existing batch status only. | Input/output injection tests. |

## Subtasks

- [ ] 03.1 Make interactive eligibility depend on explicit no-UI intent and both terminal streams.
- [ ] 03.2 Apply the shared cockpit-session lifecycle to single and aggregate batch command outcomes.
- [ ] 03.3 Preserve cancellation, failure, exception, console output, and exit-code semantics for every bypass path.
- [ ] 03.4 Prove the complete outcome matrix with controllable runners and session fakes.

## Implementation Details

Follow TechSpec **Data and Control Flow**, **External Interfaces**, **Failure and
Recovery Behavior**, and **Compatibility, Migration, and Rollback**. Add only
an input TTY injection seam needed for deterministic command tests; normal CLI
execution continues to use process streams and `src/cli.tsx` needs no ownership
change.

### Relevant Files

- `src/commands.ts` — verified duplicated single/batch cockpit lifecycle and output-only TTY check; central task surface.
- `tests/commands.test.ts` — verified runner/startup injection seams and current batch exit coverage; extend with controllable sessions.

### Dependent Files

- `src/ui/cockpit.tsx` — task 01 provides the session contract consumed here.
- `src/cli.tsx` — retains normal process-stream entry behavior; no lifecycle change expected.
- `src/batch.ts` and `src/events.ts` — external prerequisite contracts to consume, never modify in this task.
- `tests/cockpit.test.tsx` — task 04 verifies the retained screen shown while this command waits.

### Related ADRs

- [ADR-001: Failure-Only Cockpit Diagnostics](adrs/adr-001-failure-only-cockpit-diagnostics.md) — failures alone retain review.
- [ADR-003: Command-Owned Retained Failure-Review Lifecycle](adrs/adr-003-command-owned-retained-failure-review-lifecycle.md) — commands own cancellation, wait, and teardown.

## Deliverables

- Shared outcome-aware lifecycle for single and aggregate batch commands.
- Deterministic command tests covering both TTY streams and all terminal outcomes.
- Updated `memory/MEMORY.md` and `memory/task_03.md` when warranted.
- `reports/task_03.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given `--no-ui`, stdin non-TTY, or stdout non-TTY, when a failure occurs, then no cockpit starts and the original console/nonzero behavior remains.
- [ ] Given both TTYs and a single or aggregate batch failure, when the runner settles, then the command remains pending until fake dismissal and returns `1` afterward.
- [ ] Given success, cancellation, or batch `preflight_failed`, when the runner settles, then no dismissal wait occurs.

### Integration Tests

- [ ] Given active Q/Ctrl+C cancellation followed by a false-looking runner result, when the command settles, then it closes once and never re-enters review.
- [ ] Given an injected runner/coordinator throw, when startup already succeeded, then the session closes and the original exception propagates.

### Platform or Manual Evidence

- [ ] Not applicable: task 05 runs the real macOS PTY proof against this lifecycle.

### Verification Commands

- `rtk bun test tests/commands.test.ts`
- `rtk bun run verify`

## Success Criteria

- Both run modes follow the approved failure-review and non-wait outcome matrix.
- No ineligible invocation can wait for keyboard input.
- Existing batch coordination/event contracts and console output remain untouched.
- Focused tests and repository verification pass to terminal exit.
- Coverage reaches 80% for changed testable logic when measurable.
- Memory is current and `reports/task_03.md` records exact evidence and unresolved risks.
