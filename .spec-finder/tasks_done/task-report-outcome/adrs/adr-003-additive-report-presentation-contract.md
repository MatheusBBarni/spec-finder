# ADR-003: Additive Report Presentation Contract

## Status

Accepted

## Date

2026-08-08

## Context

The approved PRD requires a concise and trustworthy cockpit experience for the
final-report turn without changing ACP itself, no-UI output, or the existing
implementation-failure path. Today `runTaskPacket` performs distinct
implementation and report turns, while `runAcpTurn` forwards their ACP updates
with the same `RunEvent` shape. The transcript renders an unrecognized
`session_info_update` through an unbounded JSON fallback. A report provider can
therefore expose its prompt and absolute report path as transcript content.

The engine already decides task completion only after a successful report turn
and `assertReport`. It owns the absolute artifact path, but the cockpit should
never receive or display that absolute path. ACP v1 session-info is optional
metadata, not a task-result mechanism, and providers may reuse a session ID
between the two independently created turns.

## Decision Drivers

- G-01 through G-04 and F-01 through F-05 in the approved PRD.
- The engine must remain the sole authority for completed and failed outcomes.
- Report references must be omitted unless containment and relativity are
  validated after the report is accepted.
- Existing callers, including the batch adapter and no-UI listener, must accept
  legacy events without behavioral change.
- Untrusted provider display data must not introduce prompt, path, terminal
  control, or unbounded-output leakage.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | The engine starts a second report turn only after implementation succeeds, validates the report, then emits completion. | [`src/engine.ts`](../../../../src/engine.ts) | 2026-08-08 |
| Repository | `session_update` lacks phase context and the transcript serializes unrecognized update payloads without a size/control boundary. | [`src/events.ts`](../../../../src/events.ts), [`src/ui/transcript.ts`](../../../../src/ui/transcript.ts) | 2026-08-08 |
| Repository | The current test agent reuses `test-session` for every ACP session. | [`tests/fixtures/mock-agent.ts`](../../../../tests/fixtures/mock-agent.ts) | 2026-08-08 |
| Official docs | ACP v1 session-info updates are optional session metadata, not completion results. | [ACP Session Info Update](https://agentclientprotocol.com/rfds/session-info-update) | SDK 1.2.1 / protocol v1 |
| Official docs | The installed client must remain on ACP v1; ACP v2 is a draft with a different prompt lifecycle. | [ACP v1 overview](https://agentclientprotocol.com/protocol/v1/overview), [ACP v2 draft](https://agentclientprotocol.com/announcements/acp-v2-draft) | 2026-08-08 |
| User decision | Selected additive phase/reference contract, safe bounded fallback, deterministic mock-provider evidence, and the narrow additive approach. | TechSpec clarifications | 2026-08-08 |

## Decision

Keep the existing event family and add only the presentation data needed by
this issue:

- Export `AcpTurnPhase = "implementation" | "report"`. `runTaskPacket` assigns
  the phase explicitly for each `runAcpTurn` call; `runAcpTurn` copies it onto
  every emitted `session_update`. The UI must never infer phase from activity
  copy, session IDs, prompts, titles, report prose, or provider `_meta`.
- Extend `task_status` with an optional `reportReference`. The engine may set it
  only on a completed status after `assertReport` and canonical
  workspace-containment validation. It is a slash-normalized workspace-relative
  file reference; otherwise it is omitted.
- The transcript drops report-phase `session_info_update` entries entirely.
  An implementation-phase session-info update may produce only a fixed,
  payload-free metadata label. Provider metadata never determines a task
  outcome.
- Other unrecognized updates retain a label and a deterministic bounded
  fallback. The formatter excludes `_meta`, redacts common absolute POSIX,
  Windows-drive, and UNC path substrings, neutralizes terminal/control
  characters, and appends a truncation marker after 1,024 display characters.
- The interactive store formats task activity into a concise, bounded,
  control-safe display reason before it reaches the cockpit. Engine activity
  emission and the no-UI listener retain their current semantics, while the
  cockpit cannot render an absolute path or raw terminal controls from a report
  failure. The implementation-failure path and dependency blocking retain their
  current lifecycle semantics. V1 does not create or infer a report-level
  `blocked` outcome.

## Alternatives Considered

### Presentation-only containment

- **Benefits:** Does not alter the existing event union.
- **Costs/risks:** The UI would infer report phase from mutable activity text and
  would need to derive an artifact path it cannot validate.
- **Why not selected:** It is incorrect when provider session IDs are reused and
  violates the engine-authoritative safe-reference boundary.

### Dedicated report-lifecycle event family

- **Benefits:** Leaves a larger future extension point for report state.
- **Costs/risks:** Adds a second lifecycle model, extra batch adaptation, and
  migration surface for a single known report presentation issue.
- **Why not selected:** The current `session_update` and `task_status` contracts
  can carry this bounded information additively.

### Render raw metadata with an allowlist

- **Benefits:** Retains more provider diagnostics.
- **Costs/risks:** A title can contain the entire report prompt; allowlisted
  fields are still provider-controlled and may contain paths or controls.
- **Why not selected:** It cannot satisfy the no-raw-metadata requirement.

## Consequences

### Positive

- The cockpit can distinguish report updates reliably even when a provider
  reuses a session ID.
- A report reference has one authority: the engine after report validation.
- Existing event consumers remain source-compatible because all new fields are
  optional and additive.

### Negative and trade-offs

- The engine, ACP adapter, event types, store, transcript projection, and
  cockpit tests all change together.
- The generic fallback deliberately exposes less provider detail.
- Canonical path validation adds I/O and may omit an otherwise existing report
  reference when it cannot prove containment.

### Risks and mitigations

- **Late or cross-packet events** — retain the store's current active-packet
  qualification fence; phase does not replace task/session scoping.
- **Absolute-path or control-sequence leakage** — validate before event emission
  and recheck display safety before rendering; use adversarial tests.
- **False terminal status** — only the engine emits `reportReference` after
  successful stop and report validation; ignore provider verdict prose.
- **ACP version drift** — type against the installed v1 SDK and leave v2 work
  out of scope.

## Reversibility and Rollback

All changes are ephemeral TypeScript contracts and in-memory cockpit state. A
rollback removes the optional fields and presentation branches without a data
migration, packet-format change, or ACP protocol negotiation change. Older
event producers remain accepted; they simply emit no phase/reference data.

## Implementation Notes

- Resolve both workspace root and report target with `realpath` before
  calculating the reference. Reject an empty, absolute, or traversal relative
  path, and omit the field on any validation failure.
- Do not add a report reference to failed, blocked, or implementation-only task
  statuses.
- Keep `--no-ui` untouched: it already ignores `session_update` and should also
  ignore the additive `reportReference` field.
- Preserve the batch adapter's qualified task-key behavior and its rejection of
  inactive-packet events.

## Follow-ups

- Revisit an engine-owned report `blocked` result only when the runtime exposes
  such a typed status.
- Revisit a general lifecycle metadata model only when more than this report
  turn has an independently verified presentation need.
- Monitor real provider behavior after release; it is not a release gate.

## References

- [Approved PRD](../_prd.md)
- [ADR-001: Phase-Aware Report Outcomes](adr-001-phase-aware-report-outcomes.md)
- [ADR-002: Verified Report Completion Rollout](adr-002-verified-report-completion-rollout.md)
- [ACP v1 session setup](https://agentclientprotocol.com/protocol/v1/session-setup)
- [OpenTUI React testing](https://opentui.com/docs/bindings/react/)
