---
status: pending
title: Expose checkpoint phases to manual batch execution
type: backend
complexity: medium
dependencies:
  - task_01
  - task_02
  - task_03
---

# Task 05: Expose checkpoint phases to manual batch execution

## Overview

Expose the shared checkpoint service through a narrow CLI bridge and migrate the manual batch skill to use it. The manual workflow must reject legacy invocation-level auto-commit controls, preserve its report/status gates, and document the same config-only local recovery contract as ACP execution.

<critical>
- Read the PRD, TechSpec, ADRs, repository instructions, current Git state, and completed task_01/task_02/task_03 evidence before editing.
- Treat this task's numeric ID as its canonical execution position; all three dependencies must be completed first.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_05.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not alter runtime/UI/archive lifecycle ownership.
- Reference TechSpec §External Interfaces and §Integration Points for the CLI/manual contract.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST route `checkpoint begin|complete <slug> <task_id>` to the shared service with validated packet/task IDs and config-only behavior.
2. MUST reject legacy `auto-commit=true|false` invocation tokens with clear guidance instead of treating them as policy inputs.
3. MUST update `sf-batch-tasks` to call begin before task execution and complete after its report/status gate, stopping on blocked delivery.
4. SHOULD document local-only checkpoints, normal-rerun recovery, and no review/merge/push implication in operator-facing docs.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-01/F-06/F-07 | Config-only CLI/manual bridge and local-only behavior | Command and skill tests |
| PRD US-01/US-06/US-07 | Discoverable opt-in, unchanged disabled flow, path parity | Help/docs/parity assertions |
| PRD C-01/C-02/C-06, NG-01/05/07 | Reject legacy override; no remote/bypass; no reviewed/merged claim | Negative CLI/skill tests |
| TechSpec §External Interfaces | Exact command and Git-free CLI boundary | Commands tests |
| PRD M-05 | Manual and runtime outcomes match defined scenarios | Cross-path acceptance cases |

## Subtasks

- [ ] 05.1 Add CLI dispatch, help text, packet/task validation, and config-required errors for checkpoint phases.
- [ ] 05.2 Add command tests for begin/complete, invalid IDs, disabled config, and legacy token rejection.
- [ ] 05.3 Migrate the batch skill’s invocation/workflow contract to config-only begin/complete calls.
- [ ] 05.4 Update README configuration and recovery documentation after the CLI contract is stable.

## Implementation Details

Follow TechSpec §External Interfaces, §Integration Points, §Compatibility, Migration, and Rollback, and §Observability. The CLI must be a thin bridge; it must not duplicate Git logic or invent a second policy source.

### Relevant Files

- `src/commands.ts` — add checkpoint command handlers and validation.
- `src/cli.tsx` — dispatch/help for the new command and legacy-token rejection.
- `tests/commands.test.ts` — command contract and error-path coverage.
- `skills/sf-batch-tasks/SKILL.md` — manual lifecycle and config-only migration.
- `README.md` — operator-facing configuration/recovery documentation.

### Dependent Files

- `src/checkpoints.ts` — task_03 service implementation.
- `src/tasks.ts` — task_02 metadata validation.
- `src/engine.ts` — task_04 provides the parity reference.

### Related ADRs

- [ADR-003: Shared Checkpoint Module and Task Delivery State](adrs/adr-003-shared-checkpoint-module-and-task-delivery-state.md) — CLI is the manual bridge to one service.
- [ADR-002: Automatic Local Recovery Checkpoints](adrs/adr-002-automatic-local-recovery-checkpoints.md) — documentation-only opt-in and local boundary.

## Deliverables

- CLI checkpoint begin/complete bridge and help/error behavior.
- Migrated manual batch skill and README documentation.
- Command and cross-path contract tests.
- Updated `memory/MEMORY.md` and `memory/task_05.md` when warranted.
- `reports/task_05.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given valid slug/task and enabled config, begin/complete invoke the shared service path.
- [ ] Given false config, commands report disabled/config-required behavior without Git mutation.
- [ ] Given invalid slug/task or malformed phase, commands return clear nonzero errors.
- [ ] Given legacy auto-commit tokens, CLI/skill guidance rejects them.

### Integration Tests

- [ ] Manual skill contract describes begin before `sf-execute-task`, complete after report/status validation, and stop on blocked delivery.
- [ ] Equivalent CLI and runtime scenarios expose the same created/blocked/no-commit outcomes.

### Platform or Manual Evidence

- [ ] Run `spec-finder --help`/command help and inspect the local-only recovery wording.

### Verification Commands

- `bun test tests/commands.test.ts`
- `bun run verify`

## Success Criteria

- Manual execution has no authoritative invocation-level auto-commit input.
- CLI and skill use the shared service and preserve report/status lifecycle gates.
- Focused tests and `bun run verify` pass to terminal exit.
