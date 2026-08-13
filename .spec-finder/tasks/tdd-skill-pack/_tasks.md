# Parallel TDD Skill Pack Tasks

## Execution order

The numeric ID is the canonical execution position. Every dependency points to a lower-numbered task.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Author TDD doctrine and plan skill | docs | medium | completed | [] | root |
| task_02 | Author TDD execute skill | docs | medium | completed | task_01 | parallelizable with task_03 |
| task_03 | Author TDD report skill | docs | medium | pending | task_01 | parallelizable with task_02 |
| task_04 | Author TDD batch skill | docs | medium | pending | task_02, task_03 | after both invoke targets |
| task_05 | Install TDD pack and document when-to-use | infra | medium | pending | task_01, task_02, task_03, task_04 | leaf |

## Dependency graph

```text
task_01
  ├─ task_02  ┐ parallelizable
  └─ task_03  ┘
        └─ task_04
              └─ task_05
```

- **Root:** `task_01`
- **Leaf:** `task_05`
- **Critical path:** `task_01 → task_02 → task_04 → task_05`
- **Parallelizable group:** `task_02` and `task_03` after `task_01`

`task_02` is numbered before `task_03` because execute is higher-risk and unlocks batch’s primary invoke target. That numbering does not create a dependency between them.

## Requirement coverage

| Requirement group | Tasks |
|---|---|
| F-02, F-03, G-03, US-04, US-07; N/A recording surface for G-04 / US-06 | task_01 |
| G-01, F-04, US-02; lifecycle split for US-08 | task_02 |
| F-05, G-01, G-04, US-02, US-06, M-02, M-03 | task_03 |
| F-01 batch, US-05 | task_04 |
| F-01 install, F-06, G-02, G-05, US-01, US-03, US-08, M-01, M-04, M-05 | task_05 |

Out of implementation scope: ACP `run` opt-in, `sf-tdd-audit`, mandatory dogfood packet, report parser, core skill role changes.

Every task requires focused evidence appropriate to its surface, packet-memory updates, and `reports/task_NN.md` before completion. Skill-authoring tasks use contract/platform review plus `bun run verify` to prove the TypeScript surface stayed green. `task_05` adds focused Bun tests for the allowlist and engine prompt locks.
