# Workflow Memory

## Current State

- Task graph approved for fresh generation: task_01 through task_07.

## Shared Decisions

- `auto_commit` is config-only and defaults to false.
- Checkpointing is local-only, fail-closed, and applies to ACP and manual batch workflows.
- Delivery state is task-owned metadata separate from lifecycle status.

## Shared Learnings

- Existing task status consumers skip completed tasks, so blocked delivery must be represented separately and reintroduced into retry ordering.
- Packet memory initialization occurs before task execution; the Git baseline must account for that known bootstrap boundary.

## Open Risks

- Git path quoting, rename/submodule handling, and staged restoration require temporary-repository evidence.
- Manual batch execution needs the CLI bridge to avoid duplicating Git safety logic.

## Handoffs

- Execute tasks in numeric order; every task requires focused tests, `bun run verify`, current memory, and a substantive report.
