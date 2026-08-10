---
status: completed
title: Establish Command-Owned Cockpit Sessions
type: frontend
complexity: high
dependencies: []
---

# Task 01: Establish Command-Owned Cockpit Sessions

## Overview

Establish the explicit cockpit session boundary that owns renderer cleanup and
post-failure dismissal signaling. This removes UI-owned teardown while preserving
active-run cancellation behavior, giving the command layer a reliable contract
to use in later work.

## Source Artifacts

- PRD: `.spec-finder/tasks/visible-task-run-errors/_prd.md`
- TechSpec: `.spec-finder/tasks/visible-task-run-errors/_techspec.md`

<critical>
- Before editing, read `.spec-finder/tasks/visible-task-run-errors/_prd.md`, `.spec-finder/tasks/visible-task-run-errors/_techspec.md`, packet ADRs, repository instructions, and current Git state.
- Do not begin until ordered-multiple tasks 03–05 are integrated; dirty worktree changes in `src/ui/App.tsx` are not completion evidence. Preserve that work and do not edit `src/batch.ts` or `src/events.ts` for this task.
- Treat `task_01` as the canonical execution position; it has no internal dependencies but must satisfy the external integration prerequisite above.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb command lifecycle, store detail, or PTY release-gate scope.
- Reference TechSpec System Architecture, Implementation Design/Core Interfaces, and Failure and Recovery Behavior instead of duplicating interfaces.
- Run focused tests and `rtk bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST make `startCockpit` return an idempotent session that exposes renderer cleanup and a dismissal wait without changing runtime event types.
2. MUST route settled-failure Esc, Q, and Ctrl+C to dismissal while active-run Q/Ctrl+C continue to request cancellation.
3. SHOULD preserve existing live-renderer behavior and keyboard navigation outside the terminal failure state.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD G-01, US-01, F-01 | Supply explicit final-review dismissal signaling. | Keyboard and deferred-session component tests. |
| PRD G-03, US-05, F-04 | Preserve active cancellation and normal live behavior. | Active-key and renderer lifecycle tests. |
| TechSpec Core Interfaces; ADR-003 | Make commands the future owner of an idempotent session. | Session close/wait contract tests. |

## Subtasks

- [ ] 01.1 Provide a cockpit session that has one observable, idempotent cleanup and dismissal outcome.
- [ ] 01.2 Make the cockpit pass distinct cancellation and settled-review dismissal actions to the app.
- [ ] 01.3 Preserve active-run keyboard behavior while making final failure actions callback-only.
- [ ] 01.4 Prove the session and keyboard contracts with focused renderer tests.

## Implementation Details

Follow TechSpec **System Architecture**, **Implementation Design / Core
Interfaces**, and **Failure and Recovery Behavior**. This task intentionally
does not decide when a process waits; task 03 consumes the session contract.

### Relevant Files

- `src/ui/cockpit.tsx` — verified renderer startup and current close-only handle; change to the session boundary.
- `src/ui/App.tsx` — verified keyboard owner; replace direct teardown with cancellation/dismissal requests.
- `tests/cockpit.test.tsx` — verified OpenTUI frame and mock-input coverage; extend for the session contract.

### Dependent Files

- `src/commands.ts` — task 03 consumes the returned session.
- `tests/commands.test.ts` — task 03 test fakes must implement the new session shape.
- `src/ui/App.tsx` — task 04 consumes the dismissal callback to render the retained review surface.

### Related ADRs

- [ADR-001: Failure-Only Cockpit Diagnostics](adrs/adr-001-failure-only-cockpit-diagnostics.md) — failure review has an explicit dismissal boundary.
- [ADR-003: Command-Owned Retained Failure-Review Lifecycle](adrs/adr-003-command-owned-retained-failure-review-lifecycle.md) — command owns teardown and waiting.

## Deliverables

- Command-consumable, idempotent cockpit session and callback-only UI actions.
- Focused component evidence for dismissal, active cancellation, and cleanup semantics.
- Updated `memory/MEMORY.md` and `memory/task_01.md` when warranted.
- `reports/task_01.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given a session with an unresolved review, when dismissal is requested, then `waitForDismissal()` resolves once.
- [ ] Given repeated close or dismissal calls, when the renderer session is finalized, then cleanup is harmless and occurs once.

### Integration Tests

- [ ] Given an active cockpit, when Q or Ctrl+C is pressed, then cancellation is requested without App directly destroying the renderer.
- [ ] Given a settled failure review, when Esc, Q, or Ctrl+C is pressed, then dismissal is requested without cancellation.

### Platform or Manual Evidence

- [ ] Not applicable: real-PTY evidence is delivered by task 05 after command integration.

### Verification Commands

- `rtk bun test tests/cockpit.test.tsx`
- `rtk bun run verify`

## Success Criteria

- The session lifecycle is command-consumable, idempotent, and fully covered by focused tests.
- No direct renderer destruction remains in App keyboard handling.
- Focused tests and repository verification pass to terminal exit.
- Coverage reaches 80% for changed testable logic when measurable.
- Memory is current and `reports/task_01.md` records exact evidence and unresolved risks.
