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
- Task metadata now validates optional checkpoint records (active/blocked state, 40/64-hex object ID, 64-hex digest, unique safe relative paths, and blocked error) while preserving compatibility for absent metadata.
- `src/tasks.ts` exposes body-preserving checkpoint/status update helpers; task ordering includes only completed tasks with blocked delivery for retry, leaving absent or non-blocked completion skipped.
- `src/checkpoints.ts` is the shared local-only Git seam: it uses argument-array commands, NUL porcelain status with `-uall` for complete untracked paths, explicit candidate staging, cached-diff checks, candidate-only staging restoration, native hooks/signing, and deterministic task messages; `createCheckpointService` accepts an explicit enabled mode and injectable `GitRunner`.
- Candidate-only staging restoration must inspect the cached name-status set first, because untracked candidate pathspecs can make `git restore --staged -- ...` fail before restoring a partially staged tracked path; cached unmerged statuses are ambiguous and block delivery.
- `src/engine.ts` owns checkpoint lifecycle integration: it gates enabled runs with pre/post packet-memory baselines, reloads task metadata after `begin` before mutating `in_progress`, completes only after normal `completed` status, and stops downstream work on blocked delivery.
- Runtime reruns detect `status: completed` plus `checkpoint.state: blocked`, call `retry` without ACP turns, emit the shared `checkpoint` outcome event, and continue dependency order only after delivery succeeds.
- The manual bridge is `spec-finder checkpoint begin|complete <slug> <task_id>`: it validates packet/task IDs, reads only config `auto_commit`, delegates Git work to `src/checkpoints.ts`, rejects legacy `auto-commit=true|false` tokens, and returns nonzero disabled/blocked outcomes with local recovery guidance.
- The cockpit keeps checkpoint delivery separate from lifecycle status: `CockpitStore` projects created/blocked events into task delivery state and packet-qualified outcome records, while `App.tsx` renders local commit references or bounded blocked reasons as text.
- A completed task with blocked delivery remains navigable for recovery; created/blocked delivery text is included in task detail and run summaries without implying review, merge, or push.
- The archive classifier reads optional checkpoint metadata from task frontmatter: completed tasks with `checkpoint.state: blocked` remain `REMAINING` and include the bounded blocker reason, while absent or non-blocked completed metadata remains archive-compatible; classification does not edit task content.

## Open Risks

- Git path quoting, rename/submodule handling, and concurrent baseline drift remain open risks; temporary fixtures cover staged restoration and native hook refusal/retry.
- Manual batch execution now uses the CLI bridge to avoid duplicating Git safety logic; its skill contract calls begin before task execution and complete only after the report/status gate.
- Runtime integration passes the config-owned enabled mode and preserves the service's fresh-task/blocked-retry contract without changing lifecycle status ownership; manual batch execution now shares the same service through the CLI bridge.

## Handoffs

- Execute tasks in numeric order; every task requires focused tests, `bun run verify`, current memory, and a substantive report.
