# Keep Task-Run Errors Visible in the ACP Cockpit

## Overview

A quick reliability win for operators watching active ACP task runs. On failure, keep the interactive cockpit visible until dismissal and show the failed task, complete surfaced error, final outcome, and concise recovery hint. Successful runs retain their current exit behavior.

## Problem

Spec Finder emits failure data but closes the interactive cockpit immediately after the run returns. The operator loses the final state before they can inspect it.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | `runCommand` creates the cockpit, sends UI events to its store, and unconditionally closes it in `finally`. | [`src/commands.ts`](../../../src/commands.ts) | 2026-08-08 | High |
| Repository | The engine emits failed status, the surfaced thrown error message, and `run_finished`. | [`src/engine.ts`](../../../src/engine.ts) | 2026-08-08 | High |
| Repository | The final summary already shows failed task IDs and a compact reason, but that reason is first-line and width-truncated. | [`src/ui/store.ts`](../../../src/ui/store.ts), [`src/ui/App.tsx`](../../../src/ui/App.tsx) | 2026-08-08 | High |
| Repository | The existing test suite renders failure summaries but lacks command/PTY evidence that the renderer remains open before destruction. | [`tests/cockpit.test.tsx`](../../../tests/cockpit.test.tsx), [`tests/commands.test.ts`](../../../tests/commands.test.ts) | 2026-08-08 | High |
| External | Failed CI systems retain diagnostic logs for inspection and rerun. | [GitHub Actions](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), [GitLab CI](https://docs.gitlab.com/ci/jobs/job_logs/), [Buildkite](https://buildkite.com/docs/pipelines/configure/managing-log-output) | Accessed 2026-08-08 | Medium |
| External | OpenTUI only restores terminal state when its renderer is destroyed, so a final interactive state can remain before cleanup. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | Accessed 2026-08-08 | High |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| Active-run operator | An ACP task run reaches a failed terminal state | Read what failed, why, and what to try next before leaving the cockpit | Unknown; the issue confirms the final UI disappears too quickly |
| Task author | Receives or investigates a failed run | Preserve the exact surfaced failure for immediate diagnosis | Reproduce or seek another diagnostic surface; not verified |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Failure-only explicit dismissal | Interactive failed runs remain visible until `Esc`, `q`, or Ctrl+C | User decision; ADR-001 |
| F-02 | Critical | Final failure identity and outcome | See failed task ID, final status, and counts at a glance | Existing summary surface |
| F-03 | Critical | Complete surfaced error detail | Read the full `Error.message`, including multiline content, before dismissal | Issue #5; council critique |
| F-04 | High | Concise recovery hint | Know to resolve the listed error and rerun the task packet | User decision |
| F-05 | Critical | Safe terminal-path compatibility | Successful runs, cancellation, `--no-ui`, and non-interactive streams do not wait or hang | ADR-001 |

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| KPI-01 | Failed cockpit remains visible | Unknown | 100% of deterministic interactive failure fixtures | PTY command test | Every verification run |
| KPI-02 | Error fidelity | Unknown | 100% of short and multiline fixture messages readable before dismissal | Renderer/frame assertions | Every verification run |
| KPI-03 | Lifecycle cleanup correctness | Unknown | 100% of success, failure, cancellation, and thrown-error paths close exactly once | Command and PTY tests | Every verification run |
| KPI-04 | Non-UI failure compatibility | Unknown | 100% of failed `--no-ui` fixtures print error/outcome and exit non-zero | Child-process test | Every verification run |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Must do | Directly resolves the verified failure-observability defect. |
| Reach | Strong | Applies to every interactive task run that fails. |
| Frequency | Strong | Failure frequency is unknown, but this serves the critical terminal recovery moment. |
| Differentiation | Maybe | Persistent diagnostics are established expectations, not a unique moat. |
| Defensibility | Pass | No durable data or proprietary workflow is created. |
| Feasibility | Strong | Existing engine events and cockpit summary provide the needed seams without changing providers or event schema. |

## Independent Critique

### Consensus

Independent pragmatic-engineering, product, and reliability advisors all favored a failure-only hold. They agreed it needs one explicit dismissal signal, command-owned idempotent cleanup, complete error visibility, and deterministic PTY evidence.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Exact-error treatment | A concise first-line summary limits visual noise. | The issue requires the full surfaced error before dismissal. | Keep the concise heading and add a wrapped or scrollable complete `Error.message`; exclude stacks and raw ACP payloads. |
| Keyboard lifecycle | Existing `q`/Ctrl+C cancel behavior is familiar. | Post-failure dismissal must not act like a second cancellation or leave the command waiting. | `q`/Ctrl+C cancel only while active; after failed completion, `Esc`, `q`, and Ctrl+C dismiss. |

### Position Evolution and Dissent

Engineering initially preferred relying on the existing transcript for full detail, then conceded that a final screen which truncates the error does not satisfy the acceptance criterion. Reliability held firm on full surfaced-error visibility and required outcome-aware dismissal. Product partially conceded that the lightweight existing summary alone is insufficient.

### Recommended Direction

Adopt the failure-only final diagnostic screen. It is the smallest scope that satisfies the user-selected outcome, preserves successful exits, and avoids persistence or a new control plane.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Assessment (Impact / Reach / Frequency / Differentiation / Defensibility / Feasibility) | Decision |
|---|---|---|---|---|---|
| A. Failure-only final diagnostic screen | Readable failure until explicit dismissal | Small | Lifecycle/cleanup race | Must do / Strong / Strong / Maybe / Pass / Strong | **Selected** |
| B. Delay destruction only | Existing summary and transcript stay open | Smallest | Full error remains inaccessible before dismissal | Strong / Strong / Strong / Pass / Pass / Strong | Rejected |
| C. Durable failure center | Cross-run history, retries, and remediation | Large | Retention, privacy, and control-plane expansion | Strong / Maybe / Maybe / Strong / Maybe / Maybe | Rejected |

## Out of Scope (V1)

- **Persistent successful-run screens** — V1 deliberately preserves successful exit behavior.
- **Retries, auto-remediation, permission actions, or task editing** — the cockpit remains observational apart from dismissal.
- **Durable failure history, telemetry, export, or analytics** — no retention/privacy decision supports them.
- **Stack traces and raw ACP payloads** — show only the surfaced `Error.message`.
- **Fixing provider/model configuration errors** — this improves visibility of all failures, not their root causes.

## Architecture Decision Records

- [ADR-001: Failure-Only Cockpit Diagnostics](adrs/adr-001-failure-only-cockpit-diagnostics.md) — selects the failure-only, explicitly dismissible final state.

## Research Limitations

- No direct adoption, demand, or failure-frequency data was found for this narrow workflow; all KPI baselines are unknown.
- Comparable CI documentation establishes diagnostic expectations, not demand for this exact local TUI behavior.
- No live provider failure or PTY run was performed during discovery; implementation must add that evidence.
- Error text can contain provider or workspace context already surfaced by the run; V1 adds no storage but needs fixture-based review for readable, bounded presentation.

## Open Questions

- Which compact-layout treatment keeps long multiline errors readable without hiding dismissal guidance.
- Whether a generic recovery hint is sufficient for V1 or error-category hints are justified later.
- Which PTY fixture best represents a provider/session failure without requiring a live provider.
