---
status: in_progress
title: Exercise the Spec Finder cockpit
type: chore
complexity: low
dependencies: []
---

# Task 01: Exercise the Spec Finder cockpit

## Overview

<critical>
- Read the PRD, TechSpec, relevant repository instructions, and current Git state before acting.
- This is a read-only implementation exercise: do not modify application source, tests, dependencies, configuration, or documentation.
- Run the focused validation command exactly as specified.
- Do not commit, push, publish, or write the final report during the implementation phase.
- Use `sf-memory`; read both memory files before acting and update task memory before finishing.
- A factual final report at `reports/task_01.md` is mandatory and belongs to the Spec Finder report phase.
</critical>

<requirements>
1. MUST inspect `package.json` and `.spec-finder/config.json` to identify the validation command and effective runtime configuration.
2. MUST run `bun run check` from the repository root and preserve its exact terminal outcome for the report phase.
3. MUST confirm with `git status --short` that no application file was changed by this implementation session.
</requirements>

## Subtasks

- [ ] 01.1 Inspect the package scripts and effective Spec Finder configuration.
- [ ] 01.2 Run `bun run check` and record whether it exits successfully.
- [ ] 01.3 Inspect Git status and summarize the read-only outcome for the report phase.

## Implementation Details

### Relevant Files

- `package.json` — defines the TypeScript validation command.
- `.spec-finder/config.json` — defines the effective ACP provider settings.

### Dependent Files

- `.spec-finder/tasks/tui-demo/task_01.md` — lifecycle status is managed by Spec Finder.
- `.spec-finder/tasks/tui-demo/memory/MEMORY.md` — durable packet-wide context.
- `.spec-finder/tasks/tui-demo/memory/task_01.md` — operational context for this task.
- `.spec-finder/tasks/tui-demo/reports/task_01.md` — mandatory report written in the post-run phase.

### Related ADRs

- None.

## Deliverables

- Read-only inspection summary in ACP activity.
- Successful `bun run check` evidence, or an exact factual failure report.
- Confirmation that no application files were changed by the implementation session.
- Updated workflow memory when the run discovers durable or task-local context.
- `reports/task_01.md` final evidence report.

## Tests

### Unit Tests

- [ ] `bun run check` exits with status 0 and reports no TypeScript errors.

### Integration Tests

- [ ] `git status --short` shows no implementation-created changes outside the task lifecycle and report paths.

## Success Criteria

- The cockpit displays the task and ACP activity while the task runs.
- `bun run check` passes.
- No application source, test, dependency, configuration, or documentation file is modified by the implementation session.
- The final report records exact evidence and unresolved risks.
