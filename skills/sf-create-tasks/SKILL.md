---
name: sf-create-tasks
description: Decomposes an approved Spec Finder PRD and TechSpec into an approved, codebase-enriched, dependency-safe task DAG with per-task tests, workflow memory, and validation. Use for executable planning or task regeneration, not product design, architecture selection, or implementation.
---

# Create Spec Finder Tasks

<HARD-GATE>
- NEVER write, replace, renumber, or delete `_tasks.md` or `task_NN.md` before source artifacts, ADRs, repository context, task boundaries, and the complete dependency graph have been reviewed and explicitly approved.
- NEVER invent implementation details to compensate for a missing TechSpec.
- NEVER create a task that depends on undeclared work, contains a cycle, separates tests from implementation, or exceeds the bounded-task limits.
- NEVER report completion until every generated file and memory file has been re-read and the packet passes structural validation.
- NEVER overwrite existing workflow memory while regenerating tasks.
</HARD-GATE>

## Interaction contract

- Use the runtime's blocking question mechanism for material task-boundary decisions. Otherwise make the question the complete response and stop.
- Present the entire proposed graph in one review, not task-by-task approval.
- Recommend a graph, but wait for explicit approval before filesystem writes.
- If codebase evidence conflicts with the approved TechSpec, present the conflict and ask whether to revise the TechSpec or accept a documented task-level deviation.

## Required inputs

- `.spec-finder/tasks/<slug>/_prd.md` or `_techspec.md`.
- Both are required for implementation-ready tasks unless the user explicitly accepts higher-level, research-enriched tasks without a TechSpec.

If both files are absent, stop and direct the user to `sf-create-prd` or `sf-create-techspec`.

## Mandatory phase checklist

1. Load configuration, idea, PRD, TechSpec, ADRs, memory, existing tasks, and repository rules.
2. Build requirements and implementation-context ledgers.
3. Explore packet-wide and task-specific code/test surfaces.
4. Propose an independently implementable DAG and obtain explicit approval.
5. Write the task index, task files, and missing memory files.
6. Enrich every task from current codebase evidence.
7. Validate naming, schema, titles, dependencies, scope, sections, tests, traceability, and memory.

## Workflow

### 1. Load authoritative context

- Read `.spec-finder/config.json`, `_idea.md`, `_prd.md`, `_techspec.md`, every ADR, `memory/MEMORY.md`, existing `_tasks.md`, and all existing `task_NN.md` files.
- Read repository instructions, test conventions, build/verification commands, and relevant platform constraints.
- Read `references/task-context-schema.md` and `references/task-template.md`.
- In regeneration mode, preserve approved task IDs and memory unless the user explicitly approves renumbering or removal. Identify completed tasks before proposing changes.

### 2. Handle missing design context

When `_techspec.md` is missing:

- explain that tasks can specify product behavior but cannot safely assert implementation boundaries;
- perform deeper codebase exploration;
- list the exact design gaps that will remain;
- ask whether to continue with higher-level tasks or stop for `sf-create-techspec`.

Do not bury this choice in a warning and continue automatically.

### 3. Build evidence ledgers

Create two internal mappings before decomposition:

- **Requirement ledger:** every PRD goal, story, feature, constraint, metric, TechSpec component, contract, risk, and build-order step.
- **Repository ledger:** relevant files, callers/consumers, test files, fixtures, conventions, verification commands, and repository rules.

Every requirement must map to at least one proposed task or be explicitly marked non-implementation/out-of-scope with rationale.

### 4. Explore task boundaries

- Explore packet-wide architecture first, then the concrete surfaces for each proposed task.
- Use real parallel exploration for independent surfaces when available; otherwise work sequentially.
- Verify file paths exist or clearly mark them as files to create.
- Trace dependent files and integration consumers, not only direct edit targets.
- Reassess boundaries when exploration reveals hidden coupling.

### 5. Propose the DAG

For each task present:

- ID and imperative title;
- 2-3 sentence outcome;
- requirement and TechSpec coverage;
- relevant and dependent files;
- type and evidence-based complexity;
- dependencies and why each is required;
- focused tests and repository gate;
- risks or platform evidence.

Also present the dependency chains, roots, leaves, critical path, parallelizable groups, and any deliberate sequencing constraint.

Task invariants:

- independently implementable once declared dependencies are complete;
- no cycles or undeclared prerequisites;
- tests live with implementation, never in a separate test-only task;
- 3-7 outcome-oriented subtasks;
- no more than seven primary touched files unless the user approves an indivisible critical task;
- no copied interface definitions or architecture prose from the TechSpec.

Wait for explicit approval of the complete graph. Revise and re-present when requested.

### 6. Write files

- Write `_tasks.md` with sequential IDs, status, complexity, dependencies, and concise outcomes.
- Write `task_01.md` through `task_NN.md` using `references/task-template.md`.
- Use required frontmatter exactly: `status`, `title`, `type`, `complexity`, and `dependencies`.
- Initialize `memory/MEMORY.md` plus `memory/task_NN.md` using `sf-memory`. Create missing files only; never overwrite existing memory.
- Require `reports/task_NN.md` as a completion invariant in every task.

### 7. Enrich every task

Every task must contain:

- `## Overview` with outcome and value;
- the complete `<critical>` block;
- numbered MUST/SHOULD requirements;
- 3-7 bounded `## Subtasks` describing WHAT, not code mechanics;
- `## Implementation Details` with verified relevant/dependent paths and TechSpec references;
- applicable ADR links;
- concrete deliverables including tests, memory, and final report;
- specific unit/integration/platform test cases with named inputs, conditions, and expected behavior;
- measurable success criteria and the exact repository verification gate.

Use the repository's coverage policy. If none exists, target at least 80% coverage for new or changed testable logic and state when coverage is not measurable or applicable.

### 8. Validate before completion

Re-read every generated file and verify:

- filenames match `task_\d+.md` and numbering is consistent;
- YAML frontmatter parses and uses allowed values;
- H1 title exactly matches frontmatter title;
- all dependencies exist, precede their consumers where practical, and form an acyclic graph;
- every source requirement is covered exactly where intended;
- all mandatory sections, tests, gates, memory files, and report paths exist;
- task scope and complexity match discovered files and coupling;
- existing completed tasks and memory were not overwritten.

Fix all validation failures and repeat validation. Report unresolved failures rather than claiming the packet is ready.

## Complexity

- `low`: one primary file, no new interface, straightforward behavior.
- `medium`: 2-4 primary files or one bounded new interface, limited integration.
- `high`: 5-7 primary files, a subsystem/refactor, concurrency, migration, or several integrations.
- `critical`: indivisible cross-cutting/high-regression work; split unless the user explicitly accepts the coordination burden.

## Anti-patterns

- Mega-tasks that hide multiple outcomes.
- “Foundation” tasks with no independently testable value.
- Separate implementation and test tasks.
- Vague tests such as “test errors” or “verify happy path”.
- Dependencies added only to force serial execution.
- File paths guessed without codebase evidence.
- Regeneration that silently renumbers tasks or erases memory.

## Failure rules

- If task boundaries conflict with the TechSpec, stop at the graph decision gate.
- If one task cannot be enriched, continue analyzing the others but do not write a partially approved packet without disclosing the failure.
- If completed tasks constrain regeneration, preserve them and propose additive/replacement work explicitly.
- If validation cannot pass, leave status truthful and report exact failing files and rules.
