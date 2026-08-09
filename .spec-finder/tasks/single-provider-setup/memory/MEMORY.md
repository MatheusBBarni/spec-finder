# Workflow Memory

## Current State

- Approved task packet contains `task_01` through `task_03`; no implementation task has started.

## Shared Decisions

- Persist setup intent as strict config v3 state; do not infer historic v2 scope.
- Keep static setup policy separate from ACP/runtime capability authority.
- Treat managed-skill installation as a staged, rollback-capable operation and leave legacy Cursor paths untouched.

## Shared Learnings

- Active ordered-batch edits overlap command, help, README, and test files; setup executors must preserve those changes.

## Open Risks

- Static defaults can become stale or unavailable for a provider account; runtime reporting remains the source of truth.
- Global skill roots and workspace config are different filesystem roots, so recovery is ordered/best-effort rather than a single filesystem atomic operation.

## Handoffs

- `task_01` establishes the config/profile and runtime-override contracts consumed by `task_02`.
- `task_03` may start only after `task_02` finalizes actual setup output and errors.
