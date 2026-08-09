# Keep Task-Run Errors Visible in the ACP Cockpit — Tasks

## Integration Prerequisite

Before any task in this packet begins, the batch event/store, command-routing,
and cockpit work from `.spec-finder/tasks/ordered-multiple-task-run/task_03.md`,
`task_04.md`, and `task_05.md` must be integrated. Their current dirty working
tree state is not completion evidence. This packet consumes those established
contracts and must not overwrite `src/batch.ts` or `src/events.ts`.

## Execution Order

The numeric ID is the canonical execution position. Internal dependencies point
only to lower-numbered tasks; the integration prerequisite above is external to
this packet and is a blocking precondition for all five tasks.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Establish Command-Owned Cockpit Sessions | frontend | high | pending | [] | root; parallelizable with task_02 after the external prerequisite |
| task_02 | Preserve Complete Task Failure Details | frontend | medium | pending | [] | root; parallelizable with task_01 after the external prerequisite |
| task_03 | Enforce Outcome-Aware Command Failure Review | backend | high | pending | task_01 | parallelizable with task_04 after the external prerequisite |
| task_04 | Render Accessible Retained Failure Diagnostics | frontend | medium | pending | task_01, task_02 | parallelizable with task_03 after the external prerequisite |
| task_05 | Add Deterministic macOS PTY Release Evidence | infra | medium | pending | task_03, task_04 | leaf |

## Dependency Graph

```text
external prerequisite: ordered-multiple task_03, task_04, task_05 integrated
                                   │
                  ┌────────────────┴────────────────┐
                  ↓                                 ↓
              task_01                           task_02
                  ├───────────────┐                 │
                  ↓               ↓                 │
              task_03         task_04 ◄─────────────┘
                  └───────────────┴─────────────────┐
                                                    ↓
                                                task_05
```

Roots: `task_01`, `task_02`. Leaf: `task_05`.

Co-critical paths are `task_01 → task_03 → task_05` and
`task_01/task_02 → task_04 → task_05`. Task 01 comes first because its
renderer/session boundary unlocks both command and review work; task 03 precedes
task 04 numerically because terminal-exit safety is the higher-risk integration
seam. The independent root pair and the task 03/task 04 pair may run in
parallel only after their prerequisites are complete and in isolated worktrees.

## Requirement Coverage

| Requirement group | Tasks |
|---|---|
| G-01, G-03, US-01, US-05, F-01, F-04, ADR-003 | task_01, task_03, task_04 |
| G-01, G-02, US-02, F-02, privacy constraint, M-02, ADR-001/003 | task_02, task_04 |
| G-02, US-01, US-02, US-03, F-01, F-02, F-03, M-02, M-04, ADR-001/002 | task_04 |
| G-03, G-04, US-04, US-05, F-04, M-01, M-03, ADR-003 | task_03 |
| G-04, M-01, M-02, M-03, M-04, ADR-002/003 | task_05 |

Every task carries its implementation and focused evidence. Task 05 is release
test infrastructure, not a deferred test-only task: it delivers the platform
gate selected in the approved TechSpec.
