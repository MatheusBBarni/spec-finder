---
status: completed
title: Author TDD batch skill
type: docs
complexity: medium
dependencies:
  - task_02
  - task_03
---

# Task 04: Author TDD batch skill

## Overview

Add `sf-tdd-batch` as the manual range runner that only invokes TDD execute and TDD report. It must keep core batch’s dependency order, skip-completed, stop-on-failure, dual-ownership ban, and config-driven checkpoint CLI so TDD ranges fail closed the same way.

## Source Artifacts

- PRD: `.spec-finder/tasks/tdd-skill-pack/_prd.md`
- TechSpec: `.spec-finder/tasks/tdd-skill-pack/_techspec.md`

<critical>
- Read `.spec-finder/tasks/tdd-skill-pack/_prd.md`, `.spec-finder/tasks/tdd-skill-pack/_techspec.md`, relevant packet ADRs, repository instructions, and current Git state before editing. These paths must contain the current packet slug in generated output.
- Treat this task's numeric ID as its canonical execution position; every declared dependency must already be completed and have a lower numeric ID.
- Use `sf-memory`; read `memory/MEMORY.md` and `memory/task_04.md` before editing and update memory before finishing.
- Implement only this task; preserve unrelated work and do not absorb follow-up scope.
- Reference TechSpec sections for design details instead of duplicating interfaces or architecture.
- Run focused tests and the exact repository verification gate to terminal exit.
- Do not change lifecycle status or write the final report when Spec Finder owns those phases.
</critical>

<requirements>
1. MUST create `skills/sf-tdd-batch/` with `SKILL.md`, a doctrine copy from `task_01`, and an `agents/openai.yaml` sibling matching core batch’s display wrapper (F-01, F-02).
2. MUST execute a requested range only through `sf-tdd-execute` and `sf-tdd-report`, never `sf-execute-task` or `sf-task-report` (F-01, US-05).
3. MUST stop when a task fails, blocks, lacks a substantive completed report, or misses `status: completed` (US-05, F-01 SHOULD).
4. MUST mirror core batch range grammar, unmet-dependency stop, skip-completed unless `force`, and `spec-finder checkpoint begin/complete` when `auto_commit: true` (ADR-003, TechSpec External Interfaces).
</requirements>

## Requirement Traceability

| Source ID/section | Task obligation | Evidence |
|---|---|---|
| F-01, US-05 | TDD-only range runner, stop on failure | Batch HARD-GATE |
| ADR-003 | Checkpoint parity with core batch | begin/complete clauses |
| G-02 | Core `sf-batch-tasks` unchanged | No edits to that skill |
| TechSpec sequencing step 5 | Batch after execute and report | Depends on `task_02` and `task_03` |

## Subtasks

- [x] 04.1 Batch skill tree exists with doctrine copy and Codex display wrapper.
- [x] 04.2 Range parsing and dependency gating match core batch forms (`all`, single id, inclusive ranges, `force`).
- [x] 04.3 Each selected task runs only through TDD execute and TDD report.
- [x] 04.4 Failed, blocked, or incomplete evidence stops the range before later tasks.
- [x] 04.5 `auto_commit: true` uses the existing checkpoint CLI; `bun run verify` stays green.

## Implementation Details

Clone the workflow of `skills/sf-batch-tasks/SKILL.md` and swap invoke targets. Do not duplicate Git checkpoint logic in the skill; call the CLI bridge. Do not edit `sf-batch-tasks`. Invocation docs should match the TechSpec `/sf-tdd-batch <slug> <range> [force]` form.

### Relevant Files

- `skills/sf-tdd-batch/SKILL.md` — create; range runner HARD-GATE
- `skills/sf-tdd-batch/references/tdd-doctrine.md` — create; copy of plan doctrine
- `skills/sf-tdd-batch/agents/openai.yaml` — create; mirror core batch wrapper

### Dependent Files

- `skills/sf-batch-tasks/SKILL.md` — source contract to clone, not modify
- `skills/sf-batch-tasks/agents/openai.yaml` — display-wrapper pattern
- `skills/sf-tdd-execute/SKILL.md` — only allowed executor
- `skills/sf-tdd-report/SKILL.md` — only allowed report skill

### Related ADRs

- [ADR-001: Parallel Opt-In TDD Skill Pack](adrs/adr-001-parallel-tdd-skill-pack.md) — parallel batch, not a core rewrite
- [ADR-003: Standalone TDD Skill Trees and Install Contract](adrs/adr-003-standalone-tdd-skill-trees.md) — checkpoint parity; no new CLI command

## Deliverables

- `skills/sf-tdd-batch/` ready to invoke after install
- Contract evidence for TDD-only invoke, stop-on-failure, and checkpoint bridge
- Updated `memory/MEMORY.md` and `memory/task_04.md` when warranted
- `reports/task_04.md` final evidence report

## Tests

### Unit Tests

- [ ] Not applicable: Markdown skill only; no TypeScript behavior change.

### Integration Tests

- [ ] Not applicable: setup allowlist is unchanged until `task_05`.

### Platform or Manual Evidence

- [ ] Given the skill text, when a range is executed, then it names `sf-tdd-execute` and `sf-tdd-report` and does not name `sf-execute-task` or `sf-task-report` as invoke targets.
- [ ] Given a task whose status is not `completed` or whose report verdict is not completed, when the batch gate runs, then later tasks are not started.
- [ ] Given `.spec-finder/config.json` `auto_commit: true`, when a task is about to run, then the skill requires `spec-finder checkpoint begin <slug> <task_id>` exit 0 first.
- [ ] Given a completed TDD task and `auto_commit: true`, when the report/status gate passes, then the skill runs `spec-finder checkpoint complete <slug> <task_id>` before the next task.
- [ ] Given `skills/sf-batch-tasks/`, when this task finishes, then those files are unchanged.

### Verification Commands

- `bun run verify`

## Success Criteria

- Every mapped requirement is satisfied with evidence.
- Focused tests and repository gate pass to terminal exit.
- Coverage is not measurable for Markdown-only changes; state that in the report.
- No unrelated file or approved behavior changes.
- Memory is current and the final report records exact evidence and unresolved risks.
