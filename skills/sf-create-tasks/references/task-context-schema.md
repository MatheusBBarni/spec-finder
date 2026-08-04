# Spec Finder Task Context Schema

## Required frontmatter

- `status`: `pending`, `in_progress`, `completed`, `done`, `finished`, `failed`, or `blocked`.
- `title`: non-empty and exactly equal to the first H1 title after an optional `Task NN:` prefix.
- `type`: non-empty work-type slug; default to `frontend`, `backend`, `docs`, `test`, `infra`, `refactor`, `chore`, or `bugfix` unless repository policy defines another value.
- `complexity`: `low`, `medium`, `high`, or `critical`.
- `dependencies`: YAML list of task IDs such as `task_01`; use `[]` when empty.

## Naming and ordering

- Task filenames match `task_\d+.md`, normally zero-padded: `task_01.md`.
- Meta documents use leading underscores: `_idea.md`, `_prd.md`, `_techspec.md`, `_tasks.md`.
- Numeric task IDs are the canonical recommended execution order, assigned only after the logical dependency graph is complete.
- IDs are contiguous from `task_01` through `task_NN` with no gaps in a newly generated packet.
- Dependencies reference existing task IDs, form an acyclic graph, and always point to a strictly lower numeric ID.
- When multiple tasks are simultaneously runnable, order them by critical-path impact, downstream work unlocked, shared-contract or migration readiness, risk reduction, and stable source-requirement order.
- Parallelizable tasks retain deterministic numeric positions and are labeled as parallelizable in `_tasks.md`; parallelism never creates forward dependencies.
- Completed aliases are `completed`, `done`, and `finished`.

For regeneration, never silently renumber existing tasks. If current IDs violate this ordering contract, require explicit approval for a renumbering migration covering task files, dependencies, memory files, reports, and `_tasks.md` references.

## Required body sections

- Overview
- `<critical>` and `<requirements>` blocks
- Subtasks
- Implementation Details with Relevant Files and Dependent Files
- Related ADRs when applicable
- Deliverables
- Tests
- Success Criteria

Every task also has `memory/task_NN.md` and requires `reports/task_NN.md` before completion.
