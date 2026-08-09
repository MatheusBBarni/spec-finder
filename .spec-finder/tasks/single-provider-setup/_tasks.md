# Single-Provider Setup Tasks

## Execution order

The numeric ID is the canonical execution position. Every dependency points to a lower-numbered task.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Add Versioned Setup Configuration and Provider Policy | backend | high | pending | [] | root |
| task_02 | Implement Single-Provider Setup and Safe Installation | refactor | high | pending | task_01 | critical path |
| task_03 | Publish the Single-Provider Setup Contract | docs | medium | pending | task_02 | leaf |

## Dependency graph

```text
task_01 → task_02 → task_03
```

Root: `task_01`. Leaf: `task_03`. Critical path: `task_01 → task_02 → task_03`.

There are no parallel groups. The profile/configuration contract must exist before setup resolves intent, and the public help/README must wait for the finalized installer summary and error behavior. This avoids duplicate command-contract work and preserves the active unrelated batch changes in `src/commands.ts`, `src/cli.tsx`, `README.md`, and their tests.

## Requirement coverage

| Requirement group | Tasks |
|---|---|
| G-03, US-02, US-03, F-03, strict-config constraint, no-live-discovery constraint, M-03 | task_01 |
| G-01, G-02, G-04, US-01, US-04, F-01, F-02, F-04, F-05, terminal-usability constraint, provider-derived-path constraint, preservation constraint, M-01, M-02, M-04 | task_02 |
| G-05, US-05, F-06, documentation/automation compatibility, M-05 | task_03 |

Every task carries focused automated evidence, a packet-memory update, and a `reports/task_NN.md` completion invariant. The final task runs the full repository verification gate, while earlier tasks also run it before handoff as required by repository policy.
