# Ordered Multi-Packet Run

## Overview

- **Problem:** Local operators must invoke Spec Finder repeatedly when several approved packets should run in a known order.
- **Primary user:** Solo developer/operator running related packets during one work session.
- **Value:** One fail-safe command with declared ordering, clear per-packet outcomes, and one truthful aggregate result.
- **V1 direction:** A thin sequential coordinator above the existing packet engine.
- **Ambition:** Focused quick win, not a scheduler or persistence system.

## Problem

Spec Finder currently accepts one task-packet slug per `run` invocation. An operator executing a planned sequence must manually issue multiple commands and monitor each result. This makes ordering and stop behavior depend on operator discipline.

V1 should support:

```bash
spec-finder run --multiple <task_slug_1>,<task_slug_2>,<task_slug_n>
```

Packets execute serially in the declared order. The first failed or cancelled packet stops the sequence; later packets do not start.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | `runCommand` currently extracts one non-flag slug and calls `runTaskPacket` once. | [`src/commands.ts:186`](/Users/matheusbbarni/projects/spec-finder/src/commands.ts:186) | 2026-08-04 | High |
| Repository | `runTaskPacket` already owns packet validation, dependency ordering, implementation/report phases, status updates, and fail-fast behavior within a packet. | [`src/engine.ts:29`](/Users/matheusbbarni/projects/spec-finder/src/engine.ts:29) | 2026-08-04 | High |
| Repository | Slug validation and dependency ordering are packet-local. | [`src/tasks.ts:54`](/Users/matheusbbarni/projects/spec-finder/src/tasks.ts:54) | 2026-08-04 | High |
| Repository | Events and cockpit state currently represent one slug and one task projection. | [`src/events.ts:6`](/Users/matheusbbarni/projects/spec-finder/src/events.ts:6), [`src/ui/store.ts:40`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts:40) | 2026-08-04 | High |
| External | Task supports multiple named tasks and explicit fail-fast and exit-code controls. | [Task CLI reference](https://taskfile.dev/docs/reference/cli) | 2026-08-04 | High |
| External | Task documents that concurrent output can become messy and provides fail-fast dependency behavior. | [Task guide](https://next.taskfile.dev/docs/guide) | 2026-08-04 | Medium |
| External | Nx supports multiple task invocation and explicit sequential execution with `--parallel=1`. | [Nx running tasks](https://nx.dev/docs/getting-started/tutorials/running-tasks) | 2026-08-04 | High |
| External | GitHub Actions distinguishes fail-fast cancellation from continue-on-error. | [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) | 2026-08-04 | High |
| Inference | A coordinator above `runTaskPacket` is the smallest architectural seam that preserves existing packet semantics. | Council synthesis and ADR-001 | 2026-08-04 | Medium |
| User decision | The user selected ordered local execution, fail-fast behavior, quick-win ambition, truthful aggregate status, and Direction A. | Idea-factory clarification and opportunity decision | 2026-08-04 | High |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Solo operator | Running several approved packets in one work session | Execute a known sequence without repeated manual commands | Invoke `spec-finder run <slug>` repeatedly |
| Repository maintainer | Reviewing a sequence that stopped partway through | See which packet succeeded, failed, was cancelled, or never started | Infer state from terminal output and task files |
| Automation maintainer | Running a fixed sequence from a local script | Receive one deterministic aggregate exit result | Chain separate commands and implement custom shell stop logic |

The latter two are secondary and inferred from the existing CLI/reporting contract; no adoption baseline is available.

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Strict `--multiple` comma-list parsing | Declared packet order is unambiguous | User decision; ADR-001 |
| F-02 | Critical | Full preflight of syntax, duplicates, slug validity, packet presence, and packet validity | Invalid sequences fail before earlier packets mutate state | Council safety/product positions; ADR-001 |
| F-03 | Critical | Serial packet coordinator | Packets run exactly in declared order | Existing `runTaskPacket`; Nx sequential precedent |
| F-04 | Critical | Fail-fast sequence boundary | First failure or cancellation prevents later packets from starting | Existing engine fail-fast behavior; GitHub Actions fail-fast precedent |
| F-05 | Critical | Distinct packet outcomes and aggregate result | Operators can distinguish success, failure, cancellation, and not-started packets | User decision; council consensus |
| F-06 | High | Batch lifecycle state with active-packet cockpit detail | Current packet remains inspectable without erasing prior packet outcomes | Existing singular cockpit boundary; ADR-001 |
| F-07 | High | Deterministic `--no-ui` output and aggregate exit status | Scripts and terminal users receive actionable results | Existing console listener and CLI contract |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| KPI-01 | Declared packet order | unknown | 100% of valid sequences start packets in exact input order | Command-level integration tests with ordered fixtures | Every verification run |
| KPI-02 | Fail-fast boundary | unknown | 100% of failure/cancellation cases start zero later packets | Failure and cancellation integration tests | Every verification run |
| KPI-03 | Aggregate result truthfulness | unknown | 100% of all-success sequences exit successfully; failed/cancelled sequences exit non-zero | Result and process-exit assertions | Every verification run |
| KPI-04 | Invalid-sequence preflight | unknown | 100% of malformed, duplicate, or invalid sequences start zero packets | Parser/preflight test matrix | Every verification run |
| KPI-05 | Manual command reduction | unknown | Median one command per planned sequence among first-release evaluators | Short usage diary or scripted workflow comparison | First two weeks after release |
| KPI-06 | Single-run compatibility | Existing single-run tests | 100% of existing single-slug tests remain passing | Full repository verification | Every release candidate |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Strong | Removes repetitive orchestration work while making ordering and stop behavior explicit. |
| Reach | Strong | Applies to every local operator with two or more approved packets; also benefits scripts. |
| Frequency | Strong | The value occurs whenever related packets are executed as a planned sequence. |
| Differentiation | Maybe | The workflow is specific to Spec Finder’s packet/report lifecycle, but multi-task CLI execution is an established pattern. |
| Defensibility | Pass | The capability is straightforward to reproduce and creates no durable data moat. |
| Feasibility | Strong | Existing packet engine and task lifecycle provide the execution seam; new work is coordinator, event/result, parser, and tests. |

## Independent Critique

### Consensus

Three independent advisors agreed that V1 should be a thin sequential coordinator above the unchanged packet engine. They supported explicit order, fail-fast behavior, per-packet outcomes, aggregate status, and distinct cancellation. They rejected retries, parallelism, resume, and cross-packet dependency semantics for V1.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Preflight versus lazy validation | Lazy validation minimizes duplicate loading and preserves the current engine seam. | Full preflight prevents earlier mutation before a later invalid slug is discovered. | V1 accepts the sequence atomically through full preflight. |
| Shared cockpit versus active-packet detail | A full batch projection could expose aggregate progress directly. | The current store is singular and resets on `run_started`; broadening it risks task-ID collisions and UI expansion. | Retain batch outcomes while keeping detailed task/transcript view scoped to the active packet. |
| Cancellation versus failure | Both stop execution and produce non-zero exit status. | They represent different operator truths and should not be conflated. | Preserve separate outcomes while sharing the fail-stop control path. |

### Position Evolution and Dissent

The architecture advisor partially conceded that full packet preflight improves predictability despite extra loading. The product and safety advisors held firm that an explicitly declared sequence should be accepted before execution begins. All advisors held firm that cancellation must remain distinguishable from failure.

### Recommended Direction

Adopt the refined ordered multi-packet coordinator. Keep packet execution unchanged, add a batch result/event envelope, preflight the entire sequence, and preserve one active packet’s detailed cockpit projection.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---|---|---|
| Refined ordered multi-run coordinator | One preflighted, serial, fail-fast command with per-packet and aggregate results | Medium | Event/state compatibility and cancellation mapping | **Selected** |
| Essence-first console wrapper | Minimal console-only sequencing | Small | Divergent interactive and non-interactive behavior | Rejected |
| Ambitious batch orchestration | Manifest, resume, retries, parallelism, durable history | Large | Becomes a scheduler before the core hypothesis is tested | Rejected |

The user selected the refined coordinator. The decisive evidence was the existing single-packet engine seam, the need for truthful fail-fast reporting, and the council’s warning that nested single-run events would erase or collide with prior packet state.

## Out of Scope (V1)

- **Parallel execution** — declared order and clean output are the core hypothesis; revisit only with evidence for concurrency.
- **Retries or automatic recovery** — failure policy is a separate decision.
- **Resume or durable sequence state** — completed earlier packets remain durable, but no batch checkpoint is added.
- **Manifest/config-defined sequences** — the CLI list is sufficient to test the immediate workflow.
- **Cross-packet dependencies** — each packet retains its own dependency graph; no new graph semantics are introduced.
- **Continue-on-error mode** — the selected behavior is fail-fast.
- **Transactional rollback** — earlier successful packet changes are not undone if a later packet fails.
- **Batch analytics, duration history, or telemetry** — this is an execution convenience, not an analytics subsystem.

## Architecture Decision Records

- [ADR-001: Ordered Multi-Packet Run Coordinator](adrs/adr-001-ordered-multiple-task-run.md) — Records the selected coordinator, preflight, fail-fast, outcome, and cockpit boundaries.

## Research Limitations

- No direct market-demand, adoption, or willingness-to-pay evidence was found.
- No baseline exists for how often operators manually chain packet runs.
- Current cancellation behavior can escape the singular `run_finished` path or be recorded as failure depending on timing; implementation must make the batch terminal result explicit.
- Existing events and cockpit state are singular; exact batch projection details remain a TechSpec concern.
- External documentation was accessed on 2026-08-04 and may evolve independently of Spec Finder.

## Open Questions

- Should whitespace around comma-separated slugs be trimmed, or should it be rejected?
- What exact batch event/result shapes preserve compatibility with existing single-run consumers?
- How should active-packet summaries and prior packet outcomes be displayed in the compact cockpit?
- What exact numeric exit code should represent cancellation?
- Should a packet with all tasks already completed count as `succeeded` or receive a distinct informational detail?
