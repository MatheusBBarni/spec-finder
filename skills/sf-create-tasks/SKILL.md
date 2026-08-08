---
name: sf-create-tasks
description: Decomposes an approved Spec Finder PRD and TechSpec into an approved, codebase-enriched task plan whose numeric IDs are the canonical execution order, with backward-only dependencies, per-task tests, workflow memory, and validation. Use for executable planning or task regeneration, not product design, architecture selection, or implementation.
---

# Create Spec Finder Tasks

<HARD-GATE>
- NEVER write, replace, renumber, or delete `_tasks.md` or `task_NN.md` before source artifacts, ADRs, repository context, task boundaries, and the complete dependency graph have been reviewed and explicitly approved.
- NEVER invent implementation details to compensate for a missing TechSpec.
- NEVER create a task that depends on undeclared work, contains a cycle, separates tests from implementation, or exceeds the bounded-task limits.
- NEVER assign task IDs before the dependency graph is complete and topologically ordered. Every declared dependency MUST have a lower numeric task ID than its consumer.
- NEVER report completion until every generated file and memory file has been re-read and the packet passes structural validation.
- NEVER overwrite existing workflow memory while regenerating tasks.
</HARD-GATE>

## Interaction contract

- Use the runtime's blocking question mechanism for material task-boundary decisions. Otherwise make the question the complete response and stop.
- Every question must provide at least two suggested answers with sequential uppercase labels: `A.`, `B.`, `C.`, and so on. Put the recommendation first as `A. (Recommended)`, add `Other` with the next available letter whenever the answers are not exhaustive, and never use unlabeled bullets or open-ended answer requests.
- End every choice prompt with: `Reply with the letter (for example, A), or the letter plus context.` Accept lowercase letters and full option text too.
- Present the entire proposed graph in one review, not task-by-task approval.
- Recommend a graph, but wait for explicit approval before filesystem writes.
- If codebase evidence conflicts with the approved TechSpec, present lettered answers for revising the TechSpec, accepting a documented task-level deviation, stopping, or another direction.

Read `references/question-protocol.md` before asking questions or requesting graph approval.

## Required inputs

- `.spec-finder/tasks/<slug>/_prd.md` or `_techspec.md`.
- Both are required for implementation-ready tasks unless the user explicitly accepts higher-level, research-enriched tasks without a TechSpec.

If both files are absent, stop and direct the user to `sf-create-prd` or `sf-create-techspec`.

## Mandatory phase checklist

1. Load configuration, idea, PRD, TechSpec, ADRs, memory, existing tasks, and repository rules.
2. Build requirements and implementation-context ledgers.
3. Explore packet-wide and task-specific code/test surfaces.
4. Propose an independently implementable DAG without final IDs.
5. Topologically order the DAG, assign sequential IDs, and obtain explicit approval of that execution order.
6. Write the task index, task files, and missing memory files.
7. Enrich every task from current codebase evidence.
8. Validate naming, schema, titles, execution order, dependencies, scope, sections, tests, traceability, and memory.

## Workflow

### 1. Load authoritative context

- Read `.spec-finder/config.json`, `_idea.md`, `_prd.md`, `_techspec.md`, every ADR, `memory/MEMORY.md`, existing `_tasks.md`, and all existing `task_NN.md` files.
- Read repository instructions, test conventions, build/verification commands, and relevant platform constraints.
- Read `references/task-context-schema.md` and `references/task-template.md`.
- In regeneration mode, preserve approved task IDs and memory unless the user explicitly approves renumbering or removal. Identify completed tasks before proposing changes. If existing IDs violate execution order, stop and present an explicit renumbering migration; do not silently preserve an invalid order or silently renumber it.

### 2. Handle missing design context

When `_techspec.md` is missing:

- explain that tasks can specify product behavior but cannot safely assert implementation boundaries;
- perform deeper codebase exploration;
- list the exact design gaps that will remain;
- ask with lettered choices whether to stop for `sf-create-techspec`, continue with higher-level tasks, or provide another direction.

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

### 5. Propose and order the DAG

First define each logical task without committing to a numeric ID. For each task present:

- temporary logical key and imperative title;
- 2-3 sentence outcome;
- requirement and TechSpec coverage;
- relevant and dependent files;
- type and evidence-based complexity;
- dependencies and why each is required;
- focused tests and repository gate;
- risks or platform evidence.

After the dependency graph is complete:

1. Topologically sort it so every prerequisite appears before every consumer.
2. Resolve ties between simultaneously runnable tasks using this deterministic priority:
   - tasks on the critical path or unlocking the most downstream work;
   - tasks producing shared contracts, migrations, or integration seams required by later work;
   - tasks delivering earlier verification or reducing the highest implementation risk;
   - stable source-requirement order as the final tie-breaker.
3. Assign `task_01` through `task_NN` only after that order is fixed.
4. Require every dependency of `task_NN` to be a strictly lower-numbered task.

The numeric ID is the canonical recommended execution position. Parallelizable tasks still receive a deterministic numeric order; label them parallelizable, but never assign a later task as a dependency of an earlier task.

Present the final execution table in numeric order, followed by dependency chains, roots, leaves, critical path, parallelizable groups, tie-break rationale, and deliberate sequencing constraints.

Task invariants:

- independently implementable once declared dependencies are complete;
- no cycles or undeclared prerequisites;
- task numbers match the approved topological execution order;
- every dependency points strictly backward to a lower-numbered task;
- tests live with implementation, never in a separate test-only task;
- 3-7 outcome-oriented subtasks;
- no more than seven primary touched files unless the user approves an indivisible critical task;
- no copied interface definitions or architecture prose from the TechSpec.

Wait for explicit approval of the complete graph and numbered execution order using `A. Approve and write tasks`, `B. Revise the graph`, `C. Stop`, and `D. Other`. Revise, re-sort, and re-present when task boundaries or dependencies change.

### 6. Write files

- Write `_tasks.md` in canonical execution order with sequential IDs, status, complexity, dependencies, and concise outcomes. Include an `Execution order` section and label parallelizable groups without changing numeric order.
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
- IDs are contiguous and reflect the approved topological execution order;
- all dependencies exist, have lower numeric IDs than their consumers, and form an acyclic graph;
- `_tasks.md`, task filenames, task H1 numbers, memory filenames, and report paths all use the same execution-order ID;
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
- Numbering tasks by PRD section, UI/backend grouping, or discovery order instead of executable dependency order.
- Assigning IDs before the graph is complete, producing forward dependencies such as `task_02` required by `task_01`.
- File paths guessed without codebase evidence.
- Regeneration that silently renumbers tasks or erases memory.

## Failure rules

- If task boundaries conflict with the TechSpec, stop at the graph decision gate.
- If one task cannot be enriched, continue analyzing the others but do not write a partially approved packet without disclosing the failure.
- If completed tasks constrain regeneration, preserve them and propose additive/replacement work explicitly.
- If validation cannot pass, leave status truthful and report exact failing files and rules.
