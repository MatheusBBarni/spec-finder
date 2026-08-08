# Ordered Multi-Packet Run Tasks

## Execution order

The numeric ID is the canonical execution position. Every dependency points to a lower-numbered task.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Define Batch Contracts and Strict Input Parsing | backend | medium | pending | [] | root |
| task_02 | Implement Read-Only Preflight and Serial Coordination | backend | high | pending | task_01 | critical path |
| task_03 | Add Batch Events and Active-Packet Store Projection | backend | high | pending | task_02 | critical path |
| task_04 | Integrate Batch Command Routing and Terminal Results | backend | high | pending | task_02, task_03 | parallelizable with task_05 |
| task_05 | Render the Batch Cockpit Experience | frontend | high | pending | task_03 | parallelizable with task_04 |
| task_06 | Publish the CLI Contract and Release Evidence | docs | medium | pending | task_04, task_05 | leaf |

## Dependency graph

```text
task_01
   ↓
task_02
   ↓
task_03 ─────┬────→ task_04 ───┐
             └────→ task_05 ───┴──→ task_06
```

Root: `task_01`. Leaf: `task_06`. Critical path: `task_01 → task_02 → task_03 → task_04 → task_05 → task_06`.

The command and cockpit integrations are intentionally parallelizable after the store/event contract is stable. Cancellation classification is implemented and tested with the coordinator in `task_02`, avoiding a test-only task and preserving the approved boundary above the unchanged packet engine.

## Requirement coverage

| Requirement group | Tasks |
|---|---|
| G-01, G-04, US-01, US-06, F-01, C-01, M-06 | task_01 |
| G-02, G-03, US-01, US-03, F-02, F-05, C-02, C-03, C-06, M-01, M-02 | task_02 |
| G-02, US-02, F-03, C-03, C-05 | task_03 |
| G-01, G-03, G-04, US-03, US-04, US-05, F-04, F-06, C-01, C-04 | task_04 |
| G-02, G-05, US-02, US-03, F-03, F-04, F-05, M-03 | task_05 |
| G-04, US-04, US-06, F-06, M-04, M-05 | task_06 |

M-04 and M-03 include post-implementation usage evidence; the task plan provides the documented workflow and acceptance procedure without inventing baseline data.
