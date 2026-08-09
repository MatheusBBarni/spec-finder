# Workflow Memory

## Current State

- The approved packet contains three pending tasks in canonical order:
  engine/event contract, cockpit projection/lifecycle, then single-run command
  integration.

## Shared Decisions

- Valid no-work is the existing planner result `ordered.length === 0` after
  loading and validation; V1's only typed reason is `all_tasks_complete`.
- The terminal outcome is additive on `RunResult` and `run_finished`; it is not
  inferred from output text and does not create a terminal-event hierarchy.
- App retains Q/Ctrl+C ownership. The command awaits a cockpit exit handle only
  for typed interactive no-work and preserves normal automatic cleanup.

## Shared Learnings

- Taskless packets remain loader errors. An all-complete valid packet creates
  packet memory but does not enter ACP/report/task-status work.
- The current worktree contains user-owned batch changes in event, store, App,
  command, and test surfaces. Preserve them and merge no-work changes
  additively; batch `already_complete` presentation is not direct scope.

## Open Risks

- The cockpit exit signal must be idempotent or an interactive no-work command
  could wait indefinitely or destroy twice.
- Result/event and UI/no-UI consumers must use the same typed fact to avoid
  divergent behavior.

## Handoffs

- Complete `task_01` before projecting metadata in `task_02`.
- Complete `task_02` before `task_03` consumes the cockpit exit handle.
