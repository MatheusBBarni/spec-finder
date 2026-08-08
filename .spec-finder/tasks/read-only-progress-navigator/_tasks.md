# Read-Only Progress Navigator Tasks

## Task graph

The original navigator implementation is preserved as completed work. The approved timer extension is additive:

```text
task_01  Define and test task-scoped ACP transcript normalization       [completed]
    │
    ▼
task_02  Add task-scoped cockpit state and view navigation              [completed] ──▶ task_04  Render and verify the read-only progress cockpit [completed]
task_03  Enforce read-only ACP permission handling                      [completed] ──────────────────────────────────────────────────────────┘

task_05  Define and test pure task timer semantics                       [pending]
    │
    ▼
task_06  Integrate task timer projection into CockpitStore               [pending]
    │
    ▼
task_07  Render and verify the integrated task timer                     [pending]
```

The completed foundation tasks are retained without renumbering or deletion. The new timer chain starts from the current completed navigator baseline; its pure helper does not require a pending-task dependency, while store and App work depend on the preceding timer contract.

| Task | Status | Complexity | Dependencies | Outcome |
|---|---|---|---|---|
| `task_01` | completed | medium | none | Pure, task-scoped ACP transcript normalization with chronological coalescing and fixtures. |
| `task_02` | completed | medium | `task_01` | Store-backed per-task history, selection/follow state, focus state, and failure reasons. |
| `task_03` | completed | medium | none | Fail-closed TUI permission behavior while preserving non-TUI policies. |
| `task_04` | completed | high | `task_01`, `task_02`, `task_03` | Final read-only two-column cockpit with navigation, scrolling, responsive evidence, and no permission controls. |
| `task_05` | pending | medium | none | Pure monotonic timer transitions and deterministic `MM:SS`/placeholder formatting. |
| `task_06` | pending | medium | `task_05` | Store-owned per-task timer projection with reset, tick, freeze, and unavailable semantics. |
| `task_07` | pending | medium | `task_06` | Timer-aware task rows, live ticking, neutral help, responsive frames, and lifecycle evidence. |

## Requirement coverage

- Completed tasks 01–04 continue to cover the transcript, task navigation, read-only permission boundary, header, two-column layout, scrolling, focus, and responsive cockpit requirements.
- `task_05` covers `PRD-G-06`, `PRD-US-09`, `PRD-US-10`, `PRD-F-11`, and `PRD-M-07` through the pure timer contract and deterministic edge-case tests.
- `task_06` covers timer lifecycle integration, `PRD-G-07`, `PRD-M-08`, store reset/tick behavior, and the approved raw-event/no-persistence constraints.
- `task_07` covers compact timer readability, neutral interpretation help, read-only regression, renderer cleanup, and `PRD-M-06`, `PRD-M-09`, and `PRD-M-10`.

## Completion contract

The packet is complete only when every task has current shared/task memory, every implementation task has its required focused and repository verification evidence, and `reports/task_NN.md` contains a factual final report for each task. Timer work must not add event fields, engine timing, persistence, telemetry, `--no-ui` output, or workflow controls.
