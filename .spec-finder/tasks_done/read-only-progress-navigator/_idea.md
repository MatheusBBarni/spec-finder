# Read-Only Progress Navigator with Ephemeral Task Timers

## Overview

Improve the Spec Finder cockpit so operators can understand run progress and inspect task-specific ACP output without leaving the TUI. This approved update adds a compact elapsed timer to each task row. The timer is a neutral liveness cue: it starts when the cockpit observes a task entering `in_progress`, updates while that task runs, and remains visible as the final duration after completion or failure.

The primary user is an operator monitoring a run. The value is faster orientation and better awareness that an active task may be taking longer than expected, without claiming that a long ACP turn is necessarily stalled. This is a focused V1 enhancement to the existing read-only progress navigator, not a task-control surface, watchdog, or analytics dashboard.

## Problem

The read-only cockpit now makes task selection, status, and ACP output available in one view, but the active task is represented only by status and a spinner. An operator who suspects that a task may be stalled has to infer elapsed time from transcript activity or an external clock. That workaround is slow, inconsistent, and especially weak when ACP output is quiet for a legitimate reason.

The task timer should answer one narrow question at a glance: “How long has this observed task been executing?” It should not answer whether the task is objectively stalled, estimate remaining work, compare runs, or expose cost. Pending and blocked rows should remain visually quiet, while completed and failed rows should retain their final observed duration for the rest of the run.

### Evidence

| Kind | Finding | Source | Date | Confidence |
|---|---|---|---|---|
| Repository | The cockpit already renders task rows, active-state emphasis, ACP transcript output, and a live spinner, but no per-task elapsed value. | [`src/ui/App.tsx`](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx) | 2026-08-04 | High |
| Repository | The UI store is the cockpit's in-process task/transcript projection and currently has no timing state. | [`src/ui/store.ts`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts) | 2026-08-04 | High |
| Repository | `task_status` identifies a task and status but carries no timestamp, so a timer needs a local observed baseline rather than an event-schema change. | [`src/events.ts`](/Users/matheusbbarni/projects/spec-finder/src/events.ts) | 2026-08-04 | High |
| Repository | The engine emits `in_progress` immediately before the ACP turn and a terminal status after task completion or failure, giving clear start and freeze boundaries. | [`src/engine.ts`](/Users/matheusbbarni/projects/spec-finder/src/engine.ts) | 2026-08-04 | High |
| Repository | The previously approved packet explicitly excluded duration dashboards; this proposal is limited to a compact in-session row signal. | [`_idea.md`](/Users/matheusbbarni/projects/spec-finder/.spec-finder/tasks/read-only-progress-navigator/_idea.md) (prior approved scope) | 2026-08-04 | High |
| External | GitHub CLI's run-watch interaction keeps an operator on a live run view, and its run-view JSON exposes start/update metadata as a precedent for elapsed-progress context. | [GitHub CLI `gh run watch`](https://cli.github.com/manual/gh_run_watch), [GitHub CLI `gh run view`](https://cli.github.com/manual/gh_run_view) | 2026-08-04 | Medium |
| External | OpenTUI documents `requestLive()`/`dropLive()` for animation-driven rendering, matching the cockpit's existing spinner lifecycle and making a live timer technically feasible. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | 2026-08-04 | High |
| External | Persistent panels, explicit navigation, and compact spinners are established TUI interaction patterns in tools such as Lazygit. | [Lazygit guide](https://lazygit.dev/docs/guide/), [Lazygit configuration](https://github.com/jesseduffield/lazygit/blob/master/docs/Config.md) | 2026-08-04 | Medium |
| Inference | An ephemeral, monotonic, store-local projection is the smallest way to provide stall awareness without changing execution semantics or creating durable timing data. | Council synthesis and ADR-004 | 2026-08-04 | Medium |
| User decision | The user selected elapsed execution time, retained final values, `—` for pending/blocked, `MM:SS` formatting, and stall awareness as the primary outcome, then selected the ephemeral timer direction. | Idea-factory clarification and opportunity decision | 2026-08-04 | High |

## Target Users

| Persona | Context | Need | Current workaround |
|---|---|---|---|
| New operator | Watching a first or unfamiliar Spec Finder run | Notice whether the active task is still executing and how long it has been active | Read the spinner and transcript, or use an external clock |
| Experienced operator | Monitoring several sequential tasks and switching between ACP outputs | Quickly distinguish a newly started task from one that has been running for a long time | Infer duration from transcript timestamps/activity cadence |
| Reviewer | Inspecting a completed or failed run in the same cockpit session | See the final observed task duration without changing views | Mentally track start time or consult external logs |

## Core Features

| ID | Priority | Feature | Observable user value | Evidence |
|---|---|---|---|---|
| F-01 | Critical | Run summary with overall state and active-task emphasis | Answers “what is happening?” at a glance | Existing navigator scope; [`src/ui/App.tsx`](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx) |
| F-02 | Critical | Persistent task navigator with status indicators | Makes task order and progress easy to scan | Existing navigator scope; [`src/ui/store.ts`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts) |
| F-03 | Critical | Select any task to view its ACP output | Lets an operator inspect current or completed work | Existing navigator scope; ADR-001/ADR-003 |
| F-04 | Critical | Scroll selected-task output | Supports reviewing long agent/tool activity | Existing navigator scope; OpenTUI scrolling primitives |
| F-05 | Critical | Read-only interaction model | Prevents accidental workflow or permission actions | ADR-001 |
| F-06 | High | Contextual footer and `?` help surface | Teaches essential navigation without external docs | Existing navigator scope; TUI precedents |
| F-07 | High | Responsive semantic visual hierarchy | Keeps the view usable across terminal sizes and color capabilities | Existing navigator scope; layout tests |
| F-08 | Critical | Per-task elapsed timer in `MM:SS` | Lets the operator notice a possibly long-running active task immediately | User decision; ADR-004 |
| F-09 | High | Frozen terminal duration and honest unavailable state | Preserves useful final context without inventing late-attachment timing | User decision; ADR-004 |

Timer behavior is intentionally explicit:

- Pending and blocked rows show `—`.
- A running task observed from its first `in_progress` event shows a live `MM:SS` value.
- Completed and failed tasks retain their first terminal transition's final `MM:SS` value.
- An active or terminal task without a trustworthy local baseline shows `unavailable`.
- Minutes represent total elapsed minutes; the format does not roll over at one hour.
- The value lives only in the current in-process cockpit projection. It is not written to task files, reports, transcripts, logs, telemetry, clipboard/export surfaces, or persisted state.

## KPIs

| ID | KPI | Baseline | Target | Measurement method | Window |
|---|---|---|---|---|---|
| KPI-01 | Evaluators identify the active task's elapsed duration and flag a deliberately long-running task | Unknown | At least 4 of 5 evaluators within 10 seconds | Controlled TUI evaluation with a seeded long-running task | Before release and first usability review |
| KPI-02 | Timer transition correctness under controlled time | Not measured | 100% of start, tick, terminal-freeze, duplicate, stale, pending, blocked, and unavailable cases | Deterministic clock/store tests | Every verification run |
| KPI-03 | Terminal duration retention | Not measured | 100% of observed completed/failed tasks retain the frozen final duration for the run | Store reducer and frame assertions | Every verification run |
| KPI-04 | Timer/layout readability across terminal sizes | Not measured | No clipped or ambiguous timer at 80x24, 120x40, 200x60, and compact fallback sizes | Renderer frame tests and manual snapshots | Before release |
| KPI-05 | Control-plane isolation | Zero timer controls exist today | 100% of timer interactions remain observational; no workflow mutation, alert, or cancellation is triggered | Regression tests and event audit | Every verification run |

## Feature Assessment

| Criterion | Score | Evidence-backed rationale |
|---|---|---|
| Impact | Strong | Directly addresses the user's stated need to notice whether an active task may be stalled, while retaining the existing progress-navigation value. |
| Reach | Strong | Applies to every task row in every interactive run, including pending, active, completed, failed, and blocked states. |
| Frequency | Must do | Operators monitor task progress throughout each run; elapsed context is useful at the same moment as the existing spinner. |
| Differentiation | Maybe | Task-aware ACP context is specific to Spec Finder, but elapsed labels are a familiar TUI pattern rather than a category-defining differentiator. |
| Defensibility | Maybe | The value comes from the task/ACP projection and honest lifecycle semantics, not from a durable timing data moat. |
| Feasibility | Strong | Existing store status transitions and OpenTUI live rendering provide the required seams; no engine, transport, or task-schema change is needed. |

## Independent Critique

### Consensus

Three independent advisors reviewed the proposal from pragmatic engineering, product, and safety/reliability perspectives. They agreed that a compact live/final `MM:SS` value is useful, that pending/blocked rows should show `—`, and that the feature must avoid alerts, persistence, cost analytics, and workflow mutation. They also agreed that elapsed time is a liveness cue for operator judgment, not proof of a stall.

### Unresolved Tensions

| Tension | Position A | Position B | Decision consequence |
|---|---|---|---|
| Canonical timing boundary | Engineering and product preferred task-store timing so status transitions, late view attachment, and terminal freezing share one projection. | Safety preferred the narrowest local baseline and rejected wall-clock or durable timing as a source of false continuity or leakage. | Use an ephemeral store-local projection: canonical inside the cockpit process, never engine truth or persisted state. |
| Missing baseline display | A simple placeholder keeps rows compact. | A generic placeholder hides the difference between “not applicable” and “not observed.” | Use `—` only for pending/blocked; use `unavailable` for active/terminal rows that lack a trustworthy local baseline. |
| Automatic liveness warnings | A threshold could reduce the operator's need to interpret elapsed time. | Task durations vary and a long ACP turn is not evidence of a stall; thresholds would add policy and false positives. | Keep the timer neutral and defer alerts, thresholds, and watchdog behavior to a separate evidence-backed decision. |

### Position Evolution and Dissent

The engineering and product advisors held firm on keeping timing in the task-aware store rather than making it a purely App-local visual counter. The safety advisor held firm that this must remain an in-memory monotonic baseline with no wall-clock persistence or telemetry. The accepted compromise preserves the store projection only for the current process, uses a monotonic source, and shows `unavailable` when the cockpit cannot establish a trustworthy baseline. No advisor supported automatic stall classification for V1.

### Recommended Direction

Adopt the ephemeral per-task timer as a compact extension of the existing read-only navigator. Keep the engine and raw event protocol unchanged; make the store the in-process projection, let the App render it using the existing OpenTUI live lifecycle, and make the absence of a local baseline explicit.

## Opportunity Decision

| Direction | Outcome | Effort | Principal risk | Decision |
|---|---|---|---|---|
| A. Ephemeral task timer projection | Adds live/final `MM:SS` per row with no persistence or workflow controls | Small | Late attachment cannot reconstruct duration | **Selected** |
| B. App-local timer only | Smallest visual implementation and no store timing shape | Smallest | Remounts or view changes can reset or lose the active signal | Rejected |
| C. Liveness supervisor | Adds thresholds, warnings, and possibly recovery behavior | Large | False positives, policy burden, and accidental control-plane expansion | Rejected |

The user selected Direction A after reviewing the evidence and council tensions. The deciding evidence was the existing task-aware store boundary, the existing OpenTUI live-render lifecycle, and the absence of evidence for universal task-duration thresholds. The principal cost accepted is ephemeral timing state plus deterministic clock seams and layout tests.

## Out of Scope (V1)

- **Automatic stalled classification, thresholds, or alerts** — elapsed time is a neutral cue; reconsider only with task-duration evidence and an explicit liveness-policy decision.
- **Notifications, cancellation, retry, or other workflow controls** — the cockpit remains read-only and must not become a second execution control plane.
- **Persisted duration history or analytics** — this feature serves in-session orientation; reconsider only with a privacy/retention decision and a separate analytics scope.
- **Transcript, report, log, telemetry, clipboard, or export timing injection** — the timer is presentation-only and must not broaden sensitive-output surfaces.
- **Estimates, averages, rankings, billing, token, cost, or SLA signals** — the timer must not imply duration predictability or financial meaning.
- **Wall-clock timestamps, configurable formats, or user-defined thresholds** — use one deterministic `MM:SS` presentation in V1 and avoid clock-jump semantics.
- **New ACP transports, task schema fields, raw event fields, or `--no-ui` behavior changes** — the engine and non-UI execution contract remain unchanged.

## Architecture Decision Records

- [ADR-001: Read-Only Progress Cockpit](adrs/adr-001-read-only-progress-cockpit.md) — Establishes the observation-only master-detail V1 boundary.
- [ADR-002: Guided Live Transcript Product Shape](adrs/adr-002-guided-live-transcript.md) — Defines the task/transcript viewing shape.
- [ADR-003: Current-Seam Transcript Projection](adrs/adr-003-current-seam-transcript-projection.md) — Keeps transcript state at the current UI projection seam.
- [ADR-004: Ephemeral Task Duration Signal](adrs/adr-004-ephemeral-task-duration.md) — Adds the in-process, monotonic, non-persistent per-task timer.

## Research Limitations

- No direct market-demand or willingness-to-pay evidence was found for this narrow TUI timer; external sources establish interaction precedent and technical feasibility only.
- The repository has no baseline usability study for identifying long-running tasks, so KPI-01 begins as an explicit unknown.
- A local timer cannot reconstruct a trustworthy duration after late attachment or process restart because the event protocol has no timestamp; this is an intentional degraded state, not an implementation gap to hide.
- The reviewed external documentation is current as of 2026-08-04; behavior should be rechecked during implementation if the OpenTUI version or renderer lifecycle changes.

## Open Questions

- What exact compact-row truncation rule preserves task identity and `MM:SS` at the minimum supported terminal size?
- Should `unavailable` appear as text in every compact layout, or use a documented abbreviated form when width is constrained?
- Which deterministic clock seam and frame-test fixture best fit the repository's existing test helpers?
- Should the help surface explain that `unavailable` means “not observed by this cockpit process,” or is that detail better kept in task detail copy?
