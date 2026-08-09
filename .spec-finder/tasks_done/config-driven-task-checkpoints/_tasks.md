# Config-Driven Per-Task Git Checkpoints Tasks

## Execution order

| ID | Status | Title | Type | Complexity | Dependencies | Parallelizable |
|---|---|---|---|---|---|---|
| task_01 | pending | Add the auto-commit configuration contract | backend | medium | none | root |
| task_02 | pending | Persist checkpoint delivery state in task metadata | backend | medium | task_01 | no |
| task_03 | pending | Build the safe Git checkpoint service | backend | high | task_01, task_02 | no |
| task_04 | pending | Integrate checkpoint delivery into runtime execution | backend | high | task_03 | yes, after task_03 |
| task_05 | pending | Expose checkpoint phases to manual batch execution | backend | medium | task_01, task_02, task_03 | yes, after task_03 |
| task_06 | pending | Render checkpoint outcomes in the cockpit | frontend | medium | task_04 | yes, after task_04 |
| task_07 | pending | Keep blocked deliveries out of task archives | infra | medium | task_02 | yes, after task_02 |

## Dependency graph

```text
task_01 → task_02 → task_03 → task_04 → task_06
                         └────→ task_05
task_02 ───────────────────────→ task_07
```

## Sequencing notes

- `task_01` is the root configuration contract.
- `task_02` establishes durable delivery metadata before any producer or consumer uses it.
- `task_03` is the shared Git safety seam and unlocks both runtime and manual execution.
- `task_04` is on the critical path to the cockpit; `task_05` and `task_07` are independently parallelizable after their dependencies.
- Every dependency points to a strictly lower-numbered task.
- Every task requires a substantive `reports/task_NN.md` before completion.

## Completion contract

Tasks remain `pending` until executed. Each task owns its implementation, focused tests, memory update, and final report. Repository-wide verification remains `bun run verify`.
