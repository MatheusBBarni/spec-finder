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
- Dependencies reference existing task IDs and form an acyclic graph.
- Completed aliases are `completed`, `done`, and `finished`.

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
