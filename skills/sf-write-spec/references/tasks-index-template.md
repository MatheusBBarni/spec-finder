# [Feature] Tasks

## Execution order

The numeric ID is the canonical execution position.
Every dependency points to a lower-numbered task.

| ID | Title | Type | Complexity | Status | Dependencies | Primary slice | Parallelization |
|---|---|---|---|---|---|---|---|
| task_01 | [Imperative title] | [type] | [low/medium/high/critical] | pending | [] | US-01 / F-01 | [root / critical path / leaf / parallelizable with task_NN] |

## Slices

| Primary story/capability | Tasks |
|---|---|
| US-01 / F-01 | task_01 |

## Dependency graph

```text
task_01
```

Root: task_01.
Leaf: task_01.

Label spikes and blockers here without changing numeric order.

PRD non-goals have no implementation tasks.
