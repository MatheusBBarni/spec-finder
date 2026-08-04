---
status: pending
title: Enforce read-only ACP permission handling
type: backend
complexity: medium
dependencies: []
---

# Task 03: Enforce read-only ACP permission handling

## Overview

Change TUI-mode ACP permission handling to fail closed: a `permissions: "prompt"` request is cancelled and described in task-scoped activity instead of becoming a permission modal. Preserve approve-all, deny, non-UI prompting, provider behavior, and the existing engine failure path; update only the narrow README wording that still promises an in-cockpit prompt.

<critical>
- Read the PRD, TechSpec, ADR-001, ADR-003, repository instructions, and current Git state before editing.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_03.md` before editing and update memory before finishing.
- Implement only ACP permission behavior, its fixtures/tests, and the narrow documentation correction; do not change the task engine or UI layout.
- Never implicitly approve a TUI prompt request and never add a new permission control.
- Preserve unrelated dirty changes in `README.md`, `src/engine.ts`, setup files, and tests.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST cancel a TUI-mode `permissions: "prompt"` request, emit a stable task-scoped read-only notice, and avoid emitting an interactive `permission_requested` event. (PRD-G-05, PRD-US-08, PRD-F-09, PRD-M-06)
2. MUST preserve approve-all, deny, and non-UI prompt behavior and the existing engine failure outcome. (PRD-C-06, TechSpec External Interfaces)
3. MUST keep the ACP transport and raw `RunEvent` contract unchanged. (PRD-C-06, ADR-003)
4. SHOULD update user-facing cockpit/configuration documentation without reverting unrelated existing README changes. (TechSpec Impact Analysis)
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| `PRD-G-05`, `PRD-US-08`, `PRD-F-09` | Remove the TUI permission control-plane path at the ACP boundary. | Mock permission request test and event assertions |
| `PRD-C-01`, `PRD-C-06`, `PRD-M-06` | Fail closed while preserving non-TUI policies and execution semantics. | Approve-all/deny/non-UI regression tests |
| TechSpec Permission Path, External Interfaces, Security and Privacy | Emit clear cancellation activity and avoid protocol expansion. | ACP integration fixture and TypeScript check |

## Subtasks

- [ ] 03.1 Implement TUI prompt cancellation and stable read-only activity emission in `resolvePermission`.
- [ ] 03.2 Preserve approve-all, deny, and non-UI prompt branches exactly at their existing boundaries.
- [ ] 03.3 Add an opt-in permission-request path to the mock ACP agent without changing its default engine fixture behavior.
- [ ] 03.4 Add ACP tests for cancellation, event absence, policy preservation, and failure ordering.
- [ ] 03.5 Update only the README cockpit/permission wording and verify unrelated dirty content remains intact.
- [ ] 03.6 Run focused tests and repository gate to terminal exit, then update task memory.

## Implementation Details

Follow the TechSpec Permission Path, Integration Points, Failure and Recovery Behavior, and Security and Privacy sections. The existing `interactivePermissions` wiring from `src/commands.ts` should remain usable; the TUI branch must become non-interactive rather than adding a new public option.

### Relevant Files

- `src/acp-client.ts` — implement fail-closed TUI prompt handling.
- `tests/acp-client.test.ts` — verify ACP permission and policy behavior.
- `tests/fixtures/mock-agent.ts` — create an opt-in permission-request fixture while preserving default turns.
- `README.md` — update the cockpit and `permissions: "prompt"` wording narrowly.

### Dependent Files

- `src/commands.ts` — existing TUI/non-TUI `interactivePermissions` wiring; verify without broadening scope.
- `src/engine.ts` — existing stop/error handling; verify unchanged.
- `src/events.ts` — raw event types; do not change.

### Related ADRs

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — forbids a second control plane in the cockpit.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — records the approved fail-closed permission behavior.

## Deliverables

- Fail-closed TUI permission branch with stable activity notice.
- Mock ACP permission-request fixture and focused tests.
- Preserved approve-all, deny, and non-UI behavior.
- Narrow README correction that reflects read-only cockpit behavior.
- Updated `memory/MEMORY.md` and `memory/task_03.md` when warranted.
- `reports/task_03.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given TUI mode and `permissions: "prompt"`, when ACP requests permission, then the response is cancelled and no `permission_requested` event is emitted.
- [ ] Given TUI mode and a permission request, when the branch executes, then the task-scoped read-only notice is emitted before the existing engine failure activity.
- [ ] Given approve-all or deny, when ACP requests permission, then the existing matching option is selected.

### Integration Tests

- [ ] Given the mock ACP agent’s opt-in permission request, when `runAcpTurn` executes, then it returns the expected cancellation/failure outcome without hanging.
- [ ] Given the existing non-UI ACP test path, when `interactivePermissions` is false, then current prompt behavior remains unchanged.
- [ ] Given the current engine fixture, when a normal task runs, then report generation and task completion remain unchanged.

### Platform or Manual Evidence

- [ ] Inspect the README diff to confirm only cockpit/permission wording changed and unrelated dirty additions remain intact.

### Verification Commands

- `bun test tests/acp-client.test.ts tests/engine.test.ts`
- `bun run check`
- `bun run verify`

## Success Criteria

- No TUI permission options or interactive permission events remain on the prompt path.
- Cancellation is visible and leads into the existing failure behavior without a hung ACP turn.
- Approve-all, deny, and non-UI behavior remain covered and passing.
- Raw ACP/event contracts and execution code remain unchanged.
- Focused tests and `bun run verify` pass to terminal exit.
- Memory is current and the final report records exact evidence and unresolved risks.
