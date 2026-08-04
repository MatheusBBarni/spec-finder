---
name: sf-batch-tasks
description: Sequentially executes a range or all tasks in one Spec Finder packet through sf-execute-task, with dependency gates, stop-on-failure behavior, optional one-commit-per-task mode, and runtime-aware lifecycle ownership. Use for multi-task manual skill runs; use the Spec Finder CLI when the cockpit should execute every pending task, and use sf-execute-task for one task.
---

# Batch-Execute Spec Finder Tasks

<HARD-GATE>
- NEVER start a task until the packet, requested range, current statuses, dependency graph, execution order, and commit mode are resolved and printed.
- NEVER run a task whose dependency is neither completed nor scheduled and completed earlier in this batch.
- NEVER continue after a task fails verification, lacks a substantive report, or does not reach `status: completed`.
- NEVER commit unless `auto-commit=true`. Never blanket-stage, include pre-existing unrelated changes, or push.
- NEVER let both the Spec Finder runtime and this skill own lifecycle changes for the same run.
</HARD-GATE>

Use `spec-finder run <slug>` instead when the user wants the cockpit/ACP runtime to execute every pending task. This skill is the manual orchestration path for explicit ranges or per-task commits.

## Invocation

```text
/sf-batch-tasks <slug> <range> [auto-commit=true|false] [force]
```

- `<slug>` resolves to `.spec-finder/tasks/<slug>/`.
- `<range>` accepts the forms below.
- `auto-commit` defaults to `false`; the bare token means `true`.
- `force` includes tasks already in a completed terminal state.

Examples:

```text
/sf-batch-tasks progress-cockpit task_01 to task_04
/sf-batch-tasks progress-cockpit all auto-commit=true
/sf-batch-tasks progress-cockpit 03 to 05 force
```

## Workflow

Track this checklist:

```text
Batch progress:
- [ ] 1. Resolve packet and enumerate tasks
- [ ] 2. Parse range and validate dependencies
- [ ] 3. Filter completed tasks and print the plan
- [ ] 4. Execute each task through sf-execute-task
- [ ] 5. Gate report, status, and optional commit
- [ ] 6. Summarize completed, skipped, failed, and remaining tasks
```

### 1. Resolve the packet

- Resolve `.spec-finder/tasks/<slug>/`; never ask for paths derivable from the slug.
- If absent, stop and list available packet slugs.
- Read `_idea.md`, `_prd.md`, `_techspec.md`, `_tasks.md`, all ADRs, shared memory, task files, repository instructions, and current Git state.
- Enumerate `task_*.md` numerically. If none exist, stop and recommend `sf-create-tasks`.

### 2. Parse and order the range

Normalize and deduplicate the requested tasks, retain only existing files, and report missing requests. Order selected tasks topologically by declared dependencies, using numeric task order as the stable tie-breaker.

| Input | Meaning |
|---|---|
| `all` | Every task file in the packet |
| `task_03` or `03` | One task |
| `task_01 to task_10` | Inclusive range |
| `01 to 10` or `task_01-task_10` | Equivalent lenient ranges |

Normalize numbers to the repository's actual zero-padded filename. Do not invent missing tasks.

### 3. Filter and print the plan

- Unless `force` is present, skip `completed`, `done`, and `finished` tasks.
- For every task to run, require each dependency to be terminal-completed or scheduled earlier in this batch. Stop on an unmet dependency; do not merely warn.
- Print tasks to run in order, completed skips, missing requests, dependency blockers, and the effective `auto-commit` mode.
- When `auto-commit=true`, capture the pre-task Git status and `HEAD` before each task.

### 4. Execute sequentially

For each selected task:

1. Invoke `sf-execute-task` with the absolute `task_NN.md` path and state that this is a manual batch invocation, so `sf-execute-task` owns the task's manual report and status transition.
2. Let it complete dependency checks, implementation, focused verification, repository verification, memory updates, and `sf-task-report`.
3. Re-read the task and `reports/task_NN.md`. Continue only when status is exactly `completed`, the report is substantive, and its verdict is completed.
4. Stop immediately on failed, blocked, incomplete, missing, partial, or stale evidence.

### 5. Commit only when requested

When `auto-commit=true`:

- Attribute changed files to the current task using the pre-task snapshot and current diff.
- Include only task-owned implementation files plus its memory, report, task file, and a status-aware `_tasks.md` if changed.
- If a task overlaps a path that was already dirty and its hunks cannot be isolated safely, stop and leave the task uncommitted for user review.
- Stage explicit paths or isolated hunks only. Inspect the staged diff and run `git diff --cached --check` before committing.
- Create exactly one conventional commit for the task. Record its hash and subject.

When `auto-commit=false`, do not stage or commit anything.

### 6. Summarize

Report completed tasks, completed skips, missing requests, the failed or blocked task, and tasks not started. With auto-commit, list each commit hash and subject; otherwise state that accumulated changes remain uncommitted. Never push.

## Rules

- Preserve unrelated dirty state and task scope.
- Treat the per-task frontmatter status and mandatory report as the completion contract.
- Record out-of-scope discoveries as memory or report follow-ups; never absorb them silently.
- Do not create a batch-level commit when per-task commits are enabled.
- If the harness cannot invoke `sf-execute-task`, stop and report the missing capability instead of silently substituting a weaker workflow.
