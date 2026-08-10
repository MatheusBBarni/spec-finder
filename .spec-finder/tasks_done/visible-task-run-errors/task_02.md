---
status: completed
title: Preserve Complete Task Failure Details
type: frontend
complexity: medium
dependencies: []
---

# Task 02: Preserve Complete Task Failure Details

## Overview

Preserve the complete surfaced failure message in cockpit state while retaining
the existing compact task reason for live views. The projection must be
packet-qualified and reset correctly so a failure never leaks into another task
or batch packet.

## Source Artifacts

- PRD: `.spec-finder/tasks/visible-task-run-errors/_prd.md`
- TechSpec: `.spec-finder/tasks/visible-task-run-errors/_techspec.md`

<critical>
- Before editing, read `.spec-finder/tasks/visible-task-run-errors/_prd.md`, `.spec-finder/tasks/visible-task-run-errors/_techspec.md`, packet ADRs, repository instructions, and current Git state.
- Do not begin until ordered-multiple tasks 03–05 are integrated; preserve their dirty/current store projection work and do not edit `src/batch.ts` or `src/events.ts`.
- Treat `task_02` as the canonical execution position; it has no internal dependencies but must satisfy the external integration prerequisite above.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_02.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb session, final-review UI, command lifecycle, or PTY scope.
- Reference TechSpec Implementation Design/Data Models and Lifecycle, Security and Privacy, and Integration Points instead of duplicating interfaces.
- Run focused tests and `rtk bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST retain each failed task's complete trimmed surfaced activity message separately from its compact reason.
2. MUST key, clear, and select the detail through the same batch-qualified identity used by transcripts and task reasons.
3. SHOULD make a missing surfaced activity explicit to consumers rather than fabricating a diagnostic, stack trace, or ACP payload.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD G-01, G-02, US-02, F-02 | Preserve the exact message needed by the final review. | Short and multiline store fixtures. |
| PRD privacy constraint; ADR-001 | Keep details ephemeral and exclude stacks/raw ACP data. | State-shape and event-source tests. |
| TechSpec Data Models and Lifecycle | Reset and qualify details for single and batch runs. | Reset and duplicate-task-ID fixtures. |
| TechSpec M-02 obligation | Make full diagnostic fidelity testable. | Exact selector assertions. |

## Subtasks

- [ ] 02.1 Add an immutable exact-failure-detail projection with a consumer selector.
- [ ] 02.2 Preserve compact live reasons while capturing only valid failed-task activity as full detail.
- [ ] 02.3 Clear or replace details at the required task, run, and batch-packet lifecycle boundaries.
- [ ] 02.4 Prove exactness, qualification, reset, and missing-detail behavior through store fixtures.

## Implementation Details

Follow TechSpec **Implementation Design / Data Models and Lifecycle** and
**Security and Privacy**. Use the existing qualified task/transcript key; do
not repurpose newline-split transcript entries as the canonical exact message.

### Relevant Files

- `src/ui/store.ts` — verified compact `taskReasons`, qualified batch keys, and reset/status transitions; add the exact detail projection here.
- `tests/store.test.ts` — verified failed-reason and batch-projection fixtures; extend without weakening existing behavior.

### Dependent Files

- `src/ui/App.tsx` — task 04 renders the exact-detail selector.
- `tests/cockpit.test.tsx` — task 04 consumes deterministic full-detail fixtures.
- `src/ui/transcript.ts` — remains a dependent reading surface only; it is not the exact-message source.

### Related ADRs

- [ADR-001: Failure-Only Cockpit Diagnostics](adrs/adr-001-failure-only-cockpit-diagnostics.md) — show surfaced `Error.message`, not raw diagnostics.
- [ADR-003: Command-Owned Retained Failure-Review Lifecycle](adrs/adr-003-command-owned-retained-failure-review-lifecycle.md) — no event contract expansion.

## Deliverables

- Ephemeral, batch-qualified exact failure-detail state and selector.
- Store evidence for multiline fidelity, resets, and missing activity.
- Updated `memory/MEMORY.md` and `memory/task_02.md` when warranted.
- `reports/task_02.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given failed status followed by a multiline activity message, when the store consumes both, then the selector returns the complete trimmed message and the compact reason remains concise.
- [ ] Given two batch packets with the same task ID, when each fails, then their exact details do not collide.
- [ ] Given a new run, packet start, resumed task, or completed task, when state changes, then stale exact detail is absent.

### Integration Tests

- [ ] Given a malformed failed-event sequence without task activity, when a consumer selects the detail, then the missing-detail condition is explicit and no synthetic stack/payload is present.

### Platform or Manual Evidence

- [ ] Not applicable: terminal rendering and PTY evidence are delivered by tasks 04 and 05.

### Verification Commands

- `rtk bun test tests/store.test.ts`
- `rtk bun run verify`

## Success Criteria

- Complete surfaced activity is retained exactly and never leaks between task/run contexts.
- Existing compact reason and transcript behavior remains compatible.
- Focused tests and repository verification pass to terminal exit.
- Coverage reaches 80% for changed testable logic when measurable.
- Memory is current and `reports/task_02.md` records exact evidence and unresolved risks.
