# ADR-003: Shared ACP Turn Core and Certified Lifecycle

## Status

Accepted

## Date

2026-08-08

## Context

The approved `spec-finder exec "<prompt>"` feature needs one fresh ACP turn without task packets, memory, reports, cockpit state, or persisted history. The repository already has a working ACP v1 lifecycle in `runAcpTurn`, but that implementation emits task-shaped events, always advertises host writes, writes interactive permission prompts to stdout, and terminates only the direct provider process without semantic ACP cancellation or bounded descendant cleanup.

Technical research also established that Spec Finder's lexical workspace checks do not reject symlink escapes, the cockpit transcript intentionally exposes content that the exec output contract forbids, and the declared ACP SDK range can resolve beyond the locked and validated 1.2.1 API. ACP v1 requires explicit capability negotiation, semantic `session/cancel`, cancellation of pending permission requests, absolute filesystem paths, and capability-gated `session/close`. Bun and Node process cancellation alone do not guarantee descendant cleanup.

The implementation therefore needs a reusable protocol seam while preserving the behavior of the existing packet workflow.

## Decision Drivers

- Keep `exec` completely outside packet, memory, report, checkpoint, and cockpit lifecycles.
- Preserve existing `run` behavior and its task-shaped event contract.
- Centralize ACP v1 negotiation, authentication, session setup, configuration, prompting, cancellation, and cleanup.
- Keep stdout clean and publish agent text only after a successful end of turn.
- Enforce user-owned permission policy independently from repository runtime configuration.
- Refuse host filesystem access that cannot be proven to remain inside the canonical workspace.
- Require bounded provider cleanup on every supported platform before releasing `exec` anywhere.
- Avoid depending on draft ACP v2 or an unvalidated SDK surface.

## Evidence

| Kind | Finding | Source | Date |
|---|---|---|---|
| Repository | `engine.ts` creates packet memory, mutates task state, and runs implementation and report turns. | `src/engine.ts` | 2026-08-08 |
| Repository | `runAcpTurn` already performs the reusable ACP initialization, authentication, fresh-session, configuration, and prompt lifecycle. | `src/acp-client.ts` | 2026-08-08 |
| Repository | Existing ACP events require a task ID, while the cockpit transcript renders thoughts and raw tool payloads. | `src/events.ts`, `src/ui/transcript.ts` | 2026-08-08 |
| Repository | Host filesystem checks are lexical and both read and write callbacks rely on them. | `src/paths.ts`, `src/acp-client.ts` | 2026-08-08 |
| Repository | The declared SDK range is `^1.2.1`; the lockfile currently resolves 1.2.1. | `package.json`, `bun.lock` | 2026-08-08 |
| External | ACP v1 cancellation requires `session/cancel`, continued update handling, and cancelled outcomes for pending permission requests. | https://agentclientprotocol.com/protocol/v1/prompt-turn, https://agentclientprotocol.com/protocol/v1/tool-calls | 2026-08-08 |
| External | ACP filesystem calls require advertised capabilities and absolute paths; optional session close is capability-gated. | https://agentclientprotocol.com/protocol/v1/file-system, https://agentclientprotocol.com/protocol/v1/session-setup | 2026-08-08 |
| External | Node and Bun direct-child termination does not guarantee descendant cleanup; POSIX process groups and Windows Job Objects or an equivalent supervisor require separate certification. | https://nodejs.org/api/child_process.html, https://bun.sh/docs/runtime/child-process | 2026-08-08 |
| User decision | Host writes may ship with symlink rejection and immediate parent revalidation; hostile concurrent same-user filesystem mutation is outside the V1 threat model. | TechSpec clarification | 2026-08-08 |
| User decision | Cross-platform bounded cleanup must pass before `exec` releases on any platform. | TechSpec clarification | 2026-08-08 |
| User decision | Exit codes are 0 for success, 2 for invocation/configuration, 130 for cancellation, and 1 for other non-success outcomes. | TechSpec clarification | 2026-08-08 |
| User decision | Buffered agent text reaches stdout only after `end_turn`; non-success outcomes leave stdout empty. | TechSpec clarification | 2026-08-08 |
| User decision | User permissions are parsed independently from unrelated user runtime fields. | TechSpec clarification | 2026-08-08 |
| User decision | A shared task-neutral ACP turn core with packet and exec adapters was selected. | TechSpec approach selection | 2026-08-08 |

## Decision

Adopt a shared, task-neutral ACP v1 turn core with separate compatibility adapters:

1. Extract protocol and process lifecycle behavior from `runAcpTurn` into a neutral core that owns provider launch, v1 negotiation, advertised authentication, fresh session creation, complete configuration-state reconciliation, one prompt, terminal stop reason, optional capability-gated session close, and transport cleanup.
2. Keep a packet adapter that translates neutral lifecycle events into the existing task-shaped event contract. Existing `run` callers and packet semantics remain behaviorally unchanged.
3. Add an exec adapter and packet-free orchestrator that own strict argument parsing, independent workspace and configuration resolution, user-only permission policy, safe output normalization, signal handling, and process exit mapping.
4. Use stable ACP v1 root imports and pin the validated SDK version to 1.2.1. Draft ACP v2 is outside this feature. A future SDK upgrade requires its own compatibility verification.
5. Model cancellation as one idempotent coordinator: mark the turn cancelling, send `session/cancel` when a session exists, settle every pending permission request as cancelled exactly once, keep consuming trailing updates, await a semantic cancelled result for a bounded grace period, then escalate process cleanup when required.
6. Introduce a platform-aware process supervisor. POSIX implementations use an isolated process group; Windows uses a Job Object or an equivalently verified tree supervisor. `exec` does not release anywhere until macOS, Linux, and Windows descendant-cleanup fixtures all satisfy the five-second product bound.
7. Introduce an async canonical workspace capability for ACP host filesystem methods. Reject non-absolute ACP paths, parent traversal, sibling prefixes, aliases, every symlinked component, and unresolved or unsafe ancestors. Revalidate the deepest existing parent immediately before a write. Permission approval never bypasses containment.
8. Treat malicious concurrent same-user filesystem replacement between validation and use as outside V1's threat model and document the residual pathname time-of-check/time-of-use risk. If release validation finds an escape within the stated threat model, keep exec read-only.
9. Advertise host writes only after containment, permission, cancellation, cleanup, and adversarial gates pass. Every direct host write is mediated by the effective user-owned permission policy independently from agent permission requests.
10. Parse the user permission field independently from unrelated user runtime fields when repository runtime is selected. A valid user permission remains effective; a missing or invalid permission defaults to `prompt`. Full user runtime validation remains mandatory when the user profile supplies runtime values.
11. Use a deny-by-default exec output normalizer. Fixed, sanitized progress and terminal labels go to stderr. Agent-message chunks are buffered and written to stdout only after `end_turn`; thoughts, plans, raw tool data, provider stderr, unknown payloads, partial failed output, and internal errors are never dumped.
12. Normalize terminal outcomes while preserving the raw ACP stop reason internally: `end_turn` is success; `cancelled` is cancellation; token and turn limits are limited; refusal is refused; transport, protocol, process, or cleanup problems are failures. Map these to the accepted 0, 130, 1, and 2 process-code contract.

## Alternatives Considered

### Independent exec ACP implementation

- **Benefits:** Minimizes immediate edits to the packet client and isolates early development.
- **Costs/risks:** Duplicates protocol negotiation, provider configuration, permissions, cancellation, and cleanup; fixes can drift between packet and exec flows.
- **Why not selected:** The user selected one neutral lifecycle core with adapters so protocol and security behavior have one owner.

### Generalized execution engine

- **Benefits:** Could place packet and ad-hoc execution under one high-level orchestration framework.
- **Costs/risks:** Couples the feature to memory, task status, reports, cockpit state, and a much larger regression surface.
- **Why not selected:** It exceeds the narrow packet-free command boundary and threatens existing `run` compatibility.

### Read-only release without cross-platform cleanup

- **Benefits:** Could reduce filesystem mutation risk and ship sooner on one platform.
- **Costs/risks:** Read-only access does not prevent an abandoned provider process from continuing work, and platform-specific release behavior would weaken the cancellation contract.
- **Why not selected:** The user required certified bounded cleanup on macOS, Linux, and Windows before any release.

### Native race-resistant filesystem boundary in V1

- **Benefits:** Directory-handle operations could reduce pathname time-of-check/time-of-use exposure.
- **Costs/risks:** Requires native platform work beyond the current TypeScript/Bun architecture and the approved scope.
- **Why not selected:** The user accepted explicit symlink rejection and immediate parent revalidation with hostile concurrent mutation outside the V1 threat model.

## Consequences

### Positive

- Packet and ad-hoc flows share one ACP protocol implementation without sharing product lifecycle state.
- Semantic cancellation, permission settlement, session cleanup, and capability negotiation have one owner.
- Existing `run` behavior remains protected behind a compatibility adapter.
- Exec output has a clear confidentiality and shell-redirection boundary.
- Repository configuration cannot elevate permission authority.
- Write capability remains visibly gated and can fall back to read-only without weakening containment.
- Cross-platform cleanup is verified before users receive the command.

### Negative and trade-offs

- Extracting the shared lifecycle touches security-sensitive code used by existing packet execution.
- Windows process-tree supervision adds native or platform-specific implementation work and blocks release everywhere until complete.
- Rejecting all symlinks is conservative and may refuse otherwise in-workspace paths.
- The accepted pathname threat model retains a documented same-user concurrent-mutation race.
- Exact SDK pinning requires deliberate upgrades rather than automatic compatible-range movement.
- Success-only stdout discards potentially useful partial text from refused, limited, cancelled, or failed turns.

### Risks and mitigations

- Shared-core refactoring regresses `run` — Freeze current packet behavior with focused compatibility fixtures before extraction and retain the packet adapter contract.
- A provider ignores semantic cancellation — Require live provider certification and withhold that provider from `exec` if it misses the bound.
- A descendant escapes its process group or Job Object — Use platform fixtures with real grandchildren and treat cleanup uncertainty as a release blocker.
- Sanitized output hides recovery information — Maintain a fixed warning and terminal vocabulary with actionable but non-sensitive recovery guidance.
- Canonical path validation is mistaken for OS sandboxing — Scope the guarantee to Spec Finder ACP host capabilities and document provider-owned tool authority separately.

## Reversibility and Rollback

- The task-neutral core and adapters are durable seams, but individual process supervisors and host capabilities can be replaced independently.
- A later native directory-handle implementation can strengthen containment without changing CLI or output contracts.
- Additional output modes can be added explicitly without changing the success-only human stdout default.
- A future ACP SDK or protocol upgrade must preserve the adapter contracts and pass the same lifecycle matrix.

## Implementation Notes

- Freeze the current packet ACP behavior in tests before extracting the neutral core.
- Keep task identifiers and task-shaped events outside the neutral core; add them only in the packet adapter.
- Keep exec output and permission I/O dependency-injected so stdout, stderr, TTY behavior, and cancellation can be verified without a real terminal.
- Make process cleanup and host access explicit capabilities rather than ambient behavior.
- Preserve a read-only exec mode until every write gate and all cross-platform lifecycle gates have terminal evidence.
- Do not expand this design into stdin prompts, machine-readable output, session resume, generalized shell tools, or persisted diagnostics.

## Follow-ups

- Freeze current `runAcpTurn` behavior with compatibility tests before extracting the core.
- Spike POSIX detached-group cleanup under the pinned Bun runtime.
- Design and verify the Windows Job Object or equivalent supervisor.
- Extend the ACP fixture for semantic cancellation, pending permissions, optional close, configuration-state replacement, hostile updates, and spawned descendants.
- Define the exact normalized stderr vocabulary in the TechSpec.
- Run live cancellation and output certification for Claude, Codex, and Cursor before enabling each provider through `exec`.

## References

- [ADR-001: Guarded One-Turn ACP Execution](adr-001-guarded-one-turn-exec.md)
- [ADR-002: User-Owned Permissions and Human Exec Contract](adr-002-user-owned-permissions-human-exec.md)
- [Approved PRD](../_prd.md)
- `src/acp-client.ts`
- `src/config.ts`
- `src/engine.ts`
- `src/events.ts`
- `src/paths.ts`
- `src/ui/transcript.ts`
- https://agentclientprotocol.com/protocol/v1/initialization
- https://agentclientprotocol.com/protocol/v1/prompt-turn
- https://agentclientprotocol.com/protocol/v1/tool-calls
- https://agentclientprotocol.com/protocol/v1/file-system
- https://agentclientprotocol.com/protocol/v1/session-setup
- https://nodejs.org/api/child_process.html
- https://bun.sh/docs/runtime/child-process
