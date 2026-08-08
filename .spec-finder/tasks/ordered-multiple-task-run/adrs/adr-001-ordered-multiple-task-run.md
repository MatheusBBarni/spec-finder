# ADR-001: Ordered Multi-Packet Run Coordinator

## Status

Accepted

## Date

2026-08-04

## Context

Spec Finder currently accepts one task-packet slug per `run` invocation. Operators who have several approved packets to execute in a known sequence must repeat the command manually, while the existing packet engine already provides validation, dependency ordering, implementation/report phases, lifecycle state, and fail-fast behavior within each packet.

The selected capability is a focused local-operator quick win: `spec-finder run --multiple <slug_1>,<slug_2>,<slug_n>` runs an explicitly ordered sequence of packets in one invocation. It must not become a scheduler, persistence layer, or second execution control plane.

## Decision Drivers

- Preserve the current packet engine and its per-packet lifecycle semantics.
- Make the declared order and fail-fast boundary deterministic and testable.
- Prevent a malformed later slug from mutating an earlier packet before the sequence is accepted.
- Report each packet outcome and one truthful aggregate result.
- Distinguish operator cancellation from packet failure while using a non-zero aggregate exit for both.
- Keep the existing cockpit detail focused on the active packet and avoid cross-packet task-ID collisions.
- Keep the change reversible and exclude retries, parallelism, resume, and cross-packet dependencies from V1.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | `runCommand` extracts one non-flag slug, creates one cockpit, and calls `runTaskPacket` once. | `src/commands.ts:186-215` | 2026-08-04 |
| Repository | `runTaskPacket` owns packet validation, dependency ordering, implementation/report turns, task lifecycle, and fail-fast-on-task-failure. | `src/engine.ts:29-112` | 2026-08-04 |
| Repository | Slug validation and dependency ordering are scoped to one packet; events and cockpit state are singular-run projections. | `src/tasks.ts:54-119`, `src/events.ts:6-12`, `src/ui/store.ts:40-62` | 2026-08-04 |
| External | Task accepts multiple named tasks and exposes explicit fail-fast and exit-code controls. | [Task CLI reference](https://taskfile.dev/docs/reference/cli) | 2026-08-04 |
| External | Task documents that concurrent output can become messy and that fail-fast can stop further dependencies. | [Task guide](https://next.taskfile.dev/docs/guide) | 2026-08-04 |
| External | Nx supports multiple task invocation and an explicit sequential mode with `--parallel=1`. | [Nx running tasks](https://nx.dev/docs/getting-started/tutorials/running-tasks) | 2026-08-04 |
| External | GitHub Actions distinguishes fail-fast cancellation from continue-on-error in aggregate execution. | [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) | 2026-08-04 |
| User decision | The user selected ordered execution, local-operator scope, quick-win ambition, truthful per-packet/aggregate outcomes, and Direction A. | Idea-factory clarification and opportunity decision | 2026-08-04 |

## Decision

Add a thin batch coordinator above the unchanged `runTaskPacket` contract. The coordinator will:

1. Parse a strict comma-separated ordered slug list supplied by `--multiple`.
2. Reject empty, malformed, duplicate, or invalid slugs and invalid packet definitions before the first packet starts.
3. Execute packets serially in the declared order.
4. Stop immediately when a packet fails or is cancelled; later packets are `not_started`.
5. Preserve distinct `succeeded`, `failed`, `cancelled`, and `not_started` packet outcomes with one non-zero aggregate exit for failed or cancelled sequences.
6. Add batch-level lifecycle/result state while keeping the cockpit's detailed task/transcript view scoped to the active packet and qualifying task identity by packet slug.

V1 does not add packet-level retries, parallelism, resume state, durable batch history, or cross-packet dependency semantics.

## Alternatives Considered

### Essence-first console wrapper

- **Benefits:** Smallest implementation and minimal event/UI change.
- **Costs/risks:** Interactive operators lose retained batch visibility, and console and cockpit execution shapes diverge.
- **Why not selected:** The repository's primary run experience includes the cockpit, and truthful per-packet outcomes require an additive batch result boundary.

### Ambitious batch orchestration

- **Benefits:** Could support manifests, resume, retries, parallel scheduling, and durable history.
- **Costs/risks:** Introduces scheduler policy, persistence, recovery, and coordination complexity before the core convenience hypothesis is tested.
- **Why not selected:** No evidence supports those capabilities for V1; they are separate consequential decisions.

### Lazy packet validation

- **Benefits:** Reuses the current engine's load-on-run path and minimizes upfront work.
- **Costs/risks:** A later invalid packet can be discovered only after earlier packets have mutated status, memory, or reports.
- **Why not selected:** The council and user-selected fail-safe workflow favor atomic acceptance of the declared sequence, even though execution itself remains non-transactional.

## Consequences

### Positive

- One command replaces repeated manual packet invocations for a known sequence.
- Declared order, stop behavior, cancellation, and aggregate exit status are explicit and testable.
- Existing packet execution semantics remain reusable and unchanged.
- Per-packet outcomes remain available without turning the cockpit into a full scheduler UI.

### Negative and trade-offs

- Preflight may load and validate packets before execution and can reject a sequence that would otherwise have started with an earlier valid packet.
- Batch event/state envelopes add API and UI surface area, and packet-qualified identity must be carried through summaries.
- Earlier completed work remains durable if a later packet fails; this is fail-fast sequencing, not transactional rollback.

### Risks and mitigations

- **Cancellation is reported as failure or never reaches a terminal batch result.** — Model cancellation as a distinct terminal outcome and always emit/return an aggregate terminal result.
- **Nested single-run events reset the cockpit or collide on `task_01`.** — Add batch boundaries and retain an active-packet projection with slug-qualified packet/task identity.
- **Parser ambiguity causes flags or whitespace to become slugs.** — Use strict parsing tests for empty entries, duplicates, invalid slugs, and option ordering.
- **Partial execution is mistaken for all-or-nothing delivery.** — Report `not_started` packets and document that completed earlier packets are not rolled back.

## Reversibility

High. The coordinator and batch event/result envelope can be removed while preserving `runTaskPacket` and the existing single-slug command. No durable batch state or task schema changes are required by this decision.

## Follow-ups

- Define the exact CLI grammar and option precedence in the TechSpec.
- Define batch event shapes and the active-packet cockpit projection without breaking single-run consumers.
- Add command-level integration tests for ordering, preflight zero-start behavior, failure/cancellation stop boundaries, duplicate slugs, and aggregate exit codes.
- Revisit resume, retries, parallelism, or manifests only after observing real sequence usage and recording separate decisions.

## References

- [Ordered Multi-Packet Run idea packet](/Users/matheusbbarni/projects/spec-finder/.spec-finder/tasks/ordered-multiple-task-run/_idea.md)
