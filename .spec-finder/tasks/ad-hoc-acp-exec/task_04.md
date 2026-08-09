---
status: completed
title: Implement Bounded Cross-Platform Process Supervision
type: infra
complexity: high
dependencies:
  - task_01
---

# Task 04: Implement Bounded Cross-Platform Process Supervision

## Overview

Implement the process supervisor that owns provider spawning, pipe closure, idempotent forced cleanup, POSIX process-group termination, and Windows process-tree termination. This task delivers the portable implementation and deterministic fixtures; universal native certification remains the explicit release gate in task_09.

## Source Artifacts

- PRD: `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`
- TechSpec: `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`

<critical>
- Read `.spec-finder/tasks/ad-hoc-acp-exec/_prd.md`, `.spec-finder/tasks/ad-hoc-acp-exec/_techspec.md`, all packet ADRs, repository instructions, current Git state, and completed `task_01` before editing.
- Treat `task_01` as a required lower-numbered dependency and implement its supervisor contract without moving ACP semantic cancellation into this module.
- Use `sf-memory`; read `.spec-finder/tasks/ad-hoc-acp-exec/memory/MEMORY.md` and `.spec-finder/tasks/ad-hoc-acp-exec/memory/task_04.md` before editing and update memory before finishing.
- Implement only process spawning, stream lifetime, and forced tree cleanup. Do not implement ACP requests, exec routing, provider certification, or claim unavailable-platform evidence.
- Reference TechSpec sections `Data and Control Flow`, `Core Interfaces`, `Failure and Recovery Behavior`, and `End-to-End and Platform Evidence`.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write `reports/task_04.md`; Spec Finder owns those phases.
</critical>

<requirements>
1. MUST spawn providers directly without a shell, use explicit stdio pipes, expose confirmed closure, and distinguish spawn, process, pipe, and cleanup failure (F-06, ADR-003).
2. MUST implement idempotent deadline-driven forced cleanup using isolated POSIX groups and Windows child-tree termination without signalling the host process group (G-04, M-06).
3. MUST let a second cancellation skip remaining grace and begin forced cleanup while keeping the total product cancellation budget available to the ACP coordinator (F-06).
4. MUST prove that direct-child exit alone is not accepted as descendant cleanup and surface an unconfirmed tree as failure.
5. SHOULD use built-in runtime/OS facilities first; if native Windows evidence later disproves `taskkill /T /F`, stop for an approved Job Object design rather than adding an unreviewed dependency.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| G-04, US-05, F-06 | Bounded provider cleanup | Supervisor state-machine tests |
| HC-08, M-06 | Confirm descendants stop within the release bound | PID-recording process-tree fixture |
| ADR-003 | Use platform-aware cleanup | POSIX and Windows branches under test |
| TechSpec: Failure and Recovery Behavior | Treat cleanup uncertainty as non-success | Explicit cleanup-failure result |

## Subtasks

- [ ] 04.1 Implement direct provider spawning with explicit streams and confirmed close semantics.
- [ ] 04.2 Implement isolated POSIX group TERM/KILL escalation and host-group safeguards.
- [ ] 04.3 Implement Windows `taskkill /PID <pid> /T /F` tree cleanup and bounded command handling.
- [ ] 04.4 Add deterministic direct-child, lingering-pipe, and recorded-grandchild fixtures.
- [ ] 04.5 Add idempotency, deadline, second-cancel, and cleanup-failure tests.
- [ ] 04.6 Run native evidence on the current platform and preserve all-platform certification for task_09.

## Implementation Details

The ACP layer owns the two-second semantic grace period; this supervisor owns only process and stream lifecycle once asked to close or cancel a tree. On POSIX, use an isolated session/process group and confirm the direct process plus recorded fixture descendants. On Windows, use the documented process-tree command and wait for terminal completion. Never equate “signal sent” with “process exited.”

### Relevant Files

- `src/process-supervisor.ts` — create; platform-aware spawn and cleanup implementation.
- `tests/process-supervisor.test.ts` — create; lifecycle and platform-branch tests.
- `tests/fixtures/process-tree.ts` — create; direct child/grandchild and lingering-stream fixture.

### Dependent Files

- `src/acp-turn.ts` — task_05 uses the supervisor after semantic cancellation and normal completion.
- `src/exec.ts` — task_08 uses second-signal escalation and terminal cleanup results.
- `src/providers.ts` — supplies direct command/argv launch specifications.

### Related ADRs

- [ADR-001: Guarded One-Turn ACP Execution](adrs/adr-001-guarded-one-turn-exec.md) — bounded cancellation gates the feature.
- [ADR-003: Shared ACP Turn Core and Certified Lifecycle](adrs/adr-003-shared-acp-turn-core-and-certified-lifecycle.md) — requires cross-platform cleanup before release anywhere.

## Deliverables

- Cross-platform process supervisor and descendant fixture.
- Focused lifecycle tests and current-platform native evidence.
- Updated shared and `task_04` memory when warranted.
- `reports/task_04.md` final evidence report produced by the report phase.

## Tests

### Unit Tests

- [ ] Given a spawn failure, return a typed failure without an unhandled process event.
- [ ] Given normal process and pipe closure, resolve confirmed cleanup once.
- [ ] Given repeated cancellation or a second signal, perform at most one escalation sequence and skip grace when requested.
- [ ] Given a simulated Windows launch, construct and bound `taskkill /PID <pid> /T /F` without shell interpolation.

### Integration Tests

- [ ] Given a child with a recorded long-lived grandchild, direct-child signalling is insufficient but supervisor cleanup removes the in-group tree.
- [ ] Given a child exit with held-open pipes, wait for terminal stream closure or return cleanup failure by deadline.

### Platform or Manual Evidence

- [ ] Run the real descendant fixture on the current OS and record PID/termination timing; task_09 repeats it on macOS, Linux, and Windows.

### Verification Commands

- `rtk bun test ./tests/process-supervisor.test.ts`
- `rtk bun run check`
- `rtk bun run verify`

## Success Criteria

- Supervisor outcomes distinguish requested, signalled, closed, and unconfirmed states.
- The current-platform descendant fixture terminates within the configured bound.
- Focused tests and the repository gate pass to terminal exit.
- New testable logic reaches at least 80% coverage when measurable.
- No ACP, provider-certification, or packet behavior is absorbed.
- Memory and the final report state which platforms remain for task_09.
