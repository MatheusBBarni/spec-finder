# Workflow Memory

## Current State

- The approved packet contains three canonical tasks in order: task_01's
  engine/event contract is completed, task_02 owns cockpit projection and
  lifecycle, and task_03 owns single-run command integration.

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
- The engine now returns and mirrors `outcome: "no_work"` with
  `reason: "all_tasks_complete"` on `run_finished` only after a non-aborted
  empty `executionOrder`; taskless and invalid packets still fail before
  terminal events.
- Singular `CockpitStore.finished` now preserves optional `outcome` and
  `reason` fields from typed `run_finished` events, while the existing batch
  guard ignores nested singular terminal events.
- The real cockpit session exposes idempotent `waitForExit`/close behavior and
  App signals the exit wait before its existing Q/Ctrl+C cancel path; legacy
  injected command sessions may omit `waitForExit` for compatibility.
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
