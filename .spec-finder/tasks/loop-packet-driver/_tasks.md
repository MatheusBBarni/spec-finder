# Continuous Packet Loop Driver Tasks

## Execution order

The numeric ID is the canonical execution position. Every dependency points to a lower-numbered task.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Implement packet-local loop ledger | backend | medium | pending | [] | root; parallelizable with task_03 |
| task_02 | Implement pure loop detect and classification | backend | medium | pending | task_01 | critical path |
| task_03 | Add optional engine loop feedback prefix | backend | low | pending | [] | root; parallelizable with task_01 and task_02 |
| task_04 | Implement loop coordinator with injected engine | backend | high | pending | task_01, task_02, task_03 | critical path |
| task_05 | Wire loop command, lock, and exit mapping | backend | high | pending | task_04 | critical path |
| task_06 | Publish loop vs run help and README | docs | medium | pending | task_05 | leaf |

## Dependency graph

```text
task_01 ──→ task_02 ──┐
                      ├──→ task_04 ──→ task_05 ──→ task_06
task_03 ──────────────┘
```

Root: task_01, task_03. Leaf: task_06. Critical path: task_01 → task_02 → task_04 → task_05 → task_06.

task_03 is parallelizable with task_01 and task_02 because the optional `RunOptions.loopFeedback` seam does not need the ledger or detect implementation. The coordinator in task_04 is the first consumer of all three.

## Requirement coverage

| Requirement group | Tasks |
|---|---|
| F-04, G-04, US-07, C-01, M-03 ledger | task_01 |
| F-02 detect, F-03, C-04, C-07, US-02, US-03 classification | task_02 |
| F-02 SHOULD feedback, C-06 engine compatibility | task_03 |
| G-01, US-01, US-03, US-05, F-02 execute, F-05, F-06, M-01–M-04 | task_04 |
| F-01, US-04, US-06, C-02, C-03, M-05, M-06 | task_05 |
| G-05, F-07, C-05 docs | task_06 |

PRD non-goals (cockpit meters, portable skill, QA/review, continue-on-error, multi-packet loop, daemon, required config keys, telemetry) have no implementation tasks.
