# ADR-003: Typed no-work outcome and command-owned exit lifecycle

## Status

Accepted

## Date

2026-08-08

## Context

`runTaskPacket` computes executable work with `executionOrder()`. A valid packet
whose tasks are all marked `completed`, `done`, or `finished` produces an empty
order, invokes no ACP turn, then currently returns success and emits only the
free-text message `0 tasks completed`. The interactive command starts the
cockpit before that call and destroys it unconditionally in `finally`, so the
operator cannot inspect the otherwise successful result.

The approved PRD requires a default, persistent, read-only explanation for
every valid no-work run, a truthful successful `--no-ui` result, no provider
activity, and no general validation/error taxonomy. `RunResult` is also used by
injected packet runners, so a required result-shape replacement would create a
broader compatibility migration. Existing batch work is outside this packet and
must remain structurally compatible without changing its public behavior.

## Decision Drivers

- F-01 through F-04 and M-01 through M-04 in the approved PRD.
- The no-work fact must not be inferred from presentation text.
- A normal interactive completion must retain its current automatic close.
- Existing event and runner consumers need an additive-compatible contract.
- No new configuration, dependency, persistence, provider invocation, or
  telemetry is authorized.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | `executionOrder()` excludes `completed`, `done`, and `finished`; a taskless packet is instead invalid. | `src/tasks.ts` | 2026-08-08 |
| Repository | ACP implementation and reporting only occur inside the ordered-task loop. | `src/engine.ts` | 2026-08-08 |
| Repository | `run_finished` and `RunResult` currently carry only generic completion data. | `src/events.ts`, `src/engine.ts` | 2026-08-08 |
| Repository | `runCommand` always destroys the cockpit after the engine promise settles. | `src/commands.ts` | 2026-08-08 |
| Official docs | OpenTUI supports test rendering, mock keyboard input, and explicit renderer teardown. | `https://github.com/anomalyco/opentui/blob/main/packages/web/src/content/docs/core-concepts/testing.mdx` | OpenTUI 0.4.5, 2026-08-08 |
| User decision | Use optional typed outcome and bounded reason on both result and completion event. | Technical clarification A | 2026-08-08 |
| User decision | The command owns a one-shot cockpit exit wait; App owns keyboard handling. | Technical clarification A | 2026-08-08 |
| User decision | V1 exposes only `all_tasks_complete` as the typed no-work reason. | Technical clarification A | 2026-08-08 |
| User decision | Select the additive result/event approach rather than a replacement union or new event hierarchy. | Approach selection A | 2026-08-08 |

## Decision

Add optional fields to the existing success contracts:

```ts
outcome?: "no_work";
reason?: "all_tasks_complete";
```

The engine sets both fields only when a loaded and validated packet has an
empty execution order. It returns the same successful counts and emits the
existing `run_finished` event with the same fields. All other successful and
failed/cancelled paths omit them; loading and validation failures remain errors
and do not become no-work outcomes.

The command will branch on the typed result, never on completion text. In
no-UI mode it prints a concise all-tasks-complete explanation and returns
success. In interactive mode, `startCockpit` will expose an idempotent
`waitForExit` handle. Only a no-work result awaits that handle; `q` and
Ctrl+C remain App-owned, signal the handle once, and retain their present
read-only/abort semantics. Normal completion still closes immediately.

The store and App consume the typed completion fields to render a persistent,
distinct no-work summary with task counts and an all-tasks-complete reason. No
controls, configuration, transport, persistence, or batch-specific behavior is
added.

## Alternatives Considered

### Replace `RunResult` with a required discriminated union

- **Benefits:** Makes each terminal result exhaustively typed.
- **Costs/risks:** Breaks injected `PacketRunner` fixtures and requires a
  broader migration of batch and test consumers.
- **Why not selected:** A narrow optional extension communicates the new fact
  while preserving existing successful and failure contracts.

### Add a dedicated `run_no_work` event and terminal-event hierarchy

- **Benefits:** Gives no-work a standalone transport event.
- **Costs/risks:** Expands the closed event union and every consumer for a
  single terminal variant, including pending batch work.
- **Why not selected:** Mirroring the fact on the existing terminal event is
  sufficient and has a smaller migration surface.

### Keep free-text completion and inspect it in the command

- **Benefits:** Avoids a type change.
- **Costs/risks:** Couples lifecycle behavior to presentation wording and
  cannot reliably distinguish cancellation, validation errors, or future
  no-work causes.
- **Why not selected:** The PRD requires a truthful, explicit outcome rather
  than string inference.

### Make every successful interactive run wait for a manual exit

- **Benefits:** Reuses one retention path.
- **Costs/risks:** Changes the established normal-run completion behavior.
- **Why not selected:** Retention is a no-work-only product requirement.

## Consequences

### Positive

- Engine, no-UI, and TUI consumers share one bounded fact.
- No-work remains a successful, provider-free execution path.
- The operator can read the cockpit until explicitly exiting.
- Existing consumers can ignore the optional fields during incremental rollout.

### Negative and trade-offs

- The cockpit API gains a lifecycle promise and must make exit signaling
  idempotent.
- The V1 reason taxonomy intentionally covers only all-tasks-complete.
- Command tests need a controllable cockpit seam to avoid hanging.

### Risks and mitigations

- A missed exit signal could leave the no-work command waiting — resolve the
  promise from both existing `q` and Ctrl+C paths and test each path.
- A result/event mismatch could create divergent UI and no-UI behavior — build
  both from the engine's single no-work predicate and assert both contracts.
- Pending batch event/store work could conflict during implementation — merge
  optional fields additively and preserve batch projections and tests.

## Reversibility and Rollback

- The fields are optional; legacy consumers remain valid and can ignore them.
- Rollback removes the no-work command/UI branch while retaining the former
  generic successful event and result shape.
- No stored data, configuration schema, provider state, or external contract
  requires migration or cleanup.

## Implementation Notes

- Detect no work with `ordered.length === 0`, after existing packet loading and
  validation; do not reinterpret taskless packets as valid no-work packets.
- Preserve local packet-memory initialization already performed by the engine.
- Do not create ACP sessions, reports, task status changes, telemetry, or
  additional controls on this path.
- Keep no-work output reason derived from its typed field, never from
  `0 tasks completed` text.
- Do not directly modify batch CLI behavior or its `already_complete` summary.

## Follow-ups

- If later planning introduces additional valid zero-executable causes, add a
  reason only with a new ADR, wording, traceability, and tests.
- Validate compatibility against the batch runner and event/store tests when
  the feature is implemented.

## References

- [Approved PRD](../_prd.md)
- [Idea packet](../_idea.md)
- [ADR-001: Empty-run state](adr-001-empty-run-state.md)
- [ADR-002: Default informative no-work](adr-002-default-informative-no-work.md)
- [OpenTUI renderer documentation](https://github.com/anomalyco/opentui/blob/main/packages/web/src/content/docs/core-concepts/renderer.mdx)
