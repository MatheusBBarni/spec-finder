---
status: in_progress
title: Add Deterministic macOS PTY Release Evidence
type: infra
complexity: medium
dependencies:
  - task_03
  - task_04
---

# Task 05: Add Deterministic macOS PTY Release Evidence

## Overview

Deliver the selected macOS release gate as deterministic test infrastructure.
It must run a real OpenTUI failure review through a pseudo-terminal, verify the
complete diagnostic before dismissal, send Esc, and prove restored terminal
completion with exit status `1` without a live provider.

## Source Artifacts

- PRD: `.spec-finder/tasks/visible-task-run-errors/_prd.md`
- TechSpec: `.spec-finder/tasks/visible-task-run-errors/_techspec.md`

<critical>
- Before editing, read `.spec-finder/tasks/visible-task-run-errors/_prd.md`, `.spec-finder/tasks/visible-task-run-errors/_techspec.md`, packet ADRs, repository instructions, and current Git state.
- Do not begin until ordered-multiple tasks 03–05 are integrated; this task consumes their completed command/cockpit behavior and must not edit `src/batch.ts` or `src/events.ts`.
- Treat `task_05` as the canonical execution position; `task_03` and `task_04` must be completed before this task begins.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_05.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb production lifecycle or UI behavior changes.
- Reference TechSpec Testing and Evidence, Observability, and Compatibility, Migration, and Rollback instead of duplicating interfaces.
- Run focused tests and `rtk bun run verify` to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST add a `bun run test:pty` macOS gate that uses absolute `/usr/bin/script` and `/usr/bin/expect` with clear missing-tool failure output.
2. MUST drive the real command/cockpit lifecycle with deterministic fake-runner events, including a multiline failed task and exact generic recovery hint.
3. MUST tolerate terminal control sequences, send Esc to dismiss, and verify the original exit status remains `1`.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD G-04, M-01 | Prove a controlled interactive failure stays visible until dismissal. | PTY transcript assertion. |
| PRD M-02, M-04, F-02, F-03 | Prove exact error/task/outcome and fixed guidance in a real terminal. | Multiline fixture assertions. |
| PRD M-03, F-04 | Prove Esc cleanup preserves original nonzero result. | PTY exit assertion and manual smoke checklist. |
| TechSpec End-to-End/Platform Evidence; ADR-002/003 | Make macOS PTY proof a release gate without a native package. | `test:pty` package command. |

## Subtasks

- [ ] 05.1 Provide a deterministic command fixture that reaches a real retained failure review without a provider.
- [ ] 05.2 Provide a macOS PTY driver that checks tool availability, terminal content, dismissal, and exit status.
- [ ] 05.3 Register the focused release command and preserve the standard repository verification gate.
- [ ] 05.4 Record the manual real-terminal smoke checklist required before default-on release.

## Implementation Details

Follow TechSpec **Testing and Evidence**, **Observability**, and **Compatibility,
Migration, and Rollback**. The PTY driver is macOS-only release infrastructure;
use the verified BSD `script` form and absolute tool paths. Assertions must be
robust to control sequences emitted by terminal rendering. This task creates no
new runtime dependency or provider interaction.

### Relevant Files

- `package.json` — verified script registry; add the focused `test:pty` command.
- `tests/fixtures/failure-review-cli.ts` — create deterministic fake-runner entry point that uses the actual command/cockpit lifecycle.
- `tests/failure-review.pty.expect` — create macOS PTY protocol and terminal/exit assertions.

### Dependent Files

- `src/commands.ts` — task 03 provides the lifecycle exercised by the fixture.
- `src/ui/App.tsx` and `src/ui/cockpit.tsx` — tasks 01/04 provide the retained review and dismissal behavior exercised by the PTY.
- `README.md` — no change required unless the project’s test-command documentation is expanded in the same scoped review.

### Related ADRs

- [ADR-002: Default-On Failure Review With Generic Recovery Guidance](adrs/adr-002-default-on-failure-review.md) — automated terminal coverage plus manual smoke is a release bar.
- [ADR-003: Command-Owned Retained Failure-Review Lifecycle](adrs/adr-003-command-owned-retained-failure-review-lifecycle.md) — PTY must prove dismissal and cleanup behavior.

## Deliverables

- macOS PTY test command, deterministic fixture, and expect protocol.
- Release-ready PTY evidence and manual smoke checklist.
- Updated `memory/MEMORY.md` and `memory/task_05.md` when warranted.
- `reports/task_05.md` final evidence report.

## Tests

### Unit Tests

- [ ] Not applicable: this task's implementation is the platform test harness; its deterministic fixture is exercised end-to-end by the PTY command.

### Integration Tests

- [ ] Given the fake runner's failed status/activity/final-result sequence, when the fixture invokes the actual command path, then it reaches the retained cockpit rather than a provider process.

### Platform or Manual Evidence

- [ ] Given macOS `/usr/bin/script` and `/usr/bin/expect`, when `rtk bun run test:pty` executes, then it observes failed task ID, multiline error, fixed hint, Esc dismissal, and exit `1`.
- [ ] In a real terminal, manually confirm one single failure and one batch failure remain readable until dismissal, then confirm `--no-ui` completes immediately.

### Verification Commands

- `rtk bun run test:pty`
- `rtk bun run verify`

## Success Criteria

- The release command fails clearly when required macOS tools are unavailable and otherwise proves the retained-review contract deterministically.
- The PTY fixture requires no provider, native package, persistent data, or raw ACP capture.
- Platform evidence and repository verification pass to terminal exit.
- Coverage is not independently measurable for the expect protocol; the deterministic end-to-end assertions cover every scripted branch.
- Memory is current and `reports/task_05.md` records exact evidence, macOS tool versions, and unresolved risks.
