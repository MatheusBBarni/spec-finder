# npm Release Automation Tasks

## Source Artifacts

- PRD: `.spec-finder/tasks/npm-release-automation/_prd.md`
- TechSpec: `.spec-finder/tasks/npm-release-automation/_techspec.md`

## Execution Order

| ID | Status | Title | Type | Complexity | Dependencies | Outcome |
|---|---|---|---|---|---|---|
| `task_01` | pending | Define deterministic release-contract helpers | infra | medium | — | Pure, testable validation, state, note, and summary contracts. |
| `task_02` | pending | Add no-publish release validation | infra | medium | `task_01` | A local release check validates packed contents without remote mutation. |
| `task_03` | pending | Establish secure release-workflow preflight | infra | high | `task_02` | A pinned, least-privilege manual workflow safely gates releases. |
| `task_04` | pending | Orchestrate publication and reconciliation | infra | high | `task_03` | The workflow safely publishes or reconciles one matching public identity. |
| `task_05` | pending | Prove releases with platform smoke and summary | infra | high | `task_04` | Ubuntu/Windows proof and truthful complete/blocked/partial summary. |
| `task_06` | pending | Document release and recovery operations | docs | low | `task_05` | Maintainers receive final, implementation-aligned operating guidance. |

The approved graph is intentionally serial: tasks 03–05 evolve the same workflow, and task 06 documents the final verified workflow rather than an intermediate design. Every task requires its matching `reports/task_NN.md` evidence report before completion.

## Requirement Coverage

| Source requirement | Planned coverage | Rationale |
|---|---|---|
| G-01, F-02, F-03, US-02 | `task_01`, `task_02`, `task_04`, `task_05` | Pure gates, actual packed candidate check, matching public identity, and smoke proof establish a trustworthy distribution contract. |
| G-02, F-01, US-01 | `task_03`, `task_06` | The workflow enforces deliberate `main`-only dispatch; the final runbook makes it discoverable. |
| G-03, F-04, US-03, US-06 | `task_01`, `task_04`, `task_05`, `task_06` | Formatter, partial-state orchestration, final summary, and operating guidance make outcomes legible. |
| G-04, F-05, US-04 | `task_01`, `task_04`, `task_06` | Footer contract, Release metadata, and documentation provide consistent installer guidance. |
| G-05, F-06, US-05 | `task_01`, `task_02`, `task_05` | Deterministic no-publish validation and real cross-platform smoke provide the V1 proof boundary. |
| F-07 | `task_01`, `task_04`, `task_06` | State classification, no-republish reconciliation, and corrective recovery are explicit. |
| M-01, M-03, M-05 | `task_05` | Final summary and Ubuntu/Windows evidence provide per-release contract and launch proof. |
| M-02, M-03 | `task_01`, `task_02` | Unit fixtures and local packed-content validation measure candidate-gate and integrity correctness. |
| M-04 | `task_04`, `task_06` | Public footer and final runbook make guidance reviewable. |
| Stable-only, no telemetry, no CLI/config changes | `task_01`–`task_06` | Every task preserves the approved product and architecture boundary. |
| TechSpec helpers, workflow, smoke, runbook, rollback, observability | `task_01`–`task_06` | Tasks follow the approved component and development-sequencing order. |

## Dependency Graph

```text
task_01 -> task_02 -> task_03 -> task_04 -> task_05 -> task_06
```

### Sequencing Constraints

- `task_01` supplies the pure contract consumed by all later release automation.
- `task_02` gives the workflow a deterministic local gate before any remote-operation work is introduced.
- `task_03` through `task_05` are deliberately serial to prevent concurrent edits to `.github/workflows/release.yml` and to preserve state-machine ordering.
- `task_06` is last by approval: its runbook must describe the implemented smoke evidence and final summary states.

## External Readiness Gate

After all implementation tasks pass their local gates, the maintainer—not an execution task—must configure npm trusted publishing for the exact repository and `.github/workflows/release.yml` filename, confirm package-name authority and GitHub permissions, and perform the first real stable release. Local planning and tests cannot prove OIDC, npm ownership, GitHub Release API behavior, or native Windows runner execution.
