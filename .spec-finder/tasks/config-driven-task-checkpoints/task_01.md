---
status: pending
title: Add the auto-commit configuration contract
type: backend
complexity: medium
dependencies: []
---

# Task 01: Add the auto-commit configuration contract

## Overview

Add the strict, default-off `auto_commit` configuration contract and preserve compatibility for generated and migrated configuration files. This establishes the opt-in policy that all later checkpoint producers must consume.

<critical>
- Read the PRD, TechSpec, ADRs, repository instructions, and current Git state before editing.
- Treat this task's numeric ID as its canonical execution position; dependencies are already complete because this task has none.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_01.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb checkpoint implementation scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST parse `auto_commit` as a strict boolean with default `false`, preserve version-2 strict-key behavior, and keep version-1 migration default-off.
2. MUST ensure generated/default configuration and `spec-finder config` expose the field without adding an interactive setup opt-in.
3. SHOULD document that the setting enables local checkpoints only and never push, PR, review, or merge behavior.
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| PRD F-01, US-01, US-06 | Strict opt-in and unchanged default behavior | Config parser/default tests |
| PRD C-01, C-02, C-08 | Default-off, local-only, no telemetry policy is represented in config/docs | README/config output review |
| PRD M-03 | Omitted/false configuration creates no checkpoint mode | Config regression test |
| TechSpec §Compatibility, Migration, and Rollback | Version 2 remains compatible and v1 migration stays false | Migration test |

## Subtasks

- [ ] 01.1 Extend schema, inferred config type, default object, and legacy migration for `auto_commit`.
- [ ] 01.2 Update configuration and setup tests to cover omitted, false, true, invalid, and migrated values.
- [ ] 01.3 Verify generated/config output exposes the opt-in without changing setup prompts or unrelated behavior.

## Implementation Details

Use the approved configuration boundary in TechSpec §Integration Points and §Compatibility, Migration, and Rollback. Keep Zod strictness and existing error wording conventions. Do not add runtime Git behavior here.

### Relevant Files

- `src/config.ts` — existing strict schema, defaults, migration, and config I/O.
- `tests/config.test.ts` — existing configuration contract tests.
- `tests/setup.test.ts` — generated and migrated configuration assertions.

### Dependent Files

- `src/commands.ts` — later consumers receive the expanded `SpecFinderConfig`.
- `src/engine.ts` — later checkpoint integration branches on `config.auto_commit`.
- `README.md` — document in task_05 after the CLI contract is finalized.

### Related ADRs

- [ADR-001: Config-Driven Per-Task Git Checkpoints](adrs/adr-001-config-driven-task-checkpoints.md) — configuration is the sole policy source and defaults false.
- [ADR-002: Automatic Local Recovery Checkpoints](adrs/adr-002-automatic-local-recovery-checkpoints.md) — documentation-only opt-in.

## Deliverables

- Updated configuration schema/default/migration behavior.
- Focused config and setup tests.
- Updated `memory/MEMORY.md` and `memory/task_01.md` when warranted.
- `reports/task_01.md` final evidence report.

## Tests

### Unit Tests

- [ ] Given omitted `auto_commit`, parsing returns `false` and preserves all existing defaults.
- [ ] Given `auto_commit: true`, parsing preserves true and does not change provider/runtime settings.
- [ ] Given a non-boolean value or unknown key, parsing raises the existing configuration error.
- [ ] Given a version-1 configuration, migration returns version 2 with `auto_commit: false`.

### Integration Tests

- [ ] At setup/config output boundary, generated JSON contains `auto_commit: false` and can be reloaded by `loadConfig`.

### Platform or Manual Evidence

- [ ] Inspect `spec-finder config` output for the default field; record the exact terminal result.

### Verification Commands

- `bun test tests/config.test.ts tests/setup.test.ts`
- `bun run verify`

## Success Criteria

- All mapped configuration requirements are satisfied with evidence.
- Focused tests and `bun run verify` pass to terminal exit.
- Existing setup/config behavior remains unchanged except for the explicit field.
- Memory is current and the final report records exact evidence and unresolved risks.
