# Explicit No-Work Run State Technical Specification

## Executive Summary

Add an optional, typed `outcome: "no_work"` and
`reason: "all_tasks_complete"` to the existing engine result and
`run_finished` event. When a loaded, valid packet has zero executable tasks,
the engine emits that fact successfully without starting ACP work.

`--no-ui` prints a concise all-tasks-complete explanation and exits `0`.
Interactive runs project the typed result into a persistent, read-only cockpit
summary. The command waits for a one-shot, App-triggered exit signal only for
that outcome; normal successes retain automatic close behavior.

The design adds no dependencies, configuration, persistence, provider activity,
telemetry, task editing, or direct batch behavior changes. Pending batch work
remains an additive compatibility boundary.

## Technical Evidence

| Kind | Finding/constraint | Source | Version/date | Design consequence |
|---|---|---|---|---|
| Repository | Taskless packets are invalid; `executionOrder()` excludes completed/done/finished tasks. | `src/tasks.ts` | 2026-08-08 | Valid no-work is `ordered.length === 0`, not a load error. |
| Repository | ACP implementation/reporting occur only inside the ordered-task loop. | `src/engine.ts` | 2026-08-08 | Empty order must return before provider work naturally begins. |
| Repository | `RunResult` and `run_finished` currently expose only generic completion data. | `src/engine.ts`, `src/events.ts` | 2026-08-08 | Extend both additively with optional typed fields. |
| Repository | Interactive command cleanup immediately destroys the cockpit. | `src/commands.ts` | 2026-08-08 | Add a no-work-only exit wait. |
| Repository | Cockpit supports existing Q/Ctrl+C exit and rendered-frame tests. | `src/ui/App.tsx`, `tests/cockpit.test.tsx` | 2026-08-08 | Reuse keyboard behavior; test visible state rather than color alone. |
| Official docs | OpenTUI supports test rendering, mock input, and explicit renderer teardown. | [OpenTUI testing docs](https://github.com/anomalyco/opentui/blob/main/packages/web/src/content/docs/core-concepts/testing.mdx) | 0.4.5, accessed 2026-08-08 | No new dependency or testing strategy is needed. |
| User decision | Use optional typed result/event fields, command-owned wait, and only `all_tasks_complete` in V1. | ADR-003 | 2026-08-08 | Keep the outcome bounded and backward-compatible. |

## Requirement Traceability

| PRD ID | Technical obligation | Component/interface | Verification | Status |
|---|---|---|---|---|
| G-01 | State why no task executes. | Engine outcome/event; no-work summary. | Engine, store, rendered-frame tests. | Covered |
| G-02 | Preserve successful terminal semantics. | `RunResult`; `--no-ui` command output. | Command exit/output tests. | Covered |
| G-03 | Keep cockpit observational and predictable. | App keyboard flow; cockpit lifecycle. | Q/Ctrl+C persistence tests. | Covered |
| US-01 | Explain completed reruns. | No-work title, reason, counts. | Rendered-frame test. | Covered |
| US-02 | Remain visible until exit. | `waitForExit()` and App exit callback. | Pending-promise command test; keyboard tests. | Covered |
| US-03 | Tell CLI users while succeeding. | Console `run_finished` formatting. | `--no-ui` test exits 0. | Covered |
| F-01 | Explicit valid no-work outcome. | `outcome` and `reason` fields. | All-complete engine fixture. | Covered |
| F-02 | Persistent informational cockpit. | Store projection and no-work summary variant. | Store and OpenTUI frame tests. | Covered |
| F-03 | Truthful successful no-UI result. | Command listener/output. | Exact semantic-text plus exit-code test. | Covered |
| F-04 | No provider work or controls. | Empty-order engine branch; unchanged App controls. | ACP sentinel and frame tests. | Covered |
| C-01 | Default eligible single-packet run behavior. | Existing singular `run` path. | Single-run integration test. | Covered |
| C-02 | Valid no-work succeeds in no-UI mode. | Command result mapping. | Exit code 0 test. | Covered |
| C-03 | Preserve read-only Q/Ctrl+C navigation. | Existing App keys, idempotent exit callback. | Q/Ctrl+C regression tests. | Covered |
| C-04 | No telemetry/new user data. | No telemetry code or dependencies. | Diff/review plus full gate. | Covered |
| C-05 | Invalid packets remain errors. | Existing load/validation paths. | Invalid/taskless regression tests. | Covered |
| C-06 | Start no provider work. | Empty-order engine path. | ACP sentinel test. | Covered |
| M-01 | Explain 100% of defined no-work cases. | Typed reason and visible wording. | Acceptance test matrix. | Covered |
| M-02 | Zero provider work. | Empty-order engine path. | ACP sentinel test. | Covered |
| M-03 | Truthful successful no-UI results. | Console output. | Command test matrix. | Covered |
| M-04 | Persistent interactive state. | Command wait and summary. | Lifecycle/rendered-frame tests. | Covered |

## System Architecture

### Components and Boundaries

| Component | Existing/new | Responsibility | Inputs/outputs | Dependencies |
|---|---|---|---|---|
| Task planner | Existing | Load, validate, order task files. | Packet → ordered tasks. | `src/tasks.ts` |
| Engine | Modified | Classify valid empty order and publish terminal fact. | Ordered tasks → result/event. | Tasks, ACP client |
| Event contract | Modified | Carry optional no-work metadata. | `run_finished` → consumers. | Engine, store, command, batch-compatible consumers |
| Command | Modified | Select no-UI output or interactive lifecycle. | Result → exit code or retained cockpit. | Engine, cockpit |
| Cockpit handle | Modified | Expose close and one-shot exit wait. | App exit → promise resolution. | OpenTUI renderer |
| Store/App | Modified | Project and render the typed no-work state. | Event → readable summary. | Existing read-only UI |
| Batch flow | Unchanged | Keep existing `already_complete` behavior. | Existing runner/event flow. | Must tolerate optional fields |

### Data and Control Flow

```text
load + validate packet → executionOrder()
  ├─ error → existing CLI error path / exit 1
  ├─ tasks remain → existing ACP lifecycle → automatic cockpit close
  └─ zero tasks → typed no_work + all_tasks_complete
                   ├─ --no-ui → explain reason → exit 0
                   └─ cockpit → persistent summary → Q/Ctrl+C
                                                → resolve wait → close
```

The no-work predicate is evaluated only after existing loading and validation.
It does not reinterpret a packet with no task files, malformed front matter,
dependency errors, provider errors, or cancellation as no-work.

## Implementation Design

### Core Interfaces

```ts
export type NoWorkReason = "all_tasks_complete"

export interface RunResult {
  ok: boolean
  completed: number
  failed: number
  blocked: number
  outcome?: "no_work"
  reason?: NoWorkReason
}
```

Invariant: `outcome` and `reason` are both present only for a successful, valid
empty execution order; otherwise both are absent.

```ts
export type RunEvent =
  | /* existing events */
  | {
      type: "run_finished"
      ok: boolean
      message: string
      outcome?: "no_work"
      reason?: NoWorkReason
    }
```

The existing event type and message remain. Consumers must use the typed fields
for behavior and may ignore them for compatibility.

```ts
export interface CockpitHandle {
  close(): void
  waitForExit(): Promise<void>
}
```

`close()` and the App-originated exit signal must be safe to invoke more than
once. `waitForExit()` resolves once; it does not reject or create a new control
surface.

### Engine Behavior

1. Preserve current loading, validation, packet-memory initialization, and
   ordered-task calculation.
2. When `ordered.length === 0`, construct a successful result with
   `outcome: "no_work"` and `reason: "all_tasks_complete"`.
3. Emit the existing `run_finished` event with the same typed fields and a
   human-readable message such as “No executable tasks: all tasks are already
   complete.”
4. Return without launching ACP, creating reports, changing task status, or
   emitting task lifecycle work.
5. Preserve existing behavior for nonempty, failed, invalid, and cancelled
   paths.

### Command and Cockpit Lifecycle

For `--no-ui`, format the typed no-work event/result as clear human-readable
success text, for example:

```text
ok: no executable tasks; all tasks are already complete
```

This is intentionally human-readable output, not a new machine-readable
automation protocol.

For interactive mode:

1. `startCockpit` creates an internal exit promise and passes an `onExit`
   callback to App.
2. App retains ownership of Q/Ctrl+C. Its existing exit path signals `onExit`
   before aborting/destroying the renderer.
3. The command runs the engine normally.
4. Only after a successful `result.outcome === "no_work"` does the command
   await `cockpit.waitForExit()`.
5. The existing `finally` cleanup closes the cockpit after the wait.
6. For ordinary success, failure, cancellation, or errors, the command does
   not await and retains current cleanup timing.

The persistent summary must show:

- A distinct title such as `NO EXECUTABLE TASKS`
- `All tasks are already complete`
- Task completion count, for example `Tasks 3/3 complete`
- Existing visible Q/Ctrl+C exit guidance

It must communicate these in text, not color alone.

### Data Models and Lifecycle

No database, schema, configuration, migration, retained user data, or new
process state is introduced.

The engine retains its existing local packet-memory initialization. That side
effect is not provider work and is unchanged. No-work metadata is in-memory
only and exists for the lifetime of the result/event/UI session.

### External Interfaces

There are no new external APIs, authentication flows, retry policies, or
network calls.

The CLI preserves its current successful exit code for valid no-work runs.
Invalid packet loading and validation continue to use existing error reporting
and exit behavior. A future machine-readable result contract is explicitly out
of scope.

## Integration Points

| Boundary | Current contract | Change | Failure behavior | Compatibility/migration |
|---|---|---|---|---|
| Engine → event consumers | Free-text terminal event. | Optional typed no-work fields. | Existing errors/cancellation unchanged. | Existing consumers may ignore fields. |
| Engine → command | Generic counts/result. | Optional typed no-work fields. | Command never parses completion wording. | Runner fixtures remain valid. |
| Command → cockpit | `close()` only. | Add `waitForExit()`. | Idempotent exit prevents deadlock/double-destroy. | Normal runs do not await it. |
| Store → App | Generic finished state. | Project optional outcome/reason. | Missing fields render current generic summary. | Batch projections remain untouched. |
| Single run → no-UI | Generic completion line. | Explicit all-complete success line. | Invalid/failing commands remain existing errors. | No exit-code migration. |
| Batch runner | Existing `already_complete` summary. | No direct behavior/UI change. | Batch preflight/result semantics preserved. | Optional event/result fields must not break its types/tests. |

## Failure and Recovery Behavior

| Failure mode | Detection | User/system behavior | Recovery/rollback | Evidence |
|---|---|---|---|---|
| Taskless packet | Existing task loader error. | Error, never no-work. | Add valid task files; rerun. | Task-loader regression. |
| Invalid task/dependency | Existing validation failure. | Error, never no-work. | Correct packet; rerun. | Engine/task regression. |
| Valid all-complete packet | `ordered.length === 0`. | Typed successful no-work outcome. | Exit; reopen/add work through existing workflow. | Engine, command, UI tests. |
| Provider failure/nonempty run | Existing engine catch path. | Existing failure status and automatic close behavior. | Existing recovery process. | Normal failure regression. |
| Operator Q/Ctrl+C | Existing keyboard handler. | Signal exit once, retain abort behavior. | Rerun if desired. | Keyboard/lifecycle tests. |
| Missed/double exit signal | Promise/renderer lifecycle. | No duplicate cleanup or indefinite wait. | Idempotent resolver/close. | Controlled command seam test. |

## Security and Privacy

- The no-work branch reaches no provider startup, ACP child process,
  authentication path, network operation, report creation, or task mutation.
- Existing workspace-bound ACP write protections remain unchanged and are not
  reached on this path.
- No secrets, telemetry, analytics, persistence, or new logs are added.
- Existing strict config validation and invalid-packet failure behavior remain
  fail-closed.
- Task titles/counts already visible in the local cockpit are the only
  displayed data; no additional data is exposed.

## Compatibility, Migration, and Rollback

- Optional fields preserve source compatibility for existing `RunResult`
  fixtures and event consumers.
- There is no config or data migration.
- The existing terminal event continues to carry `ok` and `message`.
- The current batch implementation must preserve its `already_complete`
  summaries and may ignore the new singular optional fields.
- If rollback is required, remove the typed no-work UI/command branch; legacy
  generic success behavior remains structurally available with no data cleanup.

## Impact Analysis

| Component/file | Impact | Risk | Required action |
|---|---|---|---|
| `src/engine.ts` | Classify empty order; mirror fields in result/event. | Incorrectly classifying errors. | Use only successful valid empty-order predicate. |
| `src/events.ts` | Extend terminal event type. | Conflict with pending batch event additions. | Merge fields additively; preserve all variants. |
| `src/commands.ts` | Hold interactive no-work run until exit; format no-UI message. | Hanging command or changed normal completion. | Await only typed no-work result; inject/mock lifecycle in tests. |
| `src/ui/cockpit.tsx` | Return one-shot exit wait. | Double cleanup. | Make close/resolve idempotent. |
| `src/ui/store.ts` | Preserve outcome/reason in finished state. | Batch projection interference. | Gate only the singular finished projection. |
| `src/ui/App.tsx` | Render distinct persistent no-work summary. | Color-only/unclear exit affordance. | Use textual title, counts, and existing Q/Ctrl+C. |
| `src/batch.ts` | No direct feature change. | Result/event shape incompatibility. | Preserve existing batch tests. |
| `tests/engine.test.ts` | New no-work and regression evidence. | ACP side effects missed. | Use launch sentinel and filesystem assertions. |
| `tests/commands.test.ts` | No-UI and wait lifecycle evidence. | Tests hang. | Deferred, explicitly resolved cockpit handle. |
| `tests/store.test.ts` | Typed state projection. | Generic summary regression. | Cover present and absent metadata. |
| `tests/cockpit.test.tsx` | Visible state, Q/Ctrl+C behavior. | Renderer teardown flakiness. | Reuse existing render/destroy helpers. |

## Testing and Evidence

### Unit Tests

- An all-complete packet containing the supported completed/done/finished
  statuses returns `ok: true`, `outcome: "no_work"`, and
  `reason: "all_tasks_complete"`.
- Its `run_finished` event carries identical fields and explanatory message.
- An ACP/provider launch sentinel is never invoked; no report file or task
  status mutation is created.
- Taskless and invalid packets still throw existing errors and emit no no-work
  terminal event.
- Normal successful and failed runs omit no-work metadata and preserve existing
  ACP/report behavior.
- Store projection preserves typed metadata when present and preserves the
  existing generic finished state when absent.

### Integration Tests

- `--no-ui` no-work command output contains the all-complete meaning and
  returns exit code `0`.
- A normal interactive result closes/returns without waiting for the cockpit
  exit signal.
- A no-work interactive result remains pending after engine completion, exposes
  its rendered state, and resolves only when the mocked exit signal fires.
- Both Q and Ctrl+C preserve existing cancellation/destroy behavior and resolve
  the no-work exit signal exactly once.
- Batch tests retain successful `already_complete` handling and injected
  `PacketRunner` compatibility.

### End-to-End or Platform Evidence

- Rendered OpenTUI frames prove the no-work title, reason, counts, and exit
  guidance are visible without relying on color.
- No manual platform/package release evidence is needed; the repository’s
  OpenTUI test renderer covers this lifecycle.

### Verification Gates

```sh
rtk bun test tests/engine.test.ts tests/commands.test.ts tests/store.test.ts tests/cockpit.test.tsx tests/batch.test.ts
rtk bun run verify
rtk git diff --check
```

## Observability

- The existing in-process `run_finished` event gains typed terminal context for
  internal consumers.
- No new telemetry, analytics, metrics backend, persistence, alerting, or
  sensitive logging is introduced.
- Release acceptance uses the defined test matrix to measure M-01 through M-04.

## Development Sequencing

1. Extend no-work types, engine result/event emission, and engine tests — no
   dependencies.
2. Extend singular store state and App summary rendering with frame tests —
   depends on step 1.
3. Add idempotent cockpit exit handle and wire single-run command behavior and
   no-UI formatting — depends on steps 1–2.
4. Add controlled lifecycle integration tests and preserve batch compatibility
   coverage — depends on step 3.
5. Run focused suites, full verification, and diff checks — depends on all
   prior steps.

No external prerequisite or dependency upgrade is required.

## Known Risks and Open Technical Questions

| Item | Evidence | Consequence | Resolution criterion/owner |
|---|---|---|---|
| Concurrent batch edits touch event/store/command files. | Current user-owned dirty worktree. | Merge conflict or accidental batch behavior change. | Implementer preserves batch variants/tests; no direct batch scope expansion. |
| Cockpit wait could hang if exit is not signalled. | Current API has no exit promise. | Interactive no-work command could remain open. | Q/Ctrl+C and explicit mocked exit tests resolve it once. |
| Future valid zero-work reasons may emerge. | V1 currently has one planner cause. | Enum extension could need new wording/tests. | Add an ADR and traceability before adding a reason. |
| Exact microcopy can evolve. | PRD leaves phrasing open. | Snapshot brittleness. | Tests assert the required semantic phrases, not ornamental layout text. |

## Architecture Decision Records

- [ADR-001: Empty-run state](adrs/adr-001-empty-run-state.md) — bounded valid
  no-work scope.
- [ADR-002: Default informative no-work](adrs/adr-002-default-informative-no-work.md)
  — default successful, information-only UX.
- [ADR-003: Typed no-work outcome and command-owned exit lifecycle](adrs/adr-003-typed-no-work-lifecycle.md)
  — selected technical design.
