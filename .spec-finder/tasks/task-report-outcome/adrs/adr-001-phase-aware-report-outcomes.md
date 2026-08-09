# ADR-001: Phase-Aware Report Outcomes

## Status

Accepted

## Date

2026-08-08

## Context

Issue #6 identifies a completion-view failure in the read-only ACP cockpit: a provider may send the entire final-report instruction, including absolute workspace paths, as `session_info_update` metadata. The current transcript fallback serializes that metadata as JSON immediately before the concise task outcome. This both obscures the useful completion signal and exposes internal operational context.

The product needs compact report-running activity, a trustworthy completed or failed task outcome, a useful report reference when it is safely available, and concise recovery information. The selected scope must preserve readable fallback handling for genuinely unknown ACP variants and must not let provider-controlled metadata or report prose determine task state.

## Decision Drivers

- The primary user is an interactive cockpit operator who needs to identify report completion and recovery steps without parsing ACP protocol metadata.
- The engine owns the separate report turn and validates report existence before it emits task completion.
- `session_info_update` is ACP session metadata, not a Spec Finder task-result contract.
- Raw provider metadata can contain internal prompts and absolute paths.
- Existing transcript/store/UI seams already support task-local activity, errors, and outcomes.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | The engine emits report-start activity, runs a separate report turn, validates the file, then emits `task_status: completed`; failure becomes a failed task and activity reason. | [`src/engine.ts`](../../../../src/engine.ts) | 2026-08-08 |
| Repository | ACP updates are forwarded unchanged and the transcript generic fallback serializes unhandled `session_info_update` fields. | [`src/acp-client.ts`](../../../../src/acp-client.ts), [`src/ui/transcript.ts`](../../../../src/ui/transcript.ts) | 2026-08-08 |
| Repository | Store and App already have task-local activity/error/outcome presentation, while generic unknown updates remain visible. | [`src/ui/store.ts`](../../../../src/ui/store.ts), [`src/ui/App.tsx`](../../../../src/ui/App.tsx) | 2026-08-08 |
| External | ACP defines `session_info_update` as optional metadata such as title, timestamp, and extensions, rather than task outcomes. | [ACP Session Info Update](https://agentclientprotocol.com/rfds/session-info-update) | 2026-08-08 |
| External | Clear, timely status feedback helps users understand outcomes and determine their next action. | [Nielsen Norman Group heuristic](https://media.nngroup.com/media/articles/attachments/Heuristic_1_compressed.pdf) | 2026-08-08 |
| User decision | Select the hybrid narrow V1. | Idea-factory direction decision | 2026-08-08 |

## Decision

Implement a narrow, engine-owned report-lifecycle presentation seam:

- Propagate a minimal report-versus-implementation phase context with task-scoped ACP updates so only report-phase `session_info_update` metadata is suppressed or normalized.
- Present the existing report-start activity as concise lifecycle feedback and use Spec Finder's validated task/report lifecycle—not ACP titles, `_meta`, stop reasons alone, or report prose—as the authority for completed and failed outcomes.
- When a report reference is available, display only a validated, workspace-relative path. Never derive it from ACP metadata or expose an absolute prompt path.
- Preserve the existing readable fallback for genuinely unknown ACP discriminators and use bounded, control-safe display text.
- Treat report-level `blocked` as deferred: the current engine has no such authoritative runtime state, so V1 must not infer it from report text. Existing task dependency blocking remains visible through its established path.

## Alternatives Considered

### Essence-first suppression

- **Benefits:** Smallest visual change; existing task-status outcome remains authoritative.
- **Costs/risks:** Cannot reliably distinguish report metadata from implementation metadata without phase context; offers no safely actionable report reference.
- **Why not selected:** It either leaks the known report prompt or globally hides metadata that may be relevant outside the report phase.

### Full lifecycle metadata framework

- **Benefits:** A reusable typed model for every ACP phase, report outcome, and action reference.
- **Costs/risks:** Widens protocol, store, and UI contracts and adds a lifecycle redesign disproportionate to the issue.
- **Why not selected:** The verified pain is limited to report completion, and the chosen V1 needs only a minimal reliable phase seam.

### Provider metadata or report prose as outcome authority

- **Benefits:** Avoids an engine-owned outcome signal.
- **Costs/risks:** Provider metadata can be malformed, verbose, path-bearing, or misleading; report prose can say `blocked` while the engine currently emits `completed`.
- **Why not selected:** It would make task status untrustworthy and create a disclosure risk.

## Consequences

### Positive

- Operators get concise report activity and a durable task outcome instead of raw final-report instructions.
- The product retains unknown-update diagnostics without treating all ACP metadata as transcript content.
- Completion and failure semantics remain grounded in the engine's validated lifecycle.

### Negative and trade-offs

- A small phase label must cross the engine, ACP adapter, and UI projection seam.
- Safe report references require validation and relative-path handling rather than simply displaying the known absolute path.
- Report-level blocked semantics remain unavailable until the runtime owns them explicitly.

### Risks and mitigations

- **Late or misattributed session updates** — associate them with engine-owned phase/session context and test turn separation.
- **Prompt, path, or control-character leakage** — never render raw report metadata; bound and neutralize fallback display text; test adversarial payloads.
- **False task outcome** — retain engine-owned report-file and stop validation; never parse task state from provider text.
- **Unsafe report reference** — validate containment and render workspace-relative paths only; omit the reference when validation is unavailable.

## Reversibility

The change is limited to ephemeral event/projection and cockpit presentation. It can be rolled back by removing the report-phase context and normalization branch; no persisted data, ACP schema, or report-file migration is introduced.

## Follow-ups

- Define the exact phase-context carrier and relative report-reference validation in the TechSpec.
- Add transcript, engine, and cockpit-frame coverage for report start, success, failure, existing dependency blocking, raw-payload absence, unknown-update fallback, and adversarial text/path cases.
- Revisit explicit report-level `blocked` only if the engine gains a typed authoritative result for it.

## References

- [GitHub issue #6](https://github.com/MatheusBBarni/spec-finder/issues/6)
- [Read-Only Progress Navigator ADR-002](../../read-only-progress-navigator/adrs/adr-002-guided-live-transcript.md)
- [Read-Only Progress Navigator ADR-003](../../read-only-progress-navigator/adrs/adr-003-current-seam-transcript-projection.md)
