---
name: sf-execute-task
description: Executes one approved Spec Finder task with dependency checks, strict scope, fresh verification, memory updates, and runtime-aware lifecycle discipline. Use when implementing a task_NN.md file manually or through the Spec Finder ACP runtime.
---

# Execute a Spec Finder Task

<HARD-GATE>
Choose exactly one lifecycle owner before editing: the Spec Finder ACP runtime or this manual skill invocation. Never let both paths write status or reports.
</HARD-GATE>

1. Determine whether the caller is the Spec Finder ACP runtime or a manual invocation such as `sf-batch-tasks`.
2. Read the task, `_prd.md`, `_techspec.md`, `_tasks.md`, relevant ADRs, repository instructions, and current git state before editing.
3. Use `sf-memory` to read `memory/MEMORY.md` and the current `memory/task_NN.md`. Keep task memory current and promote only durable cross-task facts.
4. Verify every declared dependency is completed and its required artifacts exist. Stop with a concrete blocker if not.
5. For a manual invocation, set the task to `in_progress` before editing. The runtime performs this transition itself for ACP runs.
6. Map task requirements to existing code and tests. Keep unrelated dirty state untouched.
7. Implement the smallest complete change satisfying the task. Do not absorb follow-up scope.
8. Run the task's focused tests, then the relevant repository verification gate. Poll long-running commands to terminal exit; partial output is not evidence.
9. Update memory before any completion claim or handoff.
10. For an ACP runtime invocation, stop after implementation, verification, and memory updates. Do not write the report or change status; the runtime owns both remaining phases.
11. For a manual invocation, invoke `sf-task-report`, verify the report is substantive, and then set status to its exact verdict: `completed`, `failed`, or `blocked`. Update `_tasks.md` only when it explicitly tracks lifecycle status.

## Failure rules

- Never weaken tests or configuration to hide a failure.
- Distinguish implementation failure, environment failure, and missing platform evidence.
- Record follow-ups instead of silently expanding scope.
