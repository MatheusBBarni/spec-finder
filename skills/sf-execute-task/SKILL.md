---
name: sf-execute-task
description: Executes one approved Spec Finder task with strict scope, fresh verification, and lifecycle discipline. Use when implementing a task_NN.md file.
argument-hint: "[path to task_NN.md]"
---

# Execute a Spec Finder Task

1. Read the task, `_prd.md`, `_techspec.md`, `_tasks.md`, relevant ADRs, repository instructions, and current git state before editing.
2. Verify every declared dependency is completed and its required artifacts exist. Stop with a concrete blocker if not.
3. Map task requirements to existing code and tests. Keep unrelated dirty state untouched.
4. Implement the smallest complete change satisfying the task. Do not absorb follow-up scope.
5. Run the task's focused tests, then the relevant repository verification gate. Poll long-running commands to terminal exit; partial output is not evidence.
6. Do not mark frontmatter complete yourself when Spec Finder invoked you. The runtime owns lifecycle state.
7. Hand off to `sf-task-report`; completion requires the final report file.

## Failure rules

- Never weaken tests or configuration to hide a failure.
- Distinguish implementation failure, environment failure, and missing platform evidence.
- Record follow-ups instead of silently expanding scope.

