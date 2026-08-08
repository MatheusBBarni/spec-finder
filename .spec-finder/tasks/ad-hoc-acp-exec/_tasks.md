# Guarded One-Turn ACP Exec Tasks

## Execution order

The numeric ID is the canonical execution position. Every dependency points to a lower-numbered task.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Freeze Packet ACP Behavior and Define Neutral Turn Contracts | refactor | medium | pending | [] | root |
| task_02 | Implement Canonical Workspace Host Access | backend | high | pending | task_01 | parallelizable with task_04 after task_01 |
| task_03 | Resolve Exec Invocation, Runtime, and Permission Policy | backend | high | pending | task_01, task_02 | critical path |
| task_04 | Implement Bounded Cross-Platform Process Supervision | infra | high | pending | task_01 | parallelizable with task_02–03 |
| task_05 | Extract the ACP v1 Turn Core and Preserve Packet Semantics | refactor | high | pending | task_01, task_02, task_03, task_04 | critical path |
| task_06 | Enforce Safe Exec Output and Success-Only Stdout | backend | medium | pending | task_05 | parallelizable with task_07 |
| task_07 | Add Exec Provider Launch Policy and Certification Gate | backend | medium | pending | task_03 | parallelizable with task_04–06 |
| task_08 | Integrate the Packet-Free Exec Command | backend | high | pending | task_03, task_05, task_06, task_07 | critical path |
| task_09 | Certify and Enable Guarded Exec Capabilities | infra | high | pending | task_08 | release blocker |
| task_10 | Publish Exec Documentation and Release Evidence | docs | medium | pending | task_09 | leaf |

## Dependency graph

```text
task_01 ──┬──→ task_02 ──→ task_03 ──┬──→ task_05 ──→ task_06 ──┐
          │                           │                           │
          └──→ task_04 ───────────────┘                           ├──→ task_08
                                      └──→ task_07 ───────────────┘
                                                                      ↓
                                                                  task_09
                                                                      ↓
                                                                  task_10
```

Root: `task_01`. Leaf: `task_10`.

Critical path: `task_01 → task_02 → task_03 → task_05 → task_06 → task_08 → task_09 → task_10`.

Parallelizable groups:

- `task_02` and `task_04` after `task_01`.
- `task_07` may run after `task_03` while `task_04` through `task_06` progress.
- `task_06` and an unfinished `task_07` may run concurrently after `task_05`.

Tie-break rationale:

- `task_02` precedes `task_04` because workspace contracts unlock both configuration and the ACP core.
- `task_03` precedes `task_04` numerically because it unlocks provider policy and command integration, while process supervision unlocks the core only.
- `task_05` precedes `task_07` because the shared-core refactor unlocks more downstream work and carries higher regression risk.
- `task_06` precedes `task_07` because the confidentiality boundary is on the critical path and follows the TechSpec component order.

## Requirement coverage

| Requirement group | Tasks |
|---|---|
| One-turn command and no packet artifacts | task_03, task_08 |
| Runtime, workspace, and permission precedence | task_02, task_03, task_08 |
| Human stderr and success-only stdout | task_06, task_08 |
| Canonical host access and guarded writes | task_02, task_03, task_08, task_09 |
| Semantic cancellation and bounded cleanup | task_04, task_05, task_08, task_09 |
| Packet compatibility and no-history boundary | task_01, task_05, task_08, task_10 |
| Provider normalization and certification | task_07, task_09, task_10 |
| M-01 and M-02 post-release validation | task_10 handoff; no product persistence |
| M-03 through M-07 release evidence | task_03, task_06, task_09, task_10 |

M-01 and M-02 remain post-release manual measurements outside Spec Finder. The task plan documents their handoff without adding telemetry, trust state, or validation counters.
