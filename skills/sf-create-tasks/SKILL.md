---
name: sf-create-tasks
description: Decomposes a Spec Finder PRD and TechSpec into validated, dependency-safe task files under .spec-finder/tasks. Use for executable planning, not implementation.
argument-hint: "[feature slug]"
---

# Create Spec Finder Tasks

## Required inputs

At least one of `.spec-finder/tasks/<slug>/_prd.md` or `_techspec.md`; both are strongly preferred.

## Workflow

1. Read the idea, PRD, TechSpec, and every ADR. Read `.spec-finder/config.json` for runtime constraints.
2. Explore the codebase for relevant files, dependent files, test patterns, and repository rules.
3. Produce a dependency DAG of independently implementable tasks. Each task has title, type, complexity, dependencies, bounded scope, and embedded tests. No cycles or undeclared prerequisites.
4. Present the entire task graph with descriptions, complexity, and dependencies. Wait for explicit approval before writing files.
5. Write `_tasks.md` plus sequential `task_01.md` files using `references/task-template.md`.
6. Every task MUST require a final report at `reports/task_NN.md`. The report is written by the `sf-task-report` post-run phase and is required before Spec Finder marks the task complete.
7. Re-read every generated file and validate:
   - filename matches `task_\d+.md`;
   - required frontmatter exists and H1 title matches;
   - dependencies exist and are acyclic;
   - every section in the template exists;
   - test cases name specific inputs or behaviors;
   - tasks touch at most seven files and contain at most seven subtasks.

## Complexity

- `low`: one file, no new interface, straightforward behavior.
- `medium`: 2-4 files or one new bounded interface.
- `high`: 5-7 files, a new subsystem, concurrency, or several integrations.
- `critical`: cross-cutting/high-regression work; split unless indivisible.

## Rules

- Tests belong in each implementation task; do not create test-only tasks.
- Reference TechSpec sections rather than copying designs.
- If the TechSpec is absent, label implementation gaps instead of inventing them.
- Preserve approved task numbering and use dependencies as task IDs such as `task_01`.

