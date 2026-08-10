# Show an Explicit Empty-Run State

## Overview

- **Problem:** a valid packet with no executable tasks currently appears to flash or fail because the cockpit closes immediately after reporting ordinary success.
- **Primary user:** an individual Spec Finder operator rerunning a packet after its tasks are complete.
- **Value:** a clear, durable explanation that no provider work occurred and why.
- **V1 direction:** quick win—an explicit bounded no-work outcome for valid zero-executable packets, with a specific all-complete explanation when known.

## Problem

When all tasks in a valid packet are already `completed`, `done`, or `finished`, the execution planner produces no work. The engine reports `0 tasks completed`, while command cleanup closes the cockpit immediately. The operator cannot tell whether the UI failed, the packet was empty, or all work was complete. [`src/tasks.ts`](../../../src/tasks.ts) [`src/engine.ts`](../../../src/engine.ts) [`src/commands.ts`](../../../src/commands.ts)

There is no reliable in-product workaround; the operator must infer state from task files or the ambiguous CLI result. *(Inference from issue #1 and current behavior.)*

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | Packets with no task files are invalid; valid all-terminal packets yield zero executable tasks. | `src/tasks.ts:59-68` | 2026-08-08 | High |
| Repository | The engine skips ACP work for an empty execution order but emits `0 tasks completed`. | `src/engine.ts:36-108` | 2026-08-08 | High |
| Repository | The command always closes the cockpit and `--no-ui` prints only the completion text. | `src/commands.ts:195-214` | 2026-08-08 | High |
| External | CLI guidance favors explaining the resulting state to the user. | [CLI Guidelines](https://clig.dev/) | accessed 2026-08-08 | High |
| External | Comparable workflow systems expose and explain skipped work. | [GitHub Actions](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows), [GitLab CI/CD](https://docs.gitlab.com/ci/jobs/) | accessed 2026-08-08 | High |
| Inference | A bounded explicit outcome is safer than coupling UI lifecycle to a status string. | Council synthesis | 2026-08-08 | Medium |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Individual local operator | Reruns a completed task packet interactively | Know immediately that no provider work is needed and why | Infer state from task files or the flash-like run |
| CLI/script consumer | Runs with `--no-ui` | Receive truthful, actionable no-work output | Interpret `ok: 0 tasks completed` |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Detect every valid zero-executable execution plan before provider work | No-work runs are recognized as a first-class outcome | Issue #1; `executionOrder` |
| F-02 | Critical | Show a persistent cockpit no-work state with packet/task counts and a truthful reason | Operator can see that all tasks are already complete and exit deliberately | Issue #1; ADR-001 |
| F-03 | High | Preserve `q`/Ctrl+C as the empty-run exit path | Read-only cockpit behavior remains predictable | Existing cockpit interaction tests |
| F-04 | High | Emit equivalent truthful `--no-ui` output | Terminal users receive the same explanation | Issue #1; CLI Guidelines |
| F-05 | High | Prove no ACP provider session launches for a no-work run | No unnecessary provider cost, delay, or side effects | Engine control flow; ADR-001 |
| F-06 | High | Add focused engine, command, store, and cockpit coverage | Ordinary runs and the new state remain regression-safe | Existing test seams |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| KPI-01 | Valid zero-work detection | No focused coverage | 100% of all-terminal fixtures identify no work | Engine test | Every verification run |
| KPI-02 | Provider avoidance | Unmeasured | 0 ACP launches for zero-work fixtures | Engine spy/fixture | Every verification run |
| KPI-03 | Cockpit clarity and persistence | Flash-like state reported | 100% of frame/input fixtures show reason and remain until `q`/Ctrl+C | OpenTUI tests | Every verification run |
| KPI-04 | `--no-ui` clarity | `ok: 0 tasks completed` | 100% of no-work fixtures emit a truthful reason | Command output test | Every verification run |
| KPI-05 | Normal-run regression safety | Existing behavior | 100% existing normal-run tests remain green | Repository verification | Every verification run |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Must do | Directly removes the ambiguity reported in issue #1. |
| Reach | Maybe | Affects only no-work runs; real frequency is unknown. |
| Frequency | Maybe | Likely after completed-packet reruns, but unmeasured. |
| Differentiation | Maybe | Clear terminal states are expected workflow UX. |
| Defensibility | Pass | This is a focused usability improvement, not a moat. |
| Feasibility | Strong | Current engine, command, event, store, and OpenTUI test seams isolate the change. |

## Independent Critique

### Consensus

Ship the refined no-work outcome: it is operator-first, testable, preserves the read-only model, and avoids provider work.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Explicit signal vs display-string special case | An explicit bounded signal makes lifecycle logic reliable | A text-only special case is smaller initially | Use an additive explicit no-work signal; do not parse text |
| Bounded V1 vs taxonomy | Cover valid current zero-work states | Generalize invalid, cancelled, and filtered outcomes | Keep invalid input as errors and defer taxonomy |
| Contract size | New event hierarchy | Extend existing completion/result contract | Prefer a backward-compatible optional outcome/reason |

### Position Evolution and Dissent

- **Product:** initially supported a named no-work state; partially conceded that taskless packets are invalid, while holding firm on every valid zero-executable plan.
- **Engineering:** initially favored the smallest change; partially conceded that command lifecycle needs an explicit bounded outcome, provided it extends rather than replaces existing completion flow.
- **Devil’s advocate:** initially required a distinct outcome; partially conceded that an additive field is sufficient, while holding firm that UI retention must not rely on `0 tasks completed`.

No advisor supported the generalized diagnostics platform for V1.

### Recommended Direction

The selected direction is a persistent, explicit no-work outcome for valid zero-executable packets, with an all-complete explanation when every loaded task is terminal.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---|---|---|
| Original/refined | Bounded no-work outcome, durable cockpit, truthful CLI output, no ACP session | Small | Small contract extension | **Selected** |
| Essence-first | All-complete text only | Very small | Brittle lifecycle semantics | Rejected |
| Hybrid/adjacent | Reusable diagnostics model for multiple preflight outcomes | Medium | Expands beyond the issue | Rejected |

## Out of Scope (V1)

- **Taskless, invalid, or malformed packets** — remain normal errors; reconsider only with evidence for a broader preflight-diagnostics need.
- **General outcome taxonomy** — cancellation, filtering, and validation diagnostics are not required to solve issue #1.
- **Telemetry, analytics, or usage tracking** — no evidence supports collecting it; correctness is measured by tests.
- **Acknowledgement dialogs, retries, or workflow controls** — preserve the existing read-only cockpit and `q`/Ctrl+C exits.

## Architecture Decision Records

- [ADR-001: Show a persistent, explicit no-work outcome](adrs/adr-001-empty-run-state.md) — selected scope and constraints.

## Research Limitations

- User frequency, adoption, and usability baseline are unknown.
- External research establishes common workflow/CLI expectations, not direct demand for Spec Finder.
- The exact event/result representation remains a TechSpec decision.

## Open Questions

- What exact outcome field shape best fits the existing event and result contracts?
- What concise wording and compact-layout treatment best preserves the cockpit’s visual hierarchy?
