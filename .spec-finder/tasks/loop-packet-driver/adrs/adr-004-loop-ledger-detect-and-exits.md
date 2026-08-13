# ADR-004: Packet-Local Ledger, File Detect, Exec-Like Exits

## Status

Accepted

## Date

2026-08-13

## Context

Loop must persist inspectable evidence, resume after process death, classify continue vs stop without changing `RunResult`, and expose a public exit matrix. Product open questions left exact wording, default caps, and reset policy to design. `exec` already uses `0` / `1` / `2` / `130`; `run` uses `0` / `1` only.

## Decision Drivers

- F-03 / G-03: named terminals with readable reasons.
- F-04: packet-local runtime-owned evidence; dry-run writes nothing.
- F-05 / M-04: dry-run non-mutation.
- HC-05: no required config keys or telemetry.
- Compatibility: do not change `RunResult` used by `run` and batch.
- F-01 SHOULD: explicit reset and invocation cap overrides.

## Evidence

| Kind | Finding | Source | Version/date |
|---|---|---|---|
| Repository | Archive classification reads only `task_*.md` and checkpoint block. | [`skills/sf-archive-tasks/scripts/scan-tasks.sh`](../../../../../skills/sf-archive-tasks/scripts/scan-tasks.sh) | 2026-08-13 |
| Repository | Setup uses stage + `rename` for durable replaces. | [`src/setup.ts`](../../../../../src/setup.ts) | 2026-08-13 |
| Repository | Config and checkpoint records use strict Zod schemas. | [`src/config.ts`](../../../../../src/config.ts), [`src/tasks.ts`](../../../../../src/tasks.ts) | 2026-08-13 |
| Official docs | Zod 4 `safeParse` and `discriminatedUnion` validate untrusted structured data. | [zod.dev](https://zod.dev/api?id=parse) | reviewed 2026-08-13 |
| Official docs | `fs.promises.rename` is the durable replace primitive. | [Node.js fs](https://nodejs.org/api/fs.html) | reviewed 2026-08-13 |
| Official docs | clig.dev wants zero on success and mapped non-zero modes. | [clig.dev](https://clig.dev/) | reviewed 2026-08-13 |
| User decision | `loop/state.json` + iterations; classify from packet files; exits `0/1/2/130`; optional `loopFeedback`; always-reset. | Technical clarification | 2026-08-13 |

## Decision

### Ledger

- Required file: `.spec-finder/tasks/<slug>/loop/state.json`.
- Optional summaries: `.spec-finder/tasks/<slug>/loop/iterations/NNN.md`.
- Schema version `1`, Zod `.strict()`. Runtime is the only writer.
- Writes use a same-directory temp file plus `rename`.
- No mutable `current_phase`. Detect derives the next action from packet files plus the ledger.
- Dry-run neither creates `loop/` nor writes these files.
- Invalid or hand-edited ledger fails closed with an actionable error (exit `2`) unless `--reset-state` is supplied.

### Classification

After each engine pass, reload the packet and classify:

- recoverable report-only handoff or pending checkpoint delivery → continue
- any task `status: failed` → terminal `failed` (do not re-invoke)
- all tasks complete, no pending delivery, no open handoff → `done`
- abort/cancel → `cancelled`
- pass cannot be explained by those files (permission/policy/external) → persist `blocker`, terminal `blocked`
- iteration cap → `exhausted`
- unchanged completed/failed/blocked identity sets across the no-progress window → `stalled`
- nothing pending at the start of the invocation → `no_op`

### Feedback

Persist a bounded `feedback` object on the ledger. On the next engine invocation in the same or a resumed loop, pass it as `RunOptions.loopFeedback`. `run` and batch omit the field.

### Reset

`--reset-state` is always allowed after packet validation. It rewrites a bootstrap ledger (`iteration` 0, empty feedback, `terminal` null) and does not mutate task files, reports, or memory. It is the only first-party repair for an invalid ledger.

### Exits

| Terminal / class | Exit |
|---|---:|
| `done`, `no_op` | 0 |
| `blocked`, `failed`, `exhausted`, `stalled` | 1 |
| invalid invocation, invalid packet, invalid ledger without reset | 2 |
| cancelled | 130 |

Defaults: `max_iterations = 50`, `no_progress_window = 3`, overridable per invocation. No config schema change.

## Alternatives Considered

### Typed `RunResult.stop_reason`

- **Benefits:** Clearer coordinator logic.
- **Costs/risks:** Changes the shared engine result used by `run` and batch.
- **Why not selected:** Packet files are already truth; keep the engine result compatible.

### Root `loop-state.json` or memory-file ledger

- **Benefits:** Fewer directories, or no new files.
- **Costs/risks:** Packet-root noise, or skill-owned memory cannot be a runtime-only schema.
- **Why not selected:** PRD requires evidence separate from memory/reports/product files.

### Match `run` exits (`0`/`1` only)

- **Benefits:** One packet-command matrix.
- **Costs/risks:** Collapses cancel and invalid invocation into failure.
- **Why not selected:** `exec` already shipped `2` and `130`; loop is a new verb and can be honest.

### Protect `done` from reset

- **Benefits:** Harder to wipe a successful history.
- **Costs/risks:** Extra flags and edge cases.
- **Why not selected:** Reset is explicit; operators who pass the flag intend to start over.

## Consequences

### Positive

- Resume after kill is a reload of packet files plus a validated ledger.
- `run`/`batch` result types stay compatible.
- Scripts can distinguish success, named stop, bad invocation, and cancel.

### Negative and trade-offs

- Loop and `run` exit matrices differ; docs must say so.
- External blockers that leave no task residue require the ledger `blocker` field.
- A mistaken `--reset-state` drops ledger history.

### Risks and mitigations

- **Corrupt ledger mid-write.** — temp + `rename`; refuse unreadable files without reset.
- **`blocked` vs `failed` confusion.** — classify from files, not from `RunResult.blocked`.
- **Default caps surprise operators.** — print the cap in `exhausted`/`stalled` reasons; allow overrides.

## Reversibility and Rollback

High. Stop writing `loop/`. Existing `loop/` trees can remain. Exit codes are loop-only. Removing `loopFeedback` is source-compatible if the field stays optional until deleted.

## Implementation Notes

- Treat `in_progress` after a kill as remaining work for the next `runTaskPacket` pass, not as a loop terminal.
- Keep iteration summaries bounded and free of secrets, raw ACP payloads, and absolute paths.
- `--dry-run` must leave the packet byte-identical, including absence of `loop/`.

## Follow-ups

- Pin `--no-ui` wording in implementation tests.
- Revisit default caps only after first real use.

## References

- [PRD](../_prd.md)
- [ADR-003](adr-003-isolated-loop-stack.md)
- [exec exit matrix](../../../README.md)
