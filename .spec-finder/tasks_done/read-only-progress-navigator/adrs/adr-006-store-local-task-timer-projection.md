# ADR-006: Store-Local Task Timer Projection

## Status

Accepted

## Date

2026-08-04

## Context

The approved PRD adds an integrated neutral timer to every task row. The timer must show live `MM:SS` for observed running tasks, retain final duration after observed terminal status, show `—` for pending/blocked tasks, and show `unavailable` when no trustworthy local baseline exists.

The current cockpit already has an external `CockpitStore`, an OpenTUI live-render interval for the spinner, and raw task status events without timestamps. The implementation must add deterministic timing without changing the engine, ACP transport, raw `RunEvent` union, packet schema, or `--no-ui` behavior.

## Decision Drivers

- PRD requirements F-11, US-09, US-10, and M-07/M-08.
- ADR-004's store-canonical, ephemeral timing boundary.
- Existing `CockpitStore` snapshot and `useSyncExternalStore` seam.
- Existing App live-render lifecycle for the spinner.
- OpenTUI 0.4.5 support for live rendering and deterministic `ManualClock` testing.
- Need for a monotonic default clock without coupling the store to OpenTUI.
- No persistence, telemetry, event-schema, engine, or provider changes.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | `CockpitStore` is the current immutable task/transcript view projection. | `src/ui/store.ts` | 2026-08-04 |
| Repository | `App.tsx` already requests live rendering and advances a spinner while a task is running. | `src/ui/App.tsx` | 2026-08-04 |
| Repository | `task_status` has task ID and status but no timestamp. | `src/events.ts` | 2026-08-04 |
| Repository | The engine emits `in_progress` before the ACP turn and terminal status after completion/failure. | `src/engine.ts` | 2026-08-04 |
| Official docs | OpenTUI supports `requestLive()`/`dropLive()` for animation-driven rendering and exposes a renderer clock configuration. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | 0.4.5 / 2026-08-04 |
| Official docs | OpenTUI testing provides `ManualClock`, fixed-size renderers, frame capture, and keyboard input drivers. | [OpenTUI testing](https://opentui.com/docs/core-concepts/testing/) | 0.4.5 / 2026-08-04 |
| User decision | Selected store-owned explicit ticks, a pure timer module, and `performance.now()` as the default monotonic source. | TechSpec clarification turns | 2026-08-04 |

## Decision

Implement timer state as an ephemeral store-local projection with pure transition/formatting helpers:

- Add `src/ui/timer.ts` containing timer state types, transition helpers, formatter, and the minimal injected clock contract.
- Extend `CockpitState` with per-task timer entries owned by `CockpitStore`.
- On the first observed `in_progress`, record a start baseline. Duplicate or stale `in_progress` events do not reset it.
- On the first observed terminal status, record a final elapsed value. Duplicate or stale terminal events do not overwrite it.
- On each explicit `store.tick(nowMs)` while any task is running, publish a new snapshot containing the current elapsed projection.
- The App reuses its existing OpenTUI live lifecycle and one-second interval to call `tick(performance.now())`; the store does not own a background interval.
- `performance.now()` is the production default; tests inject deterministic values or an equivalent fake clock.
- Pending/blocked format as `—`; missing-baseline active/terminal tasks format as `unavailable`; observed values format as total-minute `MM:SS`.
- Timer state is discarded with the store and never enters raw events, transcripts, reports, logs, telemetry, clipboard/export, or persistence.

## Alternatives Considered

### App-derived timer

- **Benefits:** Smaller initial state change and fewer store fields.
- **Costs/risks:** Remounts, late attachment, or App lifecycle changes can reset or lose the signal; transition correctness becomes renderer-dependent.
- **Why not selected:** ADR-004 makes the store the canonical in-process projection, and existing store tests are the stable lifecycle seam.

### Timestamped runtime events

- **Benefits:** Engine-provided timing provenance and possible reuse by other observers.
- **Costs/risks:** Changes `RunEvent`, engine emission, no-UI consumers, fixtures, and compatibility; adds timestamp semantics outside the UI need.
- **Why not selected:** The approved PRD and ADR-004 preserve raw runtime contracts and require an ephemeral cockpit-only signal.

### Store-owned interval

- **Benefits:** Centralizes both state and ticking.
- **Costs/risks:** Couples store lifetime to timers and can keep work alive after the renderer closes; tests must coordinate a background scheduler.
- **Why not selected:** The App already owns the live-render lifecycle and can explicitly tick only while the cockpit is active.

## Consequences

### Positive

- Timer transitions are deterministic, task-aware, and independently unit-testable.
- The App remains the only render scheduler; the store remains the canonical state projection.
- No execution, ACP, CLI, task-packet, or persistence contract changes.
- Tests can control elapsed time without sleeping.

### Negative and trade-offs

- `CockpitState` gains timer state and `CockpitStore` gains a public tick method.
- The App must coordinate one live interval with the existing spinner lifecycle.
- A late-attached or restarted cockpit cannot reconstruct a prior duration and shows `unavailable`.

### Risks and mitigations

- **Tick after renderer close** — stop the App interval in effect cleanup and make `tick` a no-op when no task is running.
- **Clock regression or invalid values** — clamp elapsed time at zero and ignore non-finite tick values.
- **Duplicate/out-of-order events** — preserve first start and first terminal baselines with idempotent transitions.
- **Row-width regression** — reserve timer width before title truncation and verify all PRD terminal sizes.
- **Timing leakage** — keep timer fields outside event, transcript, report, log, telemetry, and persistence surfaces.

## Reversibility and Rollback

- Revert `src/ui/timer.ts`, timer fields/actions/selectors, App tick wiring, and timer tests without migrating data.
- Revert ADR-linked PRD requirements without changing raw events or execution behavior.
- No persisted state or compatibility cleanup is required.

## Implementation Notes

- Keep the timer module independent of OpenTUI and ACP.
- Use total minutes in `MM:SS`; do not roll over at 60 minutes.
- Use stable task IDs as timer keys.
- Do not derive timer state from transcript text or activity cadence.
- Do not add a timer to `RunEvent` or `--no-ui` output.
- Keep `requestLive()` active while either a spinner or timer is changing and drop it during cleanup.

## Follow-ups

- Define exact timer state and helper names in the TechSpec interfaces.
- Add controlled-clock fixtures covering every PRD M-07/M-08 case.
- Verify that one-second App ticks do not interfere with live transcript scrolling or renderer cleanup.

## References

- [Read-Only Progress Navigator PRD](../_prd.md)
- [ADR-004: Ephemeral Task Duration Signal](adr-004-ephemeral-task-duration.md)
- [Spec Finder cockpit store](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts)
- [Spec Finder cockpit UI](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx)
- [OpenTUI renderer documentation](https://opentui.com/docs/core-concepts/renderer/)
- [OpenTUI testing documentation](https://opentui.com/docs/core-concepts/testing/)
