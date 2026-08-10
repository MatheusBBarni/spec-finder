# ADR-005: Integrated Neutral Task Timer Product Scope

## Status

Accepted

## Date

2026-08-04

## Context

The approved read-only progress navigator makes task status and ACP output visible, but the active task has no direct elapsed-time cue. The user wants to notice when an active task may be taking longer than expected without turning the cockpit into a task-control, watchdog, or analytics surface.

The existing PRD already defines the navigator MVP and excludes duration dashboards. The product update must clarify that a compact, in-session task timer is part of that MVP while preserving the broader exclusion of historical performance analytics, alerts, and workflow mutation.

## Decision Drivers

- Give operators a fast, neutral signal for observed task duration.
- Preserve the read-only boundary and existing task/transcript workflow.
- Make the signal available for every task row, not only the active row.
- Keep task identity, status, timer, and transcript context ahead of secondary runtime metadata at narrow widths.
- Explain in help that elapsed time is not an automatic stall verdict.
- Avoid introducing thresholds, notifications, persistence, cost signals, or historical analytics.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The current cockpit already renders task rows and a live spinner but no elapsed timer. | [`src/ui/App.tsx`](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx) | 2026-08-04 |
| Repository | The task-aware UI store is the current view projection and has no timer field. | [`src/ui/store.ts`](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts) | 2026-08-04 |
| Repository | Runtime status events have task IDs but no timestamps. | [`src/events.ts`](/Users/matheusbbarni/projects/spec-finder/src/events.ts) | 2026-08-04 |
| Approved idea | Direction A selected: ephemeral per-task elapsed timer with `MM:SS`, final-value retention, placeholders, and no alerts or persistence. | [`_idea.md`](../_idea.md) | 2026-08-04 |
| User decision | The timer is included in the existing navigator MVP rather than deferred to a later phase. | PRD clarification turn | 2026-08-04 |
| User decision | Narrow layouts preserve task identity, status, timer, and transcript context before secondary runtime metadata. | PRD clarification turn | 2026-08-04 |
| User decision | Help includes a concise explanation that the timer is observed elapsed time, not a stall verdict. | PRD clarification turn | 2026-08-04 |
| Product approach decision | Selected the integrated neutral timer over active-only and liveness-assistant alternatives. | PRD approach-selection turn | 2026-08-04 |

## Decision

The PRD will include an integrated neutral timer in the read-only navigator MVP:

- Every task row shows `—` for pending/blocked, live `MM:SS` for an observed running task, a frozen final `MM:SS` for an observed completed/failed task, or `unavailable` when no trustworthy local baseline exists.
- The timer remains a presentation-only cue. It does not classify tasks as stalled, emit alerts, notify users, cancel work, estimate completion, or expose cost/SLA meaning.
- Compact layouts preserve task identity, status, timer, and selected transcript context before provider/model/reasoning/speed metadata.
- The help surface explains that the timer represents observed elapsed execution time and is not an automatic stall determination.
- The timer remains in-session and ephemeral; historical duration analytics and persistence remain outside the MVP.

## Alternatives Considered

### Active-task-only timer

- **User value:** Smaller visual footprint with a direct signal for the currently running task.
- **Costs/risks:** Removes the consistent all-row context approved for the navigator and makes terminal/pending states less comparable.
- **Why not selected:** The user selected the integrated all-row experience, and the task list is the primary progress surface.

### Liveness assistant

- **User value:** Adds automatic warnings for tasks that exceed a configured threshold.
- **Costs/risks:** Requires policy, threshold, notification, suppression, and false-positive behavior; a long ACP turn is not proof of a stall.
- **Why not selected:** No evidence supports universal thresholds, and warnings would expand the read-only product boundary.

### Deferred timer phase

- **User value:** Keeps the existing navigator MVP unchanged while postponing row-density and copy decisions.
- **Costs/risks:** Leaves the stated stall-awareness problem unsolved and preserves the current spinner-only signal.
- **Why not selected:** The user explicitly included the timer in the existing MVP.

## Consequences

### Positive

- Operators can see observed duration without leaving the task list or opening another tool.
- The timer is consistent across task states and remains available after terminal status.
- Narrow terminals keep the information most relevant to progress visible.
- Help reduces the risk that users interpret elapsed time as an automated stall judgment.

### Negative and trade-offs

- Timer values consume task-row width and may require title truncation or compact layout behavior.
- Users receive no automatic answer to whether a task is stalled; they must interpret the neutral signal.
- Historical comparisons, estimates, and analytics remain unavailable in this MVP.

### Risks and mitigations

- **False stall interpretation** — Use neutral elapsed wording and explain the signal in help; do not add thresholds or warning labels.
- **Information loss on narrow terminals** — Preserve task identity, status, timer, and transcript context before secondary runtime metadata.
- **Scope creep into observability** — Keep alerts, persistence, exports, and analytics as explicit non-goals with separate evidence gates.

## Reversibility

- Remove the timer feature and ADR-linked PRD requirements without changing task execution, ACP transport, packet schema, or persisted data.
- Promote alerts or historical analytics only through a new product decision supported by task-duration and usability evidence.

## Follow-ups

- Validate the task-row timer at 80x24, 120x40, 200x60, reduced-color, and compact fallback sizes.
- Test whether the help wording is understood as a neutral cue during first-use evaluation.
- Revisit liveness warnings only if observed operator behavior demonstrates that a timer alone is insufficient.

## References

- [Read-Only Progress Navigator idea](../_idea.md)
- [Existing Read-Only Progress Navigator PRD](../_prd.md)
- [ADR-004: Ephemeral Task Duration Signal](adr-004-ephemeral-task-duration.md)
- [Spec Finder cockpit UI](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx)
- [Spec Finder cockpit store](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts)
- [OpenTUI renderer documentation](https://opentui.com/docs/core-concepts/renderer/)
