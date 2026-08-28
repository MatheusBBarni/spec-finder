# Pi ACP provider tasks

## Execution order

The numeric ID is the canonical execution position. Every dependency points to a lower-numbered task.

| ID | Title | Type | Complexity | Status | Dependencies | Parallelization |
|---|---|---|---|---|---|---|
| task_01 | Add Pi provider registries and packet launch recipe | backend | high | completed | [] | root |
| task_02 | Apply Pi session-config policy and ACP fixtures | backend | medium | pending | task_01 | parallel with task_03 |
| task_03 | Expose Pi in setup/run UX and auto-on-switch | backend | medium | pending | task_01 | parallel with task_02 |
| task_04 | Document packet-only Pi | docs | low | pending | task_02, task_03 | after both |
| task_05 | Record live Pi packet evidence | test | medium | pending | task_04 | leaf |

## Dependency graph

```text
task_01 → task_02 ─┐
         → task_03 ─┴→ task_04 → task_05
```

Root: `task_01`. Leaf: `task_05`. Critical path: `task_01 → task_02 → task_04 → task_05`.

Parallelizable group: `task_02` and `task_03` after `task_01`. Numeric order still runs ACP fixtures before setup/run UX because ACP is the higher-risk packet path.

Deliberate constraint: `task_01` includes the frozen launch recipe. `PROVIDER_LAUNCHES` and `EXEC_PROVIDER_CERTIFICATION` are exhaustive `Record<ProviderName, …>`, so the enum cannot gain `pi` without a complete packet recipe and exec-false entry.

`tests/cli.test.ts` asserts the same setup usage string in help and README. `task_03` updates that shared grammar line in both files so `bun run verify` stays green. `task_04` still owns the full Pi prerequisites section.

## Requirement coverage

| Requirement group | Tasks |
|---|---|
| F-01 profile, F-04 recipe, F-05 exec false, F-06 destination, US-06, G-04 exec, no-secret launch env, no config pin | task_01 |
| G-01, G-03, F-02, F-03, F-04 session behavior, US-02, US-04 | task_02 |
| G-02, G-05 help, US-01, US-03, US-05, US-07, F-01 picker, F-07 help, auto-on-switch | task_03 |
| G-05 README, F-05 docs, F-07 README, leftover `.pi/skills` docs | task_04 |
| M-01, M-02, M-03 live evidence and README tested pair | task_05 |
| M-04 other providers unchanged | every task via `bun run verify` |

Non-implementation: exec certification, setup model catalogue, native `pi acp`, CI, telemetry, `off`/`minimal` reasoning, svkozak adapter.

Every task carries focused tests, packet memory, and a `reports/task_NN.md` completion invariant.
