# Continuous Packet Loop Driver Technical Specification

## Executive Summary

Add `spec-finder loop <task_slug>` as an isolated coordinator above unchanged `runTaskPacket`. New modules `src/loop-state.ts` and `src/loop.ts` own the packet-local ledger, detect, caps, classification, and terminals. `loopCommand` reuses the existing run-lock and cockpit/`--no-ui` lifecycle. The only engine contract change is optional `RunOptions.loopFeedback`.

Primary trade-off: one remaining engine pass per iteration (not one task) in exchange for leaving `run`, batch, and packet lifecycle ownership frozen. No config migration, no new dependency, no daemon.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | `runTaskPacket` owns one-pass lifecycle; `RunResult.blocked` is overloaded. | [`src/engine.ts`](../../../src/engine.ts) | 2026-08-13 | Classify from packet files, not counts. |
| Repository | Failed tasks stay in `executionOrder`. | [`src/tasks.ts`](../../../src/tasks.ts) | 2026-08-13 | Terminal `failed` must not re-invoke the engine. |
| Repository | Batch is a thin injectable coordinator; CLI must not own workflow. | [`src/batch.ts`](../../../src/batch.ts), [architecture.md](../../../.agents/rules/architecture.md) | 2026-08-13 | Isolated `src/loop.ts`, not `commands.ts` or batch reuse. |
| Repository | `run`/`batch` exit `0`/`1`; `exec` exits `0`/`1`/`2`/`130`; unknown command is `2`. | [`src/commands.ts`](../../../src/commands.ts), [`src/cli.tsx`](../../../src/cli.tsx) | 2026-08-13 | Loop uses the exec-like matrix. |
| Repository | Archive ignores extra packet directories. | [`skills/sf-archive-tasks/scripts/scan-tasks.sh`](../../../skills/sf-archive-tasks/scripts/scan-tasks.sh) | 2026-08-13 | `loop/` does not affect archive. |
| Repository | Setup already stage+`rename`s durable writes. | [`src/setup.ts`](../../../src/setup.ts) | 2026-08-13 | Ledger writes use temp + rename. |
| Repository | Config is a strict Zod schema; PRD forbids required new keys. | [`src/config.ts`](../../../src/config.ts), PRD HC | 2026-08-13 | Caps are CLI/ledger only. |
| Official docs | Zod 4 `safeParse` / `discriminatedUnion`. | [zod.dev](https://zod.dev/api?id=parse) | reviewed 2026-08-13 | Strict ledger schema, fail closed. |
| Official docs | `fs.promises.rename` is the replace primitive. | [Node.js fs](https://nodejs.org/api/fs.html) | reviewed 2026-08-13 | Atomic ledger replace. |
| Official docs | Bun `bun:test` is the repo runner. | [Bun test](https://bun.sh/docs/test) | reviewed 2026-08-13 | Focused `tests/loop*.test.ts`. |
| Official docs | ACP cancel is a first-class turn outcome. | [ACP overview](https://agentclientprotocol.com/protocol/overview) | reviewed 2026-08-13 | Reuse existing abort signal. |
| User decision | Isolated stack; wrap engine; file detect; `loop/state.json`; exits `0/1/2/130`; optional `loopFeedback`; always-reset. | ADR-003, ADR-004 | 2026-08-13 | Implementation constraints. |

## Requirement Traceability

High-level constraints are `C-01`–`C-07` in PRD High-Level Constraints order.

| PRD ID | Technical obligation | Component/interface | Verification | Status/gap |
|---|---|---|---|---|
| G-01 | One invocation iterates recoveries until a named terminal. | `src/loop.ts` | Coordinator fixtures | Covered |
| G-02 | `run` and `--multiple` unchanged. | Existing command branches | Existing suites | Covered |
| G-03 | Named terminal + reason on every stop. | `LoopResult`, `--no-ui` formatter | Exit/output tests | Covered |
| G-04 | Resume from `loop/state.json` without redoing completed work. | `src/loop-state.ts`, detect | Kill/resume fixtures | Covered |
| G-05 | Opt-in command, no daemon/config/telemetry. | CLI help/README, no config key | `tests/cli.test.ts` | Covered |
| US-01 | Drive until finished or truly stopped. | Coordinator loop | Recovery-continue fixture | Covered |
| US-02 | Process death does not redo completed tasks. | Detect + engine skip | Resume fixture | Covered |
| US-03 | Handoff/checkpoint recovery stays inside the loop. | Detect continue + engine | Recovery fixtures | Covered |
| US-04 | Named stop visible in `--no-ui` and interactive close. | Formatter + existing cockpit | Command tests | Covered |
| US-05 | Dry-run prints plan, writes nothing. | `loop --dry-run` | Byte-identical fixture | Covered |
| US-06 | Existing `run` meaning preserved. | No `run` grammar change | Regression | Covered |
| US-07 | Packet evidence names terminal, last action, remaining work. | `loop/state.json`, iteration md | Schema + file tests | Covered |
| F-01 | `loop <slug>` + run flags + lock + one packet. | Parser, `loopCommand` | Parse/lock tests | Covered |
| F-02 | Detect, recover first, failed-only, fail-fast, feedback. | Detect + `loopFeedback` | Detect + prompt tests | Covered |
| F-03 | Seven terminals with specified meanings. | Classifier | Matrix tests | Covered |
| F-04 | Runtime-only ledger, resume, refuse invalid, dry-run silent. | `loop-state.ts` | Load/write/refuse tests | Covered |
| F-05 | Dry-run validates and prints, no mutation. | Coordinator dry-run branch | Filesystem snapshot | Covered |
| F-06 | Caps, no-progress, cancel ≠ failed. | Coordinator + abort | Cap/cancel tests | Covered |
| F-07 | Help/README contrast; later work documented. | `cli.tsx`, README | Help/README tests | Covered |
| C-01 | Local packet truth, no daemon. | File ledger only | Design + review | Covered |
| C-02 | One slug; reject `--multiple`. | Parser | Parse test | Covered |
| C-03 | Share workspace run-lock. | `acquireRunLock` | Concurrent refuse test | Covered |
| C-04 | Stop on first unrecoverable failure. | Classifier | Failed-task fixture | Covered |
| C-05 | No telemetry; no required config keys. | Scope | Schema/diff review | Covered |
| C-06 | No new remote ship; reuse existing checkpoints. | Engine unchanged | Checkpoint regression | Covered |
| C-07 | Permission/policy stops are `blocked`, not retried. | Classifier + ledger `blocker` | Permission fixture | Covered |
| M-01 | 100% named-terminal scenarios. | Acceptance matrix | `tests/loop.test.ts` | Release gate |
| M-02 | 100% handoff/checkpoint continue in one invocation. | Coordinator | Recovery fixtures | Release gate |
| M-03 | 100% kill/resume skip completed. | Ledger + detect | Resume fixtures | Release gate |
| M-04 | 100% dry-run non-mutation. | Dry-run | Snapshot tests | Release gate |
| M-05 | 100% existing `run`/batch acceptance. | Existing suites | `bun run verify` | Release gate |
| M-06 | 100% lock exclusivity. | Command | Concurrent command test | Release gate |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| `src/cli.tsx` | Existing | Dispatch `loop`; help usage. | argv → command | `loopCommand` |
| `src/commands.ts` | Existing | Parse loop flags; lock; lifecycle; exit map. | argv → exit code | `runLoop`, lock, cockpit |
| `src/loop.ts` | New | Detect, iterate, classify, caps, feedback. | options → `LoopResult` + events | `loop-state`, `runTaskPacket` |
| `src/loop-state.ts` | New | Schema, load/init/reset, atomic write, iteration files. | packet dir → `LoopState` | `node:fs`, Zod |
| `src/engine.ts` | Existing, additive | Optional `loopFeedback` prompt prefix. | `RunOptions` | Unchanged otherwise |
| `src/events.ts` | Existing, additive | Optional loop activity/finished events. | coordinator → listeners | Store may ignore in V1 |
| `src/run-lock.ts` | Existing | One workspace owner. | root → lease | Unchanged |
| Cockpit store/UI | Existing | Reuse task detail; no new meters. | wrapped emit | Suppress extra `run_started` |
| README/help | Existing | `loop` vs `run`, terminals, exits. | docs | `tests/cli.test.ts` |

### Data and Control Flow

Normal: parse → lock → load config/overrides → load or bootstrap ledger → detect. If work remains, call `runTaskPacket({ loopFeedback })` → reload packet → classify → write state + iteration summary → detect again until a terminal.

Dry-run: parse → (no lock mutation of ledger) validate packet → detect → print plan → exit `0` if the plan is valid, including likely `no_op`/`done`. Create no `loop/` directory.

Failure: any `failed` task after a pass → write `terminal: failed` → stop. Do not start another pass.

Recoverable block: report handoff or pending checkpoint → write iteration, keep `terminal` null → next pass.

External/policy stop: persist `blocker`, `terminal: blocked` → stop.

Cancel: abort signal → `cancelled`, exit `130`. Ledger may record the cancelled terminal; task files stay as the engine left them.

Invalid ledger: exit `2` unless `--reset-state` rewrote bootstrap first.

## Implementation Design

### Core Interfaces

```ts
type LoopTerminal =
  | "done" | "no_op" | "blocked" | "failed"
  | "exhausted" | "stalled" | "cancelled"

type LoopResult = {
  terminal: LoopTerminal
  reason: string
  iteration: number
  slug: string
}

type LoopRunOptions = {
  root: string
  slug: string
  config: SpecFinderConfig
  signal: AbortSignal
  emit: RunEventListener
  interactivePermissions: boolean
  dryRun?: boolean
  resetState?: boolean
  maxIterations?: number
  noProgressWindow?: number
  runTaskPacket?: typeof runTaskPacket
}
```

```ts
// Additive only; run/batch omit it.
interface RunOptions {
  // ...existing fields
  loopFeedback?: string
}
```

Errors: invalid parse/packet/ledger throw named errors the command maps to exit `2`. Coordinator returns `LoopResult` for terminals. Engine errors that are not cancel and leave no classifiable residue become `blocked` with a ledger `blocker`.

### Data Models and Lifecycle

`loop/state.json` version `1`, Zod `.strict()`:

- identity: `version`, `slug`, `created_at`, `updated_at`
- contract: `goal`, `definition_of_done` (fixed V1 strings)
- counters: `iteration` ≥ 0, `max_iterations` ≥ 1, `no_progress_window` ≥ 1, `no_progress_streak` ≥ 0
- `terminal`: `LoopTerminal | null`
- `blocker`: `{ code, message } | null`
- `progress`: completed/failed/blocked/pending id arrays (derived snapshot)
- `feedback`: `{ previous_outcome, route_causes, last_failed_task_ids }`
- `iterations`: append-only, capped at 50 `{ n, at, action, outcome, summary }`

Ownership: runtime only. Retention: lives with the packet, including archive. Concurrency: workspace run-lock. Consistency: detect always reloads tasks from disk; ledger snapshots are evidence, not authority over task status.

`--reset-state`: rewrite bootstrap after packet validation; delete is not required. Iteration markdown may remain; new run starts at `001` only after reset clears or the writer starts a new sequence from `iteration` 0 (reset truncates `iterations[]`; leftover markdown files are leftover evidence and must not be treated as the ledger).

Default strings:

- goal: `Implement every pending task in this packet to completed with evidence reports.`
- definition of done: `All task_*.md frontmatter status is completed, done, or finished; every task has a substantive report; no pending checkpoint delivery; no open report handoff.`

### External Interfaces

CLI:

```text
spec-finder loop <task_slug>
  [--no-ui] [--provider NAME] [--model ID] [--reasoning LEVEL] [--speed MODE]
  [--max-iterations N] [--no-progress-window N]
  [--dry-run] [--reset-state]
```

Rules: exactly one positional slug; unknown options, missing values, option-like values, `--multiple`, extra positionals → exit `2` before lock work that mutates. Repeated recognized flags use the last value (same as `exec`). `N` must be a positive integer.

`--no-ui` lines (stable prefixes):

- `loop: iteration <n>/<cap> <action>`
- `loop: terminal <name>: <reason>`
- dry-run: `loop: dry-run` then pending/recovery lines; `loop: would-write nothing`

Auth: none beyond existing provider/config. Retries: engine still has one phase retry per pass; loop does not add another inner retry. Idempotency: resume is detect-from-disk. Compatibility: new verb only.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility |
|---|---|---|---|---|
| `cli.tsx` | no `loop` | dispatch + help | unknown stays `2` | additive |
| `runCommand` | single/batch | none | n/a | frozen |
| `runTaskPacket` | `RunOptions` | optional `loopFeedback` | omitted = current prompts | additive |
| Events | run/batch | additive `activity` messages; optional `loop_finished` | listeners ignore unknown | additive |
| Cockpit | `run_started` resets store | command wraps emit; first pass only seeds store | later passes update tasks only | no meter UI |
| Config | strict v3 | none | n/a | frozen |
| Archive | `task_*.md` only | none | `loop/` ignored | compatible |
| Run-lock | one owner | `loop` acquires same lock | second owner refused | same error text |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Invalid flags/slug | parser | exit `2`, usage | fix argv | parse tests |
| Invalid packet | `loadTaskPacket` / `validateTasks` | exit `2`, existing error shape | fix packet | existing tests |
| Invalid ledger | Zod `safeParse` | exit `2`, name path/issue | `--reset-state` or delete `loop/` | load tests |
| Report handoff blocked | task `handoff.phase === "report"` | continue next iteration | engine report-only | recovery fixture |
| Checkpoint pending/blocked | `hasPendingCheckpointDelivery` | continue next iteration | existing checkpoint retry | recovery fixture |
| Task `failed` | any failed status | `failed`, exit `1` | operator fixes, then `loop` or `--reset-state` | fail-fast fixture |
| Permission/policy/external | pass not explained by files | `blocked` + `blocker`, exit `1` | human policy/credential fix, rerun | blocker fixture |
| Iteration cap | `iteration >= max_iterations` before another pass | `exhausted`, exit `1` | raise cap or reset | cap fixture |
| No progress | streak ≥ window | `stalled`, exit `1` | inspect evidence, fix cause | stall fixture |
| Cancel | abort / ACP cancelled | `cancelled`, exit `130` | rerun when ready | cancel fixture |
| Mid-write kill | unreadable/partial JSON | next start exit `2` | `--reset-state` | atomic-write test |
| Dry-run | n/a | print plan, no writes | n/a | snapshot |
| Concurrent `run`/`loop` | run-lock | existing refuse error | wait/stop other PID | lock test |

## Security and Privacy

- Trust boundary is the workspace packet directory. Ledger paths must stay under `.spec-finder/tasks/<slug>/loop/`.
- No secrets, tokens, or raw ACP payloads in `state.json` or iteration markdown. Feedback and blockers are bounded (max 4096 chars, stripped control chars).
- Permissions remain the existing user-owned policy. Loop does not auto-approve. Repeated permission denials classify as `blocked`.
- Fail closed on schema, path, or parse uncertainty.
- Auditability is the packet-local ledger, not telemetry.

## Compatibility, Migration, and Rollback

- No config version bump. No packet schema change to `task_*.md`.
- New files are additive. Older Spec Finder versions ignore `loop/`.
- Rollout: ship the command; operators opt in by typing `loop`.
- Rollback: stop shipping the verb; leftover `loop/` is inert.
- Cleanup: none required. `--reset-state` is operator-initiated.
- `RunOptions.loopFeedback` is optional; removing the reader later is safe if writers stop setting it.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/cli.tsx` | New command + help | Help/README drift | Update `tests/cli.test.ts` |
| `src/commands.ts` | `loopCommand`, parser, emit wrap, exits | Lifecycle bugs | Command tests |
| `src/loop.ts` | New | Policy defects | Matrix tests |
| `src/loop-state.ts` | New | Corrupt writes | Atomic/schema tests |
| `src/engine.ts` | Optional prompt prefix | Accidental `run` prompt change | Assert omitted default |
| `src/events.ts` | Additive variants | Store exhaustiveness | Compile + ignore-unknown |
| `src/ui/store.ts` | Possibly ignore new events | Reset on `run_started` | Emit wrapper, not store rewrite |
| `tests/engine.test.ts` | Feedback-omitted regression | Prompt drift | One focused test |
| `tests/commands.test.ts` / new `tests/loop*.test.ts` | New | Incomplete matrix | Cover terminals |
| README | `loop` vs `run` | Discovery risk | Help lockstep test |
| Archive skill | None | Accidental classifier change | Do not touch |
| `package.json` | None | — | No new deps |

## Testing and Evidence

### Unit Tests

- `parseLoopArgs`: valid flags; last-value-wins; reject `--multiple`, unknown, missing, non-positive N, extra slugs.
- `detectLoopAction`: bootstrap, recover handoff, recover checkpoint, execute pending, `no_op`, `done`, `failed`, `blocked` with blocker, `exhausted`, `stalled`, in-progress-after-kill → execute.
- `loopState`: init, load, reject unknown keys/invalid terminal, atomic write, reset, dry-run does not write.
- Progress fingerprint: unchanged sets increment streak; a completed-id change resets streak.

### Integration Tests

- Injected `runTaskPacket`: continue after synthetic handoff/checkpoint; stop after synthetic `failed`; cap; stall; cancel.
- `loopFeedback` present only on second pass; first pass omits; `runCommand` never sets it.
- Command lock: active `run` refuses `loop` and the reverse.
- `--no-ui` prints `loop: terminal` and exit codes `0/1/2/130`.

### End-to-End or Platform Evidence

- No new PTY/cockpit meters. Interactive path reuses existing cockpit; one command test proves emit wrapping does not require a second `waitForNoWork` except `no_op`.
- No native/Windows-specific ledger proof beyond existing Node rename (same as setup).
- Accessibility: `--no-ui` text labels, not color.

### Verification Gates

```bash
bun test tests/loop-state.test.ts tests/loop.test.ts tests/loop-args.test.ts
bun test tests/engine.test.ts tests/commands.test.ts tests/cli.test.ts tests/run-lock.test.ts
bun run verify
```

## Observability

- `--no-ui`: iteration/action and terminal/reason lines only.
- Ledger: `terminal`, `blocker`, `feedback`, capped `iterations[]`.
- Activity events may say `loop: recovering report handoff` / `loop: executing remaining work` / `loop: terminal …`.
- No metrics, counters, or network telemetry.
- Redact absolute paths in printed reasons; use workspace-relative packet paths.

## Development Sequencing

1. `src/loop-state.ts` schema, load/init/reset, atomic write, unit tests — no dependencies.
2. Pure `detectLoopAction` + classification helpers and tests — depends on step 1 types.
3. Additive `RunOptions.loopFeedback` and engine prompt prefix with omitted-default test — independent of step 2 after types exist; can start after step 1.
4. `src/loop.ts` coordinator with injected runner, dry-run, caps, cancel — depends on 1–3.
5. `parseLoopArgs` + `loopCommand` + `cli.tsx` help/dispatch + emit wrapper + exit map — depends on 4.
6. README + `tests/cli.test.ts` lockstep — depends on 5.
7. Full `bun run verify` — depends on 1–6.

Steps 2 and 3 are parallelizable after step 1.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Iteration is one remaining pass | ADR-003 | Coarse no-progress if a pass completes one task then blocks recoverably | Accept for V1; revisit single-task seam only if stall false-positives appear |
| `run` vs loop exit matrices | ADR-004 | Operator/script confusion | README must contrast; owner: docs |
| External stop without task residue | `RunResult` has no stop reason | Needs ledger `blocker` | Classifier tests; owner: loop.ts |
| Interactive store reset | `run_started` resets store | Lost task list on pass 2 | Emit wrapper required in command |
| Default 50 / 3 | Product open question | Surprise `exhausted`/`stalled` | Print numbers in reason; revisit after first use |
| Leftover iteration markdown after reset | Reset truncates JSON only | Orphan files | V1 ignore orphans; do not parse them |
| `--no-ui` exact copy | Product open question | Wording churn | Pin prefixes in tests; body text may refine |

## Architecture Decision Records

- [ADR-001: Dedicated Loop Command as Continuous Packet Driver](adrs/adr-001-dedicated-loop-command.md) — new verb; `run` stays single-pass.
- [ADR-002: CLI-First Honest-Terminal Loop Scope](adrs/adr-002-cli-first-honest-terminal-loop-scope.md) — V1 product boundary.
- [ADR-003: Isolated Loop Stack Above Unchanged `runTaskPacket`](adrs/adr-003-isolated-loop-stack.md) — modules, wrap engine, optional feedback.
- [ADR-004: Packet-Local Ledger, File Detect, Exec-Like Exits](adrs/adr-004-loop-ledger-detect-and-exits.md) — `loop/state.json`, classification, `0/1/2/130`, always-reset.
