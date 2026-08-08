# ADR-004: Ephemeral Task Duration Signal

## Status

Accepted

## Date

2026-08-04

## Context

The read-only progress cockpit makes the active task visible, but an operator still has to infer whether a task is making progress from the transcript and spinner. The user selected a per-task elapsed execution timer to make possible stalls easier to notice without turning the cockpit into a task-control or performance-analytics surface.

The current `task_status` event carries a task ID and status but no timestamp. The engine emits `in_progress` immediately before the task ACP turn and a terminal status after the implementation/report path. The cockpit already owns an OpenTUI live-render lifecycle for the spinner, but the store has no timing projection.

## Decision Drivers

- Make active-task elapsed time visible without adding workflow controls.
- Start timing at the first observed `in_progress` transition and freeze it at the first terminal transition.
- Keep pending and blocked tasks visually quiet with `—`.
- Use the user-selected `MM:SS` format, with minutes representing total elapsed minutes.
- Treat the value as a neutral liveness cue, not an SLA, estimate, cost, or automatic stall verdict.
- Avoid persistence, telemetry, exports, transcript injection, and raw event-schema changes.
- Remain honest when the cockpit attaches after a task started or restarts without a timing baseline.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | `task_status` contains only `taskId` and `status`; it has no timestamp field. | `src/events.ts` | 2026-08-04 |
| Repository | The engine emits `in_progress` immediately before the ACP turn and terminal status after the task finishes. | `src/engine.ts` | 2026-08-04 |
| Repository | The cockpit already requests and drops OpenTUI live rendering for its spinner. | `src/ui/App.tsx` | 2026-08-04 |
| Official docs | GitHub CLI provides live run watching and exposes `startedAt`/`updatedAt` run metadata. | `https://cli.github.com/manual/gh_run_watch`, `https://cli.github.com/manual/gh_run_view` | 2026-08-04 |
| Official docs | OpenTUI supports `requestLive()`/`dropLive()` for animation-driven continuous rendering. | `https://opentui.com/docs/core-concepts/renderer/` | 2026-08-04 |
| User decision | Selected the ephemeral task timer direction, with elapsed execution timing, retained final values, placeholders, `MM:SS`, and stall awareness as the primary outcome. | Idea-factory clarification turns | 2026-08-04 |
| Inference | A local monotonic baseline is sufficient for in-session display while avoiding false continuity after late attachment or restart. | Council synthesis | 2026-08-04 |

## Decision

V1 will add one compact elapsed-duration value to every task row:

- pending and blocked tasks show `—`;
- an observed running task shows a live `MM:SS` value beginning at its first `in_progress` transition;
- a completed or failed task shows its frozen final `MM:SS` value;
- an active or terminal task without a trustworthy locally observed baseline shows `unavailable` rather than an invented duration;
- timing is kept in memory for the current cockpit/run lifetime and is never written to task files, reports, transcripts, logs, telemetry, clipboard/export surfaces, or persisted state;
- timing uses a monotonic elapsed source and is idempotent across duplicate or stale terminal events;
- the timer does not classify tasks as stalled, emit alerts, trigger notifications, cancel work, or imply an SLA/estimate/cost signal.

The store remains the canonical in-process view projection for timing state; the App renders the live value and reuses the existing OpenTUI live-render lifecycle. The engine, raw `RunEvent` union, ACP transport, task packet, and `--no-ui` behavior remain unchanged.

## Alternatives Considered

### App-local timer only

- **Benefits:** Smallest implementation and no store-shape change.
- **Costs/risks:** A remount or late attachment silently resets or loses the active duration, weakening the stall-awareness signal.
- **Why not selected:** The task-aware store is already the cockpit's snapshot boundary; keeping timing there makes status transitions and terminal freezing deterministic without changing execution semantics.

### Threshold-based liveness supervisor

- **Benefits:** Could flag a task without requiring the operator to interpret elapsed time.
- **Costs/risks:** Requires task-type thresholds, false-positive handling, suppression, notification policy, and recovery semantics; a long ACP turn is not evidence of a stall.
- **Why not selected:** No evidence establishes universal task duration thresholds, and the approved read-only V1 does not define alerts or watchdog behavior.

### Persisted duration history and analytics

- **Benefits:** Enables comparisons, averages, estimates, and run-performance dashboards.
- **Costs/risks:** Adds retention, privacy, migration, telemetry, and product-analytics scope beyond the cockpit's in-session purpose.
- **Why not selected:** The user requested immediate stall awareness, not historical performance analysis.

## Consequences

### Positive

- Operators can see how long the active task has been executing without opening another view.
- Final durations remain available for the current run after completion or failure.
- Timing stays read-only and does not create a second control plane or alter execution.
- A monotonic, in-memory model avoids wall-clock jumps and durable sensitive timing records.

### Negative and trade-offs

- The store gains timing state and clock/test seams in addition to task and transcript state.
- A late-attached or restarted cockpit cannot reconstruct a trustworthy prior duration and must show `unavailable`.
- `MM:SS` increases task-row width and may require responsive truncation at the minimum terminal size.

### Risks and mitigations

- **False stall interpretation:** Use neutral elapsed text only; do not label tasks slow, overdue, or stalled. — Defer thresholds and alerts to a separate product decision.
- **Clock changes:** Use a monotonic source for elapsed calculations. — Never derive task ordering or completion from wall-clock time.
- **Duplicate/out-of-order status events:** Preserve the first start and first terminal baseline. — Add idempotence tests around repeated transitions.
- **Sensitive timing leakage:** Keep timing out of transcripts, reports, logs, telemetry, and persistence. — Audit the changed surfaces and add negative assertions where appropriate.
- **Late attachment:** Distinguish inapplicable `—` from missing `unavailable`. — Document the degraded state in help or task detail copy.

## Reversibility

- Revert the timing fields, formatter, renderer updates, and focused tests without migrating packet files or persisted data.
- No raw event, ACP, task schema, or report-format rollback is required because the decision is an in-process cockpit projection.

## Follow-ups

- Add a deterministic clock seam and tests for start, tick, terminal freeze, duplicate transitions, pending/blocked placeholders, and unavailable late attachment.
- Verify `MM:SS` layout at 80×24, 120×40, 200×60, reduced-color, and compact fallback sizes.
- Revisit thresholds, notifications, persistence, and duration analytics only with new evidence and a separate scope decision.

## References

- [Read-Only Progress Navigator idea](../_idea.md)
- [ADR-001: Read-Only Progress Cockpit](adr-001-read-only-progress-cockpit.md)
- [ADR-002: Guided Live Transcript Product Shape](adr-002-guided-live-transcript.md)
- [ADR-003: Current-Seam Transcript Projection](adr-003-current-seam-transcript-projection.md)
- [Spec Finder runtime events](/Users/matheusbbarni/projects/spec-finder/src/events.ts)
- [Spec Finder task engine](/Users/matheusbbarni/projects/spec-finder/src/engine.ts)
- [Spec Finder cockpit store](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts)
- [OpenTUI renderer documentation](https://opentui.com/docs/core-concepts/renderer/)
- [GitHub CLI run watch](https://cli.github.com/manual/gh_run_watch)
- [GitHub CLI run view](https://cli.github.com/manual/gh_run_view)
