# ADR-003: Isolated Loop Stack Above Unchanged `runTaskPacket`

## Status

Accepted

## Date

2026-08-13

## Context

The approved PRD adds `spec-finder loop <task_slug>` as a continuous one-packet driver while `run` stays a single pass. Architecture rules keep workflow orchestration out of the CLI and forbid a second lifecycle owner beside the packet engine.

`runTaskPacket` already owns validation, memory bootstrap, checkpoint/handoff recovery, two-phase ACP execution, and fail-fast stop. `RunResult.blocked` is overloaded. Failed tasks remain in `executionOrder`, so a blind second pass would re-implement them.

## Decision Drivers

- G-01 / F-02: continue through recoveries inside one invocation.
- G-02 / F-07: leave `run` and `--multiple` behavior unchanged.
- Architecture: orchestration in the engine layer, not `commands.ts`.
- Product ADR-001 rejected a thin auto-rerun wrapper without terminals or evidence, not reuse of the engine.
- Smallest additive engine change that can carry F-02 SHOULD feedback.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | `runTaskPacket` is the packet lifecycle owner used by `run` and batch. | [`src/engine.ts`](../../../../../src/engine.ts) | 2026-08-13 |
| Repository | Batch is a thin coordinator with an injectable runner and additive events. | [`src/batch.ts`](../../../../../src/batch.ts) | 2026-08-13 |
| Repository | Architecture keeps orchestration out of the CLI. | [`.agents/rules/architecture.md`](../../../../../.agents/rules/architecture.md) | 2026-08-13 |
| Repository | `executionOrder` includes failed tasks; a second pass would re-run them. | [`src/tasks.ts`](../../../../../src/tasks.ts) | 2026-08-13 |
| User decision | Wrap unchanged `runTaskPacket`; classify from packet files; optional `RunOptions.loopFeedback`; isolated loop stack. | Technical clarification and approach selection | 2026-08-13 |

## Decision

Implement V1 as an isolated loop stack:

- `src/loop-state.ts` owns the ledger schema, load/init/reset, and atomic write.
- `src/loop.ts` owns detect, iteration, classification, caps, feedback assembly, and terminals.
- `loopCommand` in `src/commands.ts` parses flags, acquires the existing run-lock, reuses the cockpit/`--no-ui` lifecycle, and maps the coordinator result to exits.
- Each iteration calls existing `runTaskPacket` once for remaining work.
- After an unrecoverable `failed` classification, the coordinator does not invoke the engine again.
- The only engine contract change is optional `loopFeedback?: string` on `RunOptions`. `run` and batch omit it.

Do not extract a single-task seam, reimplement ACP/report/checkpoint, or fold loop into `batch.ts`.

## Alternatives Considered

### Command-owned loop

- **Benefits:** Fewer files.
- **Costs/risks:** Puts detect/ledger/iteration in the CLI; weak injection seams.
- **Why not selected:** Violates the architecture rule that workflow orchestration lives in the engine layer.

### Generalize batch into a packet driver

- **Benefits:** Reuses a coordinator file.
- **Costs/risks:** Batch’s approved contract is no resume, no persistence, no retry; exit matrices differ.
- **Why not selected:** Contaminates `--multiple` and raises regression risk.

### Extract a single-task/recovery seam

- **Benefits:** Finer iteration granularity.
- **Costs/risks:** Touches the shared engine; dual-ownership risk if `run` and the seam diverge.
- **Why not selected:** Not required for V1 detect/recover/execute; rejected during clarification.

## Consequences

### Positive

- `run` and batch keep their current call shape aside from an unused optional field.
- Loop policy is unit-testable without starting a cockpit.
- One lifecycle owner per pass remains `runTaskPacket`.

### Negative and trade-offs

- An iteration is one remaining engine pass, not one task.
- Nested `run_started` events can reset the cockpit store unless the command wraps the listener.
- Prompt tests must pin the optional feedback prefix.

### Risks and mitigations

- **Dual ownership of task status.** — Loop never writes task frontmatter; only the engine does.
- **Failed-task re-execution.** — Detect treats any `failed` task as terminal `failed` and stops.
- **Cockpit reset on later passes.** — Command-owned emit wrapper suppresses subsequent `run_started` events.

## Reversibility and Rollback

High. Remove `loop` dispatch, `src/loop.ts`, and `src/loop-state.ts`. Leave `RunOptions.loopFeedback` unused or delete it. Leftover `loop/` directories are inert.

## Implementation Notes

- Inject `runTaskPacket` into the coordinator for tests, matching `runBatch`.
- Do not add required config keys.
- Keep detect pure: packet snapshot + ledger in, action/terminal out.

## Follow-ups

- Record ledger, classification, exits, and reset in ADR-004.
- Specify emit wrapping so interactive loop does not reset the store each pass.

## References

- [PRD](../_prd.md)
- [ADR-001](adr-001-dedicated-loop-command.md)
- [ADR-002](adr-002-cli-first-honest-terminal-loop-scope.md)
