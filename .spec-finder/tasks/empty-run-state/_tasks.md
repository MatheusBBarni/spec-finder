# Explicit No-Work Run State Tasks

## Execution Order

The numeric ID is the canonical execution position. Every dependency points to
a lower-numbered task. This packet has no parallelizable implementation group:
the typed outcome unlocks the cockpit projection, and both unlock the command
lifecycle.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Add Typed No-Work Engine Outcome | backend | medium | pending | [] | root and critical-path contract |
| task_02 | Render Persistent No-Work Cockpit State | frontend | high | pending | task_01 | depends on shared contract |
| task_03 | Integrate Single-Run No-Work Command Lifecycle | backend | medium | pending | task_01, task_02 | leaf and critical path |

## Dependency Graph

```text
task_01 → task_02 → task_03
```

Root: `task_01`. Leaf: `task_03`. Critical path: all three tasks. The event
and engine contract is ordered first because it is the fact consumed by both
the cockpit and command. The cockpit lifecycle is next because the command
must await its exit handle only for the typed outcome.

## Requirement Coverage

| Requirement group | Tasks |
|---|---|
| G-01, G-02, US-01, F-01, F-04, C-01, C-05, C-06, M-01, M-02 | task_01 |
| G-01, G-03, US-01, US-02, F-02, F-04, C-03, C-04, M-04 | task_02 |
| G-02, US-03, F-03, F-04, C-02, C-03, M-03 | task_03 |

Every PRD goal, user story, feature, high-level constraint, and metric is
covered. No implementation requirement is deferred. Existing batch behavior is
a compatibility boundary, not a direct task outcome.

## Execution Constraints

- Preserve user-owned changes in `src/events.ts`, `src/ui/store.ts`,
  `src/commands.ts`, `src/ui/App.tsx`, and their tests. Merge the no-work work
  additively with the in-progress batch behavior.
- Each task includes its implementation and tests. No task may change another
  task's status or write its report; Spec Finder owns those lifecycle phases.
- Before each task, read the exact packet-local source artifacts and its shared
  and task-local memory. Every task requires `reports/task_NN.md` as a
  completion invariant.
