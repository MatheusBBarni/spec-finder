# ADR-003: Current-Seam Transcript Projection

## Status

Accepted

## Date

2026-08-04

## Context

The approved Read-Only Progress Navigator requires task-specific complete ACP history, readable event presentation, streaming coalescing, selection, active-task following, and transcript scrolling. The current implementation already has a task-scoped `RunEvent` stream, an external `CockpitStore`, and an OpenTUI/React surface, but the store keeps one bounded global activity list and the UI renders a permission decision modal.

The product boundary forbids workflow mutation and permission actions in the cockpit. The implementation must therefore improve the viewing projection without changing task execution order, ACP transport semantics, packet/configuration schemas, or `--no-ui` behavior beyond the explicit fail-closed handling of interactive permission requests.

## Decision Drivers

- PRD requirements for a read-only two-column task/transcript cockpit.
- Existing task IDs on `RunEvent` and the sequential engine in `src/engine.ts`.
- Existing `useSyncExternalStore` boundary in `src/ui/store.ts`.
- OpenTUI 0.4.5 `ScrollBox`, keyboard, resize, and renderer-test capabilities.
- Full in-session history with no cross-run persistence or telemetry.
- User decision: permission prompts in the TUI cancel with a plain-language read-only notice.
- User decisions: pure transcript projection, explicit view state, normalized per-task entries, and two-pane keyboard focus.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | Runtime events already carry task IDs for status, activity, and ACP updates. | `src/events.ts` | 2026-08-04 |
| Repository | The store owns the external snapshot and currently projects a single capped activity list. | `src/ui/store.ts` | 2026-08-04 |
| Repository | The UI already uses a two-column layout and a focused-capable `ScrollBox`. | `src/ui/App.tsx` | 2026-08-04 |
| Official docs | OpenTUI supports keyboard events, focus routing, sticky scrolling, viewport culling, resize handling, and renderer test utilities. | OpenTUI core and React docs | 0.4.5 / 2026-08-04 |
| Official docs | ACP streams message chunks and tool-call updates, and permission requests require a response. | ACP protocol v1/v2 docs | SDK 1.2.1 / 2026-08-04 |
| User decision | Selected current-seam projection (Approach A). | Technical clarification turn | 2026-08-04 |

## Decision

Implement the feature at the existing cockpit seam:

- Keep `RunEvent`, the task engine, ACP transport, packet files, and config schema unchanged.
- Add pure transcript normalization and projection helpers in `src/ui/transcript.ts`.
- Extend `CockpitState` with per-task normalized transcript entries, selected-task state, pane focus, follow mode, help visibility, and task-level plain-language reasons.
- Normalize ACP message chunks by `messageId`, tool updates by `toolCallId`, and preserve the first chronological position of each entry. Preserve unknown event types with a generic readable label.
- Remove the global 250-entry presentation cap for task histories. Retain complete run-scoped histories in memory only; rely on OpenTUI viewport culling for rendering.
- Route keyboard input through explicit two-pane view state. `Tab`/`Shift+Tab` changes pane, arrows/`j`/`k` move tasks, the focused transcript uses ScrollBox line/page/start/end navigation, `?` toggles help, and `q`/`Ctrl+C` remains the terminal escape hatch.
- Keep `activeTaskId` separate from `selectedTaskId`. Selection follows the active task until the user selects another task; manual inspection does not affect execution.
- When `permissions: "prompt"` receives a request during the TUI run, do not render controls. Cancel the request, emit a clear read-only notice, and let the existing engine failure path determine task/run status.

## Alternatives Considered

### Formal cockpit domain reducer

- **Benefits:** Strongest pure-state testing and a clean long-term boundary similar to Kitten.
- **Costs/risks:** Adds adapter, reducer, selectors, and wrapper layers for a single current surface.
- **Why not selected:** The current store already is the external state boundary; the approved scope does not require a second domain package.

### Runtime-normalized `RunEvent` protocol

- **Benefits:** Thin UI and reusable display-ready events for future consumers.
- **Costs/risks:** Changes `src/events.ts`, ACP client behavior, no-UI event semantics, and integration contracts.
- **Why not selected:** The PRD explicitly preserves transport and task-engine semantics, and the feature is UI-specific.

## Consequences

### Positive

- The execution core remains the source of truth and requires no workflow migration.
- ACP output becomes task-specific, chronological, readable, and inspectable.
- Selection and scrolling are deterministic and testable without affecting execution.
- Permission behavior is fail-closed and cannot create a second control plane in the cockpit.
- Rollback is limited to UI/store/projection changes; no persisted data migration is required.

### Negative and trade-offs

- `CockpitStore` becomes a richer UI model and retains all transcript text for the duration of a run.
- Pure projection logic must cover ACP event variants and provider-specific unknowns.
- The UI must manage responsive layout and focus state in addition to rendering.

### Risks and mitigations

- **Memory growth:** keep history run-scoped and test long synthetic streams; defer spill-to-disk or cross-run history to a later requirement.
- **Follow/inspect confusion:** use distinct state fields, visible selection markers, and interaction tests.
- **Cryptic failures:** retain raw detail but derive a concise reason from task failures, blocked dependencies, and permission cancellation.
- **Terminal variance:** pair symbols and labels with semantic colors and test reduced-color frames.

## Reversibility and Rollback

- Revert `src/ui/transcript.ts`, the store/UI changes, and focused tests to restore the current cockpit.
- No packet, config, schema, or persisted transcript migration is introduced.
- The permission fail-closed behavior is isolated to TUI interactive handling and can be reverted independently if the product boundary changes.

## Implementation Notes

- Do not add a new dependency.
- Do not expose permission options, retry, edit, reorder, or status-mutation controls.
- Keep `--no-ui` console projection operational using the existing raw event listener.
- Use stable React keys derived from task/entry identity rather than array position when possible.
- Preserve complete transcript chronology even when a later ACP update mutates an existing normalized entry.
- Add focused tests before changing the full-screen layout so projection behavior is independently verifiable.

## Follow-ups

- Define exact responsive collapse thresholds and secondary-header priority in the TechSpec.
- Define fallback labels for every currently unsupported ACP update type.
- Validate memory behavior with a synthetic long-running transcript before implementation is considered complete.

## References

- [Read-Only Progress Navigator PRD](../_prd.md)
- [ADR-001: Read-Only Progress Cockpit](adr-001-read-only-progress-cockpit.md)
- [ADR-002: Guided Live Transcript Product Shape](adr-002-guided-live-transcript.md)
- [Spec Finder runtime events](/Users/matheusbbarni/projects/spec-finder/src/events.ts)
- [Spec Finder cockpit store](/Users/matheusbbarni/projects/spec-finder/src/ui/store.ts)
- [Spec Finder cockpit UI](/Users/matheusbbarni/projects/spec-finder/src/ui/App.tsx)
- [OpenTUI keyboard documentation](https://opentui.com/docs/core-concepts/keyboard/)
- [OpenTUI ScrollBox documentation](https://opentui.com/docs/components/scrollbox/)
- [Agent Client Protocol lifecycle](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v1/overview.mdx)
