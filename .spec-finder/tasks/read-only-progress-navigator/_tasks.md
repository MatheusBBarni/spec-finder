# Read-Only Progress Navigator Tasks

## Task graph

```text
task_01  Define and test task-scoped ACP transcript normalization  [medium]
    │
    ▼
task_02  Add task-scoped cockpit state and view navigation          [medium]
    │
    └─────────────────────────┐
                              ▼
task_04  Render and verify the read-only progress cockpit          [high]

task_03  Enforce read-only ACP permission handling                 [medium]
    └─────────────────────────┘
```

`task_01` and `task_03` are independent roots. `task_03` may proceed in parallel with `task_01` and `task_02`. The critical path is `task_01 → task_02 → task_04`.

| Task | Status | Complexity | Dependencies | Outcome |
|---|---|---|---|---|
| `task_01` | pending | medium | none | Pure, task-scoped ACP transcript normalization with chronological coalescing and fixtures. |
| `task_02` | pending | medium | `task_01` | Store-backed per-task history, selection/follow state, focus state, and failure reasons. |
| `task_03` | pending | medium | none | Fail-closed TUI permission behavior while preserving non-TUI policies. |
| `task_04` | pending | high | `task_01`, `task_02`, `task_03` | Final read-only two-column cockpit with navigation, scrolling, responsive evidence, and no permission controls. |

## Completion contract

The packet is complete only when every task has current shared/task memory, every implementation task has its required focused and repository verification evidence, and `reports/task_NN.md` contains a factual final report for each task. `PRD-G-06` is the accepted task-generation alias for the PRD’s minimum-terminal goal, mapped to the approved TechSpec responsive requirements.
