# ADR-003: Coordinator Batch Envelope and Active Projection

## Status

Accepted

## Date

2026-08-08

## Context

The approved PRD requires ordered multi-packet execution, compact outcomes for every packet, active-packet detail, distinct cancellation, strict preflight, and unchanged single-slug behavior. The repository's current `runTaskPacket`, `RunEvent`, and `CockpitStore` contracts are packet-local and singular: `run_started` resets the store, task IDs are bare, and cancellation can be thrown or converted to failure depending on timing.

The implementation must add batch behavior without erasing prior packet outcomes, colliding repeated task IDs, or broadening the single-run contract unnecessarily.

## Decision Drivers

- Preserve `runTaskPacket` as the reusable packet execution unit.
- Preserve single-run `RunEvent` and CLI behavior.
- Preflight every packet before filesystem mutation or provider launch.
- Retain compact batch outcomes while projecting detailed state for only the active packet.
- Normalize abort and ACP cancellation distinctly from provider failure.
- Make ordering, parser, and cancellation behavior deterministic without real provider processes in most tests.
- Avoid new dependencies, persistence, or cross-packet scheduling semantics.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | `runCommand` is the only production caller and currently creates one store/renderer before one `runTaskPacket` call. | `src/commands.ts:186-214` | 2026-08-08 |
| Repository | `run_started` resets the full store and transcript keys are task-local, so direct nested packet events erase/collide. | `src/ui/store.ts:36-97` | 2026-08-08 |
| Repository | `ensurePacketMemory` writes files after packet validation; it cannot be part of read-only full-sequence preflight. | `src/engine.ts:30-36` | 2026-08-08 |
| Repository | Abort before a task throws without `run_finished`; abort during ACP is caught as failed. | `src/engine.ts:44-45`, `src/engine.ts:92-98` | 2026-08-08 |
| Official docs | ACP cancellation should result in `StopReason::Cancelled`; stdio uses `ndJsonStream`. | [ACP TypeScript API](https://zed-industries.github.io/agent-client-protocol/interfaces/Agent) | 2026-08-08 |
| Official docs | OpenTUI live rendering is reference-counted by `requestLive()`/`dropLive()` and `destroy()` releases renderer resources. | [OpenTUI renderer](https://opentui.com/docs/core-concepts/renderer/) | 2026-08-08 |
| Official docs | Bun supports focused TypeScript tests and non-zero process exit on failures. | [Bun test runner](https://bun.sh/docs/test) | 2026-08-08 |
| User decision | The user selected coordinator ownership, additive event compatibility, coordinator-level cancellation normalization, strict `--multiple <list>` grammar, and injected packet-runner tests. | Technical clarification decisions | 2026-08-08 |

## Decision

Implement a new sequential batch coordinator above the unchanged `runTaskPacket` contract.

- The CLI accepts exactly one `--multiple <comma-separated-list>` option, rejects positional slugs and malformed/empty/duplicate entries, and preserves existing single-slug parsing behavior on the non-batch path.
- The coordinator loads and validates every packet before `ensurePacketMemory`, status writes, or ACP launch.
- Packets execute serially with one shared `AbortController` and effective config. Failure or cancellation stops the sequence; later packets become `not_started`.
- Batch lifecycle and outcome events are additive. Existing single-run events remain unchanged for the single-slug path.
- The store retains compact packet outcomes and projects detailed task/transcript state for only the active packet. Internal task keys are packet-qualified to prevent collisions; existing single-run event payloads remain compatible.
- Abort and ACP `cancelled` outcomes normalize to `cancelled` in the batch coordinator. Provider errors, permission refusals, and report failures remain `failed`.
- A packet with no remaining tasks is reported as `succeeded` with an already-complete detail.
- Coordinator tests inject a packet runner; a smaller ACP fixture test protects the real engine boundary.

## Alternatives Considered

### Native batch engine

- **Benefits:** Centralizes batch lifecycle and cancellation in the engine.
- **Costs/risks:** Broadens the packet engine and event contract, requiring more single-run compatibility work and increasing rollback cost.
- **Why not selected:** The existing packet engine is a stable reusable unit; the PRD needs an opt-in orchestration boundary, not a new core engine contract.

### Command-only orchestration

- **Benefits:** Minimal source and event changes.
- **Costs/risks:** Cannot provide the approved compact batch summary and active-packet cockpit continuity without duplicating state handling in the command layer.
- **Why not selected:** It would under-deliver the primary interactive product path.

## Consequences

### Positive

- Existing packet execution and single-run consumers remain stable.
- Preflight is mutation-free and prevents partial starts caused by invalid later packets.
- Repeated task IDs cannot overwrite retained batch outcomes or active transcripts.
- Cancellation is truthful and always reaches a terminal batch result.
- Most coordinator behavior is deterministic and provider-independent in tests.

### Negative and trade-offs

- The event union and cockpit store gain a batch envelope and summary state.
- An event adapter must separate batch boundaries from packet-local task events.
- Preflight reads every packet before work begins and does not provide transactional rollback.
- The batch coordinator must preserve subtle permission/refusal distinctions already present in the engine.

### Risks and mitigations

- **Batch events accidentally reset active state.** — Keep batch lifecycle events separate from legacy `run_started`; add store transition tests.
- **Cancellation is overwritten by failure.** — Classify signal state and ACP stop reason before failure mapping; add abort fixtures.
- **Parser changes regress single-run flags.** — Test exclusive batch grammar and existing provider/model/reasoning/speed flags.
- **Packet-qualified internal keys leak into legacy consumers.** — Keep qualification internal to batch projection and preserve legacy event payloads on the single path.

## Reversibility and Rollback

High. Remove the batch parser, coordinator, additive events, and batch store fields to return to the existing single-run path. No task-file, config, persistence, or dependency migration is required.

## Implementation Notes

- Do not call `ensurePacketMemory` during preflight.
- Do not forward nested packet `run_started`/`run_finished` directly to the batch store.
- Keep one renderer and one batch abort signal for the invocation.
- Do not introduce parallel scheduling, retries, resume state, or rollback.
- Preserve unrelated dirty work in the repository.

## Follow-ups

- Define exact batch event types and store transitions in the TechSpec.
- Define the aggregate result and exit-code mapping for preflight, failure, cancellation, and all-success cases.
- Add compact cockpit and `--no-ui` output examples to the README.

## References

- [Ordered Multi-Packet Run PRD](../_prd.md)
- [ADR-001: Ordered Multi-Packet Run Coordinator](adr-001-ordered-multiple-task-run.md)
- [ADR-002: Compact Fail-Safe Sequence Product Scope](adr-002-compact-fail-safe-sequence-product-scope.md)
