# Task-Report Outcomes Tasks

## Execution Order

The numeric ID is the canonical execution position. Every dependency points to
a lower-numbered task. `task_02` and `task_03` are parallelizable after the
shared event contract, but retain deterministic positions because the engine
lifecycle contract is first in the approved architecture sequence.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Add Phased ACP Event Contracts | backend | medium | pending | [] | Root and shared contract |
| task_02 | Issue Validated Report References | backend | medium | pending | task_01 | Parallelizable after task_01 |
| task_03 | Harden Transcript Metadata Projection | frontend | medium | pending | task_01 | Parallelizable after task_01; critical path |
| task_04 | Project Safe Report Outcomes in Cockpit State | frontend | medium | pending | task_01, task_03 | Critical-path projection |
| task_05 | Render and Verify Report Outcomes | frontend | medium | pending | task_02, task_04 | Leaf and integration acceptance |

## Dependency Graph

```text
task_01 ─┬─→ task_02 ─┐
         └─→ task_03 → task_04 ─┴─→ task_05
```

Root: `task_01`. Leaf: `task_05`. Critical path:
`task_01 → task_03 → task_04 → task_05`. The event/ACP contract is first
because it makes phase attribution explicit. The engine and transcript tasks
then reduce independent lifecycle and disclosure risks in parallel. Store
projection must follow transcript safety, and final terminal rendering waits
for both the engine reference and store state.

## Requirement Coverage

| Requirement group | Tasks |
|---|---|
| G-01, G-02, G-04, F-01, F-04, TechSpec Core Interfaces | task_01 |
| G-01, G-03, US-01, US-02, US-03, F-01, F-02, F-03, M-02, M-03, M-04 | task_02 |
| G-02, US-04, F-04, M-01, TechSpec Security and Privacy | task_03 |
| G-01, G-02, G-03, G-04, US-02, US-03, US-05, F-02, F-03, F-04, TechSpec Failure and Recovery | task_04 |
| G-01, G-02, G-03, US-01, US-02, US-03, F-01, F-02, F-03, F-05, M-01 through M-05 | task_05 |
| No ACP upgrade/config change, no no-UI feature, no persistence/telemetry, no inferred report blocked state | all tasks, enforced by task-local scope |

Every PRD goal, user story, feature, high-level constraint, metric, and
TechSpec implementation step is covered. No implementation requirement is
deferred.

## Execution Constraints

- Preserve user-owned concurrent changes, especially in `src/events.ts`,
  `src/batch.ts`, `src/commands.ts`, `src/ui/store.ts`, `src/ui/App.tsx`, and
  their tests. Merge this packet's additive behavior with existing batch work.
- Each task includes implementation and focused tests. No task may change task
  lifecycle status or write its report; Spec Finder owns those phases.
- Every task binds to the exact packet-local source artifacts, reads its shared
  and task memory, and requires `reports/task_NN.md` as its completion
  invariant.
